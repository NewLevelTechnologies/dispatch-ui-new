import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  workflowConfigApi,
  workOrderTypesApi,
  workItemStatusesApi,
  getApiErrorMessage,
  type UpdateWorkflowConfigRequest,
  type DispatchBoardType,
} from '../../../api';
import { useGlossary } from '../../../contexts/GlossaryContext';
import { useHasCapability } from '../../../hooks/useCurrentUser';
import { Heading } from '../../../components/catalyst/heading';
import { Text } from '../../../components/catalyst/text';
import { Button } from '../../../components/catalyst/button';
import { Select } from '../../../components/catalyst/select';
import { Checkbox } from '../../../components/catalyst/checkbox';
import { Card } from '../../../components/ui/Card';
import { SettingsSectionLabel } from '../../../components/settings/SettingsSection';
import { FieldLabel, FieldHelp } from '../../../components/settings/FieldLabel';

function formatLastSaved(updatedAt?: string) {
  if (!updatedAt) return null;
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return null;
  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '');
  return `${monthDay} · ${time}`;
}

export default function WorkflowConfigPanel() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { getName } = useGlossary();
  const canEdit = useHasCapability('EDIT_SETTINGS');
  const [formData, setFormData] = useState<UpdateWorkflowConfigRequest>({});

  const { data: config, isLoading, error } = useQuery({
    queryKey: ['workflow-config'],
    queryFn: () => workflowConfigApi.get(),
  });

  const { data: types } = useQuery({
    queryKey: ['work-order-types'],
    queryFn: () => workOrderTypesApi.getAll(),
  });

  const { data: statuses } = useQuery({
    queryKey: ['work-item-statuses'],
    queryFn: () => workItemStatusesApi.getAll(),
  });

  useEffect(() => {
    if (config) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        enforceStatusWorkflow: config.enforceStatusWorkflow,
        defaultWorkOrderTypeId: config.defaultWorkOrderTypeId ?? null,
        defaultWorkItemStatusId: config.defaultWorkItemStatusId ?? null,
        dispatchBoardType: config.dispatchBoardType,
      });
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: (req: UpdateWorkflowConfigRequest) => workflowConfigApi.update(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-config'] });
    },
    onError: (error: unknown) => {
      alert(getApiErrorMessage(error) || t('settings.workflowConfig.errorSave'));
    },
  });

  const handleSave = () => updateMutation.mutate(formData);
  const handleCancel = () => {
    if (config) {
      setFormData({
        enforceStatusWorkflow: config.enforceStatusWorkflow,
        defaultWorkOrderTypeId: config.defaultWorkOrderTypeId ?? null,
        defaultWorkItemStatusId: config.defaultWorkItemStatusId ?? null,
        dispatchBoardType: config.dispatchBoardType,
      });
    }
  };

  if (isLoading) return <Text className="text-fg-muted">{t('common.loading')}</Text>;
  if (error || !config) {
    return (
      <Text className="text-danger-500">
        {getApiErrorMessage(error) || t('settings.workflowConfig.errorLoad')}
      </Text>
    );
  }

  const lastSaved = formatLastSaved(config.updatedAt);

  return (
    <div>
      <div className="mb-4">
        <Heading>{t('settings.nav.workflowConfig')}</Heading>
        <Text className="mt-1 text-sm text-fg-muted max-w-3xl leading-snug">
          {t('settings.workflowConfig.descriptionLong')}
        </Text>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5 p-4">
          {/* ── Defaults column ────────────────────────── */}
          <div className="space-y-3">
            <SettingsSectionLabel>{t('settings.workflowConfig.defaults')}</SettingsSectionLabel>
            <div>
              <FieldLabel>
                {t('settings.workflowConfig.defaultWorkOrderType', { workOrder: getName('work_order') })}
              </FieldLabel>
              <Select
                name="defaultWorkOrderTypeId"
                value={formData.defaultWorkOrderTypeId ?? ''}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFormData((prev) => ({ ...prev, defaultWorkOrderTypeId: e.target.value || null }))
                }
                disabled={!canEdit}
              >
                <option value="">{t('settings.workflowConfig.noneOption')}</option>
                {types?.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </Select>
              <FieldHelp>{t('settings.workflowConfig.defaultTypeHelper')}</FieldHelp>
            </div>
            <div>
              <FieldLabel>{t('settings.workflowConfig.defaultItemStatus')}</FieldLabel>
              <Select
                name="defaultWorkItemStatusId"
                value={formData.defaultWorkItemStatusId ?? ''}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFormData((prev) => ({ ...prev, defaultWorkItemStatusId: e.target.value || null }))
                }
                disabled={!canEdit}
              >
                <option value="">{t('settings.workflowConfig.noneOption')}</option>
                {statuses?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
              <FieldHelp>{t('settings.workflowConfig.defaultStatusHelper')}</FieldHelp>
            </div>
          </div>

          {/* ── Behavior column ────────────────────────── */}
          <div className="space-y-3">
            <SettingsSectionLabel>{t('settings.workflowConfig.behavior')}</SettingsSectionLabel>
            <div>
              <FieldLabel>
                {t('settings.workflowConfig.dispatchBoardType', { dispatch: getName('dispatch') })}
              </FieldLabel>
              <Select
                name="dispatchBoardType"
                value={formData.dispatchBoardType ?? 'STATUS_BASED'}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setFormData((prev) => ({ ...prev, dispatchBoardType: e.target.value as DispatchBoardType }))
                }
                disabled={!canEdit}
              >
                <option value="STATUS_BASED">{t('settings.workflowConfig.statusBased')}</option>
                <option value="SCHEDULE_BASED">{t('settings.workflowConfig.scheduleBased')}</option>
              </Select>
              <FieldHelp>{t('settings.workflowConfig.boardTypeHelper')}</FieldHelp>
            </div>
            <div className="flex items-start gap-2 pt-1">
              <Checkbox
                name="enforceStatusWorkflow"
                checked={formData.enforceStatusWorkflow ?? false}
                onChange={(checked) => setFormData((prev) => ({ ...prev, enforceStatusWorkflow: checked }))}
                disabled={!canEdit}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-fg-strong">
                  {t('settings.workflowConfig.enforce')}
                </div>
                <p className="text-[11.5px] text-fg-muted leading-snug">
                  {t('settings.workflowConfig.enforceHelper')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ────────────────────────────────── */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border-soft bg-bg-elev-2 px-4 py-2.5">
          <div className="text-[11.5px] text-fg-muted">
            {lastSaved
              ? t('settings.workflowConfig.lastSaved', { when: lastSaved })
              : ' '}
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Button plain type="button" onClick={handleCancel} disabled={updateMutation.isPending}>
                {t('common.cancel')}
              </Button>
              <Button type="button" onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? t('common.saving') : t('settings.saveChanges')}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
