import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  workItemStatusesApi,
  workflowConfigApi,
  getApiErrorMessage,
  type WorkItemStatus,
  type StatusCategory,
} from '../../../api';
import { useHasCapability } from '../../../hooks/useCurrentUser';
import { Heading } from '../../../components/catalyst/heading';
import { Text } from '../../../components/catalyst/text';
import { Button } from '../../../components/catalyst/button';
import { Dropdown, DropdownButton, DropdownItem, DropdownMenu } from '../../../components/catalyst/dropdown';
import { EllipsisVerticalIcon } from '@heroicons/react/16/solid';
import IconButton from '../../../components/IconButton';
import { Pill } from '../../../components/ui/Pill';
import { Card, CardBody } from '../../../components/ui/Card';
import { DenseTable, DenseTHead, DenseRow } from '../../../components/ui/DenseTable';
import { SettingsListFooter } from '../../../components/settings/SettingsListFooter';
import { DragHandle } from '../../../components/settings/DragHandle';
import ItemStatusFormDialog, { CATEGORY_LABELS } from '../../../components/settings/ItemStatusFormDialog';

const QUERY_KEY = ['work-item-statuses'];
const CONFIG_QUERY_KEY = ['workflow-config'];

const CATEGORY_TONES: Record<StatusCategory, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  BLOCKED: 'warning',
  CANCELLED: 'danger',
};

export default function ItemStatusesPanel() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const canEdit = useHasCapability('EDIT_SETTINGS');

  const [selectedStatus, setSelectedStatus] = useState<WorkItemStatus | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const { data: statuses, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => workItemStatusesApi.getAll(),
  });

  const { data: config } = useQuery({
    queryKey: CONFIG_QUERY_KEY,
    queryFn: () => workflowConfigApi.get(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workItemStatusesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (error: unknown) => {
      alert(getApiErrorMessage(error) || t('settings.itemStatuses.errorDelete'));
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => workItemStatusesApi.reorder(orderedIds),
    onSuccess: (updated) => queryClient.setQueryData(QUERY_KEY, updated),
    onError: (error: unknown) => {
      alert(getApiErrorMessage(error) || t('settings.itemStatuses.errorReorder'));
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const handleAdd = () => {
    setSelectedStatus(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (status: WorkItemStatus) => {
    setSelectedStatus(status);
    setIsDialogOpen(true);
  };

  const handleDelete = (status: WorkItemStatus) => {
    if (window.confirm(t('settings.taxonomy.deleteConfirm', { name: status.name }))) {
      deleteMutation.mutate(status.id);
    }
  };

  const sorted = statuses
    ? [...statuses].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    : [];

  const nextSortOrder = sorted.length > 0
    ? Math.max(...sorted.map((s) => s.sortOrder)) + 1
    : 0;

  const defaultStatusId = config?.defaultWorkItemStatusId;

  const performReorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= sorted.length || to >= sorted.length) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    reorderMutation.mutate(reordered.map((s) => s.id));
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <Heading>{t('settings.nav.itemStatuses')}</Heading>
          <Text className="text-sm text-fg-muted mt-1">
            {t('settings.itemStatuses.description')}
          </Text>
        </div>
        {canEdit && (
          <Button color="accent" onClick={handleAdd}>
            {t('common.actions.add', { entity: t('settings.itemStatuses.statusSingular') })}
          </Button>
        )}
      </div>

      {isLoading && <Text>{t('common.actions.loading', { entities: t('settings.nav.itemStatuses') })}</Text>}
      {error && (
        <Text className="text-danger-500">
          {getApiErrorMessage(error) || t('common.actions.errorLoading', { entities: t('settings.nav.itemStatuses') })}
        </Text>
      )}
      {statuses && statuses.length === 0 && (
        <Text>{t('common.actions.notFound', { entities: t('settings.nav.itemStatuses') })}</Text>
      )}

      {sorted.length > 0 && (
        <Card>
          <CardBody flush>
            <DenseTable>
              <DenseTHead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>{t('common.form.name')}</th>
                  <th>{t('common.form.code')}</th>
                  <th>{t('settings.itemStatuses.table.category')}</th>
                  <th>{t('settings.itemStatuses.table.terminal')}</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </DenseTHead>
              <tbody>
                {sorted.map((status, index) => {
                  const isDefault = defaultStatusId === status.id;
                  const isDragging = dragIndex === index;
                  const isDragOver = dragOverIndex === index && dragIndex !== null && dragIndex !== index;
                  return (
                    <DenseRow
                      key={status.id}
                      draggable={canEdit}
                      onDragStart={(e: React.DragEvent) => {
                        if (!canEdit) return;
                        setDragIndex(index);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e: React.DragEvent) => {
                        if (dragIndex === null) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverIndex !== index) setDragOverIndex(index);
                      }}
                      onDragLeave={() => {
                        if (dragOverIndex === index) setDragOverIndex(null);
                      }}
                      onDrop={(e: React.DragEvent) => {
                        e.preventDefault();
                        if (dragIndex !== null) performReorder(dragIndex, index);
                        setDragIndex(null);
                        setDragOverIndex(null);
                      }}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setDragOverIndex(null);
                      }}
                      className={
                        [
                          isDragging && 'opacity-50',
                          isDragOver && 'outline outline-2 outline-accent-500/40 outline-offset-[-2px]',
                        ].filter(Boolean).join(' ')
                      }
                    >
                      <td>{canEdit && <DragHandle />}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="strong">{status.name}</span>
                          {isDefault && (
                            <span className="inline-flex items-center rounded bg-bg-active px-1 py-[1px] text-[9px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                              {t('common.default')}
                            </span>
                          )}
                        </div>
                        {status.description && (
                          <div className="muted mt-0.5">{status.description}</div>
                        )}
                      </td>
                      <td><span className="font-mono text-fg-muted">{status.code}</span></td>
                      <td>
                        <Pill tone={CATEGORY_TONES[status.statusCategory]}>
                          {CATEGORY_LABELS[status.statusCategory]}
                        </Pill>
                      </td>
                      <td>
                        {status.isTerminal ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success-500" />
                            <span>{t('common.enabled')}</span>
                          </span>
                        ) : (
                          <span className="text-fg-dim">—</span>
                        )}
                      </td>
                      <td className="right">
                        {canEdit && (
                          <Dropdown>
                            <DropdownButton as={IconButton} aria-label={t('common.moreOptions')}>
                              <EllipsisVerticalIcon className="size-4" />
                            </DropdownButton>
                            <DropdownMenu anchor="bottom end">
                              <DropdownItem onClick={() => handleEdit(status)}>
                                {t('common.edit')}
                              </DropdownItem>
                              <DropdownItem onClick={() => handleDelete(status)}>
                                {t('common.delete')}
                              </DropdownItem>
                            </DropdownMenu>
                          </Dropdown>
                        )}
                      </td>
                    </DenseRow>
                  );
                })}
              </tbody>
            </DenseTable>
          </CardBody>
          <SettingsListFooter count={sorted.length} noun={t('settings.nav.itemStatuses').toLowerCase()} />
        </Card>
      )}

      <ItemStatusFormDialog
        isOpen={isDialogOpen}
        onClose={() => { setIsDialogOpen(false); setSelectedStatus(null); }}
        status={selectedStatus || undefined}
        nextSortOrder={nextSortOrder}
      />
    </div>
  );
}
