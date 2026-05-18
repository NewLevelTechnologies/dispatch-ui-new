import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { dispatchRegionApi, getApiErrorMessage, type DispatchRegion } from '../../api';
import { useHasCapability } from '../../hooks/useCurrentUser';
import { useGlossary } from '../../contexts/GlossaryContext';
import DispatchRegionFormDialog from '../../components/DispatchRegionFormDialog';
import { Heading } from '../../components/catalyst/heading';
import IconButton from '../../components/IconButton';
import { Text } from '../../components/catalyst/text';
import { Button } from '../../components/catalyst/button';
import { Dropdown, DropdownButton, DropdownItem, DropdownMenu } from '../../components/catalyst/dropdown';
import { EllipsisVerticalIcon } from '@heroicons/react/16/solid';
import { Pill } from '../../components/ui/Pill';
import { Card, CardBody } from '../../components/ui/Card';
import { DenseTable, DenseTHead, DenseRow } from '../../components/ui/DenseTable';
import { SettingsListFooter } from '../../components/settings/SettingsListFooter';
import { DragHandle } from '../../components/settings/DragHandle';

export default function DispatchRegionsPanel() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { getName } = useGlossary();
  const canView = useHasCapability('VIEW_SETTINGS');
  const canEdit = useHasCapability('EDIT_SETTINGS');

  const [selectedRegion, setSelectedRegion] = useState<DispatchRegion | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const { data: regions, isLoading, error } = useQuery({
    queryKey: ['dispatch-regions'],
    queryFn: () => dispatchRegionApi.getAll(true),
    enabled: canView,
  });

  const deleteRegionMutation = useMutation({
    mutationFn: (id: string) => dispatchRegionApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dispatch-regions'] }),
    onError: (error: unknown) => {
      alert(getApiErrorMessage(error) || 'Failed to delete dispatch region');
    },
  });

  const reactivateRegionMutation = useMutation({
    mutationFn: (id: string) => dispatchRegionApi.reactivate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dispatch-regions'] }),
    onError: (error: unknown) => {
      alert(getApiErrorMessage(error) || 'Failed to reactivate dispatch region');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => dispatchRegionApi.reorder(orderedIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dispatch-regions'] }),
    onError: (error: unknown) => {
      alert(getApiErrorMessage(error) || 'Failed to reorder region');
      queryClient.invalidateQueries({ queryKey: ['dispatch-regions'] });
    },
  });

  const handleAdd = () => {
    setSelectedRegion(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (region: DispatchRegion) => {
    setSelectedRegion(region);
    setIsDialogOpen(true);
  };

  const handleDelete = (region: DispatchRegion) => {
    if (window.confirm(t('dispatchRegions.actions.deactivateConfirm', { name: region.name }))) {
      deleteRegionMutation.mutate(region.id);
    }
  };

  const handleReactivate = (region: DispatchRegion) => {
    reactivateRegionMutation.mutate(region.id);
  };

  const sorted = regions
    ? [...regions].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    : [];

  const activeSorted = sorted.filter((r) => r.isActive);

  const nextSortOrder = sorted.length > 0
    ? Math.max(...sorted.map((r) => r.sortOrder)) + 1
    : 0;

  const performReorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= activeSorted.length || to >= activeSorted.length) return;
    const reordered = [...activeSorted];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    reorderMutation.mutate(reordered.map((r) => r.id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <Heading>{getName('dispatch')} {t('entities.regions')}</Heading>
          <Text className="text-sm text-zinc-600 dark:text-zinc-400">
            {t('dispatchRegions.description', { dispatch: getName('dispatch') })}
          </Text>
        </div>
        {canEdit && (
          <Button color="accent" onClick={handleAdd}>
            {t('common.actions.add', { entity: `${getName('dispatch')} ${t('entities.region')}` })}
          </Button>
        )}
      </div>

      {isLoading && <Text>{t('dispatchRegions.loading', { dispatch: getName('dispatch') })}</Text>}
      {error && (
        <Text className="text-red-600">
          {getApiErrorMessage(error) || t('common.actions.errorLoading', { entities: `${getName('dispatch')} ${t('entities.regions')}` })}
        </Text>
      )}
      {regions && regions.length === 0 && <Text>{t('dispatchRegions.empty', { dispatch: getName('dispatch') })}</Text>}

      {sorted.length > 0 && (
        <Card>
          <CardBody flush>
            <DenseTable>
              <DenseTHead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>{t('dispatchRegions.table.name')}</th>
                  <th>{t('dispatchRegions.table.abbreviation')}</th>
                  <th>{t('dispatchRegions.table.state')}</th>
                  <th>{t('dispatchRegions.table.status')}</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </DenseTHead>
              <tbody>
                {sorted.map((region) => {
                  const activeIndex = region.isActive
                    ? activeSorted.findIndex((r) => r.id === region.id)
                    : -1;
                  const draggable = canEdit && region.isActive;
                  const isDragging = draggable && dragIndex === activeIndex;
                  const isDragOver =
                    draggable && dragOverIndex === activeIndex && dragIndex !== null && dragIndex !== activeIndex;
                  return (
                    <DenseRow
                      key={region.id}
                      draggable={draggable}
                      onDragStart={(e: React.DragEvent) => {
                        if (!draggable) return;
                        setDragIndex(activeIndex);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e: React.DragEvent) => {
                        if (dragIndex === null || activeIndex < 0) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverIndex !== activeIndex) setDragOverIndex(activeIndex);
                      }}
                      onDragLeave={() => {
                        if (dragOverIndex === activeIndex) setDragOverIndex(null);
                      }}
                      onDrop={(e: React.DragEvent) => {
                        e.preventDefault();
                        if (dragIndex !== null && activeIndex >= 0) performReorder(dragIndex, activeIndex);
                        setDragIndex(null);
                        setDragOverIndex(null);
                      }}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setDragOverIndex(null);
                      }}
                      className={
                        [
                          !region.isActive && 'opacity-55',
                          isDragging && 'opacity-50',
                          isDragOver && 'outline outline-2 outline-accent-500/40 outline-offset-[-2px]',
                        ].filter(Boolean).join(' ')
                      }
                    >
                      <td>{draggable && <DragHandle />}</td>
                      <td>
                        <div className="strong">{region.name}</div>
                        {region.description && (
                          <div className="muted mt-0.5">{region.description}</div>
                        )}
                      </td>
                      <td className="muted">{region.abbreviation}</td>
                      <td className="muted">{region.state || '—'}</td>
                      <td>
                        {region.isActive ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success-500" />
                            <span>{t('common.active')}</span>
                          </span>
                        ) : (
                          <Pill tone="neutral">{t('common.inactive')}</Pill>
                        )}
                      </td>
                      <td className="right">
                        {canEdit && (
                          <Dropdown>
                            <DropdownButton as={IconButton} aria-label={t('common.moreOptions')}>
                              <EllipsisVerticalIcon className="size-4" />
                            </DropdownButton>
                            <DropdownMenu anchor="bottom end">
                              <DropdownItem onClick={() => handleEdit(region)}>
                                {t('common.edit')}
                              </DropdownItem>
                              {region.isActive ? (
                                <DropdownItem onClick={() => handleDelete(region)}>
                                  {t('dispatchRegions.actions.deactivate')}
                                </DropdownItem>
                              ) : (
                                <DropdownItem onClick={() => handleReactivate(region)}>
                                  {t('dispatchRegions.actions.reactivate')}
                                </DropdownItem>
                              )}
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
          <SettingsListFooter
            count={sorted.length}
            noun={`${getName('dispatch').toLowerCase()} ${t('entities.regions').toLowerCase()}`}
            extra={(() => {
              const inactive = sorted.length - activeSorted.length;
              if (inactive === 0) return null;
              return <span>{t('dispatchRegions.breakdown.inactive', { count: inactive })}</span>;
            })()}
          />
        </Card>
      )}

      <DispatchRegionFormDialog
        isOpen={isDialogOpen}
        onClose={() => { setIsDialogOpen(false); setSelectedRegion(null); }}
        region={selectedRegion || undefined}
        nextSortOrder={nextSortOrder}
      />
    </div>
  );
}
