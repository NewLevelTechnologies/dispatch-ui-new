import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { dispatchesApi, userApi } from '../api';
import { useGlossary } from '../contexts/GlossaryContext';
import { Button } from './catalyst/button';
import { Checkbox, CheckboxField } from './catalyst/checkbox';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from './catalyst/dialog';
import { Description, Field, Label } from './catalyst/fieldset';
import { Input } from './catalyst/input';
import { Select } from './catalyst/select';
import { Textarea } from './catalyst/textarea';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workOrderId: string;
}

const DEFAULT_WINDOW_HOURS = 2;

// datetime-local accepts/produces "YYYY-MM-DDTHH:mm" in local time. Default the
// window to "next hour, two-hour width" so the dispatcher starts on a typical
// commitment slot rather than overtype a stale value.
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toLocalInput(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function defaultWindowStart(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toLocalInput(d);
}

function defaultWindowEnd(startLocal: string): string {
  const start = new Date(startLocal);
  if (Number.isNaN(start.getTime())) return '';
  const end = new Date(start.getTime() + DEFAULT_WINDOW_HOURS * 60 * 60 * 1000);
  return toLocalInput(end);
}

export default function AssignTechnicianDialog({ isOpen, onClose, workOrderId }: Props) {
  const { t } = useTranslation();
  const { getName } = useGlossary();
  const queryClient = useQueryClient();

  const [assignedUserId, setAssignedUserId] = useState('');
  const [windowStart, setWindowStart] = useState(() => defaultWindowStart());
  const [windowEnd, setWindowEnd] = useState(() => defaultWindowEnd(defaultWindowStart()));
  // Estimated duration is optional per the design — it's an internal capacity
  // estimate, not the customer-facing commitment. Empty string = "not set",
  // which translates to omitting the field on submit.
  const [duration, setDuration] = useState<string>('');
  const [notes, setNotes] = useState('');
  // Default OFF: dispatchers commonly schedule in advance and notify the tech
  // later from the dispatches row. Same-day emergencies just tick the box.
  const [notifyTech, setNotifyTech] = useState(false);

  // Re-seed every time the dialog opens so a previous draft doesn't leak into
  // the next assignment. Cheaper than resetting on close (avoids a flash of
  // empty state during the close animation). Form-init pattern matches the
  // other *FormDialog components.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isOpen) {
      const start = defaultWindowStart();
      setAssignedUserId('');
      setWindowStart(start);
      setWindowEnd(defaultWindowEnd(start));
      setDuration('');
      setNotes('');
      setNotifyTech(false);
    }
  }, [isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // When the dispatcher changes the window start, push the end forward by the
  // same delta so the window width stays where they last had it. If they've
  // intentionally widened/narrowed the end relative to start, that custom
  // width is preserved; if they leave it at the default, it tracks the start.
  const handleWindowStartChange = (next: string) => {
    const prevStart = new Date(windowStart);
    const prevEnd = new Date(windowEnd);
    setWindowStart(next);
    if (
      !Number.isNaN(prevStart.getTime()) &&
      !Number.isNaN(prevEnd.getTime()) &&
      prevEnd.getTime() > prevStart.getTime()
    ) {
      const delta = prevEnd.getTime() - prevStart.getTime();
      const nextEndMs = new Date(next).getTime() + delta;
      if (!Number.isNaN(nextEndMs)) {
        setWindowEnd(toLocalInput(new Date(nextEndMs)));
      }
    } else {
      setWindowEnd(defaultWindowEnd(next));
    }
  };

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getAll(),
  });

  // Only enabled users are dispatchable. Real role-based filtering (Tech
  // capability) lives behind a future user/role refactor; for now any active
  // user is a valid pick.
  const techs = useMemo(
    () =>
      [...users]
        .filter((u) => u.enabled)
        .sort((a, b) => {
          const an = `${a.lastName} ${a.firstName}`.trim();
          const bn = `${b.lastName} ${b.firstName}`.trim();
          return an.localeCompare(bn);
        }),
    [users]
  );

  const createMutation = useMutation({
    mutationFn: () => {
      const startIso = new Date(windowStart).toISOString();
      const endIso = new Date(windowEnd).toISOString();
      const durationNum = duration.trim() === '' ? undefined : Number(duration);
      return dispatchesApi.create({
        workOrderId,
        assignedUserId,
        arrivalWindowStart: startIso,
        arrivalWindowEnd: endIso,
        estimatedDuration:
          durationNum != null && Number.isFinite(durationNum) && durationNum > 0
            ? durationNum
            : undefined,
        notes: notes.trim() || undefined,
        notifyAssignedUser: notifyTech || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      queryClient.invalidateQueries({
        queryKey: ['work-order-activity', workOrderId],
      });
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      alert(msg || t('common.form.errorCreate', { entity: getName('dispatch') }));
    },
  });

  // Window must be a non-empty range (end strictly after start). Without this
  // guard a fat-fingered overlap silently posts a degenerate window.
  const windowValid =
    !!windowStart &&
    !!windowEnd &&
    new Date(windowEnd).getTime() > new Date(windowStart).getTime();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignedUserId || !windowValid) return;
    createMutation.mutate();
  };

  const isSubmitDisabled =
    !assignedUserId || !windowValid || createMutation.isPending;

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>{t('workOrders.dispatches.assignTechnician')}</DialogTitle>
      <DialogDescription>
        {t('workOrders.dispatches.assignDescription', {
          entity: getName('technician'),
        })}
      </DialogDescription>
      <form onSubmit={handleSubmit}>
        {/* Dense layout: paired fields share a row (Window Start + End), narrow
            inputs stay narrow (Duration), tight vertical rhythm via space-y-3
            instead of FieldGroup's marketing-form-sized gaps. */}
        <DialogBody className="space-y-3">
          <Field>
            <Label>{t('workOrders.dispatches.form.technician')}</Label>
            <Select
              name="assignedUserId"
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
              required
            >
              <option value="">{t('common.form.select')}</option>
              {techs.map((u) => {
                const name = `${u.firstName} ${u.lastName}`.trim() || u.email;
                return (
                  <option key={u.id} value={u.id}>
                    {name}
                  </option>
                );
              })}
            </Select>
          </Field>

          {/* Window start + end live on the same row — they read as a single
              "from–to" unit, so stacking burns vertical for no signal gain. */}
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label>{t('workOrders.dispatches.form.arrivalWindowStart')}</Label>
              <Input
                type="datetime-local"
                name="arrivalWindowStart"
                value={windowStart}
                onChange={(e) => handleWindowStartChange(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Label>{t('workOrders.dispatches.form.arrivalWindowEnd')}</Label>
              <Input
                type="datetime-local"
                name="arrivalWindowEnd"
                value={windowEnd}
                onChange={(e) => setWindowEnd(e.target.value)}
                min={windowStart}
                required
              />
            </Field>
          </div>
          {!windowValid && windowStart && windowEnd && (
            <p className="-mt-2 text-xs text-red-600 dark:text-red-400">
              {t('workOrders.dispatches.form.windowEndAfterStart')}
            </p>
          )}

          {/* Duration is short numeric content — capping the input width keeps
              the label tight against the value the way it reads on paper. */}
          <Field>
            <Label>
              {t('workOrders.dispatches.form.estimatedDurationOptional')}
            </Label>
            <Input
              type="number"
              name="estimatedDuration"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder={t('scheduling.form.durationPlaceholder')}
              className="!max-w-[160px]"
            />
          </Field>

          <Field>
            <Label>{t('common.form.notes')}</Label>
            <Textarea
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </Field>

          {/* Default OFF — dispatchers usually schedule silently and notify
              from the row when ready. Tech needs a phone number on their
              user profile or the SMS won't go out. */}
          <CheckboxField>
            <Checkbox
              name="notifyAssignedUser"
              checked={notifyTech}
              onChange={setNotifyTech}
            />
            <Label>{t('workOrders.dispatches.form.notifyNow')}</Label>
            <Description>
              {t('workOrders.dispatches.form.notifyNowDescription')}
            </Description>
          </CheckboxField>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={onClose} type="button">
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitDisabled}>
            {createMutation.isPending
              ? t('common.actions.saving')
              : t('workOrders.dispatches.assign')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
