import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  dispatchesApi,
  userApi,
  type Dispatch,
  type DispatchStatus,
  type User,
} from '../api';
import { useGlossary } from '../contexts/GlossaryContext';
import { Badge } from './catalyst/badge';
import { Button } from './catalyst/button';
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from './catalyst/dropdown';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './catalyst/table';
import {
  CalendarIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

const STATUS_COLORS: Record<DispatchStatus, 'sky' | 'blue' | 'lime' | 'zinc'> = {
  SCHEDULED: 'sky',
  IN_PROGRESS: 'blue',
  COMPLETED: 'lime',
  CANCELLED: 'zinc',
};

// Linear flow per backend guide: SCHEDULED → IN_PROGRESS sets arrivedAt,
// IN_PROGRESS → COMPLETED sets departedAt. Cancel/reassign live in a follow-up.
const NEXT_STATUS: Partial<Record<DispatchStatus, DispatchStatus>> = {
  SCHEDULED: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
};

const DATE_PART = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const TIME_PART = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * Format an arrival window for display. Same-day windows render once-per-date
 * with a time range ("Fri, May 15 · 8:00 – 10:00 AM"); cross-date windows
 * fall back to the full instant on each side ("May 15 8:00 PM – May 16 6:00 AM"
 * pattern). The same-day case is the overwhelmingly common one — service
 * commitments rarely span midnight.
 */
function formatWindow(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  if (sameDay) {
    return `${DATE_PART.format(start)} · ${TIME_PART.format(start)} – ${TIME_PART.format(end)}`;
  }
  return `${DATE_PART.format(start)} ${TIME_PART.format(start)} – ${DATE_PART.format(end)} ${TIME_PART.format(end)}`;
}

function formatTimeOnly(iso: string): string {
  return TIME_PART.format(new Date(iso));
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface Props {
  workOrderId: string;
  /** Cancelled / archived WOs render rows read-only and hide the assign CTA. */
  readOnly?: boolean;
  onAssign: () => void;
  /**
   * Open the dialog in edit mode for the given dispatch. Page-level state
   * owns the selection so the dialog (page-mounted) can prefill from it.
   */
  onEdit: (dispatch: Dispatch) => void;
}

/**
 * Operational "who is going, when" section directly above WorkItemsTable.
 * For most WOs there are 0–1 dispatches; the section reads cleanly in either
 * state. Status advance is a single-click button (Mark arrived / Mark completed)
 * rather than a dropdown — the linear flow makes a menu unnecessary friction.
 */
export default function DispatchesSection({
  workOrderId,
  readOnly = false,
  onAssign,
  onEdit,
}: Props) {
  const { t } = useTranslation();
  const { getName } = useGlossary();

  const { data: dispatches = [], isLoading } = useQuery({
    queryKey: ['dispatches', { workOrderId }],
    queryFn: () => dispatchesApi.getAll({ workOrderId }),
    enabled: !!workOrderId,
  });

  // Used to resolve assignedUserId → "First Last" for row display. One query
  // for the page (not N+1 per row); React Query dedupes with the dialog's
  // identical key.
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getAll(),
  });
  const usersById = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of users) map.set(u.id, u);
    return map;
  }, [users]);

  // Stable order: arrival window start ASC. Backend may already return this
  // order, but we sort client-side defensively.
  const sorted = useMemo(
    () =>
      [...dispatches].sort(
        (a, b) =>
          new Date(a.arrivalWindowStart).getTime() -
          new Date(b.arrivalWindowStart).getTime()
      ),
    [dispatches]
  );

  const showAssign = !readOnly;
  const headerBar = (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {getName('dispatch', true)}
      </h2>
      {showAssign && (
        <Button onClick={onAssign}>
          <PlusIcon className="size-4" />
          {t('workOrders.dispatches.assignTechnician')}
        </Button>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <section aria-label={getName('dispatch', true)} className="mb-6">
        {headerBar}
        <div className="rounded-lg border border-dashed border-zinc-200 p-3 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {t('common.actions.loading', { entities: getName('dispatch', true) })}
        </div>
      </section>
    );
  }

  if (sorted.length === 0) {
    return (
      <section aria-label={getName('dispatch', true)} className="mb-6">
        {headerBar}
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-200 p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          <CalendarIcon className="size-4 text-zinc-400" />
          <span>
            {t('workOrders.dispatches.empty', { entity: getName('technician') })}
          </span>
        </div>
      </section>
    );
  }

  return (
    <section aria-label={getName('dispatch', true)} className="mb-6">
      {headerBar}
      <Table dense className="[--gutter:theme(spacing.1)] text-sm">
        <TableHead>
          <TableRow>
            <TableHeader>{t('workOrders.dispatches.table.tech')}</TableHeader>
            <TableHeader>{t('workOrders.dispatches.table.window')}</TableHeader>
            <TableHeader className="w-px whitespace-nowrap">
              {t('workOrders.dispatches.table.duration')}
            </TableHeader>
            <TableHeader className="w-px whitespace-nowrap">
              {t('workOrders.dispatches.table.status')}
            </TableHeader>
            <TableHeader className="w-px" aria-hidden />
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((d) => (
            <DispatchRow
              key={d.id}
              dispatch={d}
              tech={usersById.get(d.assignedUserId)}
              readOnly={readOnly}
              onEdit={onEdit}
            />
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

interface RowProps {
  dispatch: Dispatch;
  tech: User | undefined;
  readOnly: boolean;
  onEdit: (dispatch: Dispatch) => void;
}

const NOTIFY_SENT_FLASH_MS = 3000;

function DispatchRow({ dispatch, tech, readOnly, onEdit }: RowProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Transient "Sent ✓" state on the Notify button after a successful send.
  // Anchored to the row that triggered it — no toast/floating UI needed for
  // a single confirmation. Errors still alert because they need attention.
  const [justNotified, setJustNotified] = useState(false);
  const notifiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (notifiedTimerRef.current) clearTimeout(notifiedTimerRef.current);
    };
  }, []);

  const advanceMutation = useMutation({
    mutationFn: (next: DispatchStatus) =>
      dispatchesApi.update(dispatch.id, { status: next }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      queryClient.invalidateQueries({
        queryKey: ['work-order-activity', dispatch.workOrderId],
      });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      alert(msg || t('workOrders.dispatches.statusUpdateError'));
    },
  });

  // Hard delete. Scoped to SCHEDULED in the UI so we never destroy field
  // history (arrivedAt / departedAt). Confirms before firing — common-case
  // is "wrong tech / typo / window changed before any tech action."
  const deleteMutation = useMutation({
    mutationFn: () => dispatchesApi.delete(dispatch.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      queryClient.invalidateQueries({
        queryKey: ['work-order-activity', dispatch.workOrderId],
      });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      alert(msg || t('workOrders.dispatches.deleteError'));
    },
  });

  // Manual SMS trigger. Idempotent on the backend, so this also serves as a
  // resend when the window or notes change.
  const notifyMutation = useMutation({
    mutationFn: () => dispatchesApi.notify(dispatch.id),
    onSuccess: () => {
      setJustNotified(true);
      if (notifiedTimerRef.current) clearTimeout(notifiedTimerRef.current);
      notifiedTimerRef.current = setTimeout(
        () => setJustNotified(false),
        NOTIFY_SENT_FLASH_MS
      );
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      alert(msg || t('workOrders.dispatches.notifyError'));
    },
  });

  const techName = tech
    ? `${tech.firstName} ${tech.lastName}`.trim() || tech.email
    : '—';
  const next = NEXT_STATUS[dispatch.status];
  const canAdvance = !readOnly && !!next && !advanceMutation.isPending;
  // Only meaningful while the dispatch is still on the books — once a tech is
  // arrived/completed/cancelled, the SMS is moot.
  const canNotify =
    !readOnly && dispatch.status === 'SCHEDULED' && !notifyMutation.isPending;
  // Edit + delete are open on every status during dev so we can freely
  // recover from typos / experiment. Pre-prod we'll re-scope to SCHEDULED
  // only — protecting field history (arrivedAt/departedAt) once a tech has
  // interacted with the row.
  const canManage = !readOnly;

  const handleDelete = () => {
    if (deleteMutation.isPending) return;
    if (!window.confirm(t('workOrders.dispatches.deleteConfirm'))) return;
    deleteMutation.mutate();
  };
  // The action verb depends on the transition: SCHEDULED→IN_PROGRESS is
  // "Mark arrived" (backend stamps arrivedAt); IN_PROGRESS→COMPLETED is
  // "Mark completed" (backend stamps departedAt).
  const advanceLabel =
    dispatch.status === 'SCHEDULED'
      ? t('workOrders.dispatches.markArrived')
      : dispatch.status === 'IN_PROGRESS'
        ? t('workOrders.dispatches.markCompleted')
        : '';

  return (
    <TableRow className="align-top">
      <TableCell>
        <div className="font-medium text-zinc-950 dark:text-white">{techName}</div>
        {dispatch.notes && (
          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {dispatch.notes}
          </div>
        )}
      </TableCell>
      <TableCell>
        <div>
          {formatWindow(dispatch.arrivalWindowStart, dispatch.arrivalWindowEnd)}
        </div>
        {(dispatch.arrivedAt || dispatch.departedAt) && (
          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {dispatch.arrivedAt && (
              <span>
                {t('workOrders.dispatches.arrivedAt', {
                  time: formatTimeOnly(dispatch.arrivedAt),
                })}
              </span>
            )}
            {dispatch.arrivedAt && dispatch.departedAt && <span> · </span>}
            {dispatch.departedAt && (
              <span>
                {t('workOrders.dispatches.departedAt', {
                  time: formatTimeOnly(dispatch.departedAt),
                })}
              </span>
            )}
          </div>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {dispatch.estimatedDuration != null
          ? formatDuration(dispatch.estimatedDuration)
          : '—'}
      </TableCell>
      <TableCell>
        <Badge color={STATUS_COLORS[dispatch.status]}>
          {t(`workOrders.dispatches.status.${dispatch.status}`)}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex items-center justify-end gap-1">
          {canNotify &&
            (justNotified ? (
              // Inline success state replaces the alert. Anchored to the row
              // that triggered it; auto-reverts after NOTIFY_SENT_FLASH_MS.
              <span className="inline-flex items-center gap-1 px-2 text-sm text-lime-600 dark:text-lime-400">
                <CheckIcon className="size-4" />
                {t('workOrders.dispatches.notifySent')}
              </span>
            ) : (
              <Button
                plain
                onClick={() => notifyMutation.mutate()}
                title={
                  tech?.phoneNumber
                    ? undefined
                    : t('workOrders.dispatches.notifyMissingPhone')
                }
              >
                {t('workOrders.dispatches.notify')}
              </Button>
            ))}
          {canAdvance && next && (
            <Button plain onClick={() => advanceMutation.mutate(next)}>
              {advanceLabel}
            </Button>
          )}
          {canManage && (
            <Dropdown>
              <DropdownButton plain aria-label={t('common.moreOptions')}>
                <EllipsisVerticalIcon className="size-5" />
              </DropdownButton>
              <DropdownMenu anchor="bottom end">
                <DropdownItem onClick={() => onEdit(dispatch)}>
                  <DropdownLabel>{t('common.edit')}</DropdownLabel>
                </DropdownItem>
                <DropdownItem onClick={handleDelete}>
                  <DropdownLabel>{t('common.delete')}</DropdownLabel>
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
