import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getApiErrorMessage } from '../../api';
import type {
  TaxonomyItem,
  CreateTaxonomyItemRequest,
  UpdateTaxonomyItemRequest,
} from '../../api';
import { useHasCapability } from '../../hooks/useCurrentUser';
import { Heading } from '../catalyst/heading';
import { Text } from '../catalyst/text';
import { Button } from '../catalyst/button';
import { Dropdown, DropdownButton, DropdownItem, DropdownMenu } from '../catalyst/dropdown';
import { EllipsisVerticalIcon } from '@heroicons/react/16/solid';
import IconButton from '../IconButton';
import { Card, CardBody } from '../ui/Card';
import { DenseTable, DenseTHead, DenseRow } from '../ui/DenseTable';
import { SettingsListFooter } from './SettingsListFooter';
import { DragHandle } from './DragHandle';
import TaxonomyFormDialog from './TaxonomyFormDialog';

interface TaxonomyApi {
  getAll: () => Promise<TaxonomyItem[]>;
  create: (req: CreateTaxonomyItemRequest) => Promise<TaxonomyItem>;
  update: (id: string, req: UpdateTaxonomyItemRequest) => Promise<TaxonomyItem>;
  delete: (id: string) => Promise<void>;
  reorder: (orderedIds: string[]) => Promise<TaxonomyItem[]>;
}

interface Props {
  title: string;
  description: string;
  entityLabel: string;
  entityLabelPlural: string;
  api: TaxonomyApi;
  queryKey: string[];
}

export default function TaxonomyManager({
  title,
  description,
  entityLabel,
  entityLabelPlural,
  api,
  queryKey,
}: Props) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const canEdit = useHasCapability('EDIT_SETTINGS');

  const [selectedItem, setSelectedItem] = useState<TaxonomyItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const { data: items, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => api.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error: unknown) => {
      alert(getApiErrorMessage(error) || t('settings.taxonomy.errorDelete', { entity: entityLabel.toLowerCase() }));
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => api.reorder(orderedIds),
    onSuccess: (updated) => queryClient.setQueryData(queryKey, updated),
    onError: (error: unknown) => {
      alert(getApiErrorMessage(error) || t('settings.taxonomy.errorReorder', { entity: entityLabel.toLowerCase() }));
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleAdd = () => {
    setSelectedItem(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (item: TaxonomyItem) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
  };

  const handleDelete = (item: TaxonomyItem) => {
    if (window.confirm(t('settings.taxonomy.deleteConfirm', { name: item.name }))) {
      deleteMutation.mutate(item.id);
    }
  };

  const sorted = items
    ? [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    : [];

  const nextSortOrder = sorted.length > 0
    ? Math.max(...sorted.map((i) => i.sortOrder)) + 1
    : 0;

  const performReorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= sorted.length || to >= sorted.length) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    reorderMutation.mutate(reordered.map((i) => i.id));
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <Heading>{title}</Heading>
          <Text className="text-sm text-fg-muted mt-1">{description}</Text>
        </div>
        {canEdit && (
          <Button color="accent" onClick={handleAdd}>
            {t('common.actions.add', { entity: entityLabel })}
          </Button>
        )}
      </div>

      {isLoading && <Text>{t('common.actions.loading', { entities: entityLabelPlural })}</Text>}
      {error && (
        <Text className="text-danger-500">
          {getApiErrorMessage(error) || t('common.actions.errorLoading', { entities: entityLabelPlural })}
        </Text>
      )}
      {items && items.length === 0 && (
        <Text>{t('common.actions.notFound', { entities: entityLabelPlural })}</Text>
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
                  <th style={{ width: 40 }}></th>
                </tr>
              </DenseTHead>
              <tbody>
                {sorted.map((item, index) => {
                  const isDragging = dragIndex === index;
                  const isDragOver = dragOverIndex === index && dragIndex !== null && dragIndex !== index;
                  return (
                    <DenseRow
                      key={item.id}
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
                          {item.color && (
                            <span
                              aria-hidden
                              className="inline-block h-2.5 w-2.5 rounded-full border border-border shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                          )}
                          <span className="strong">{item.name}</span>
                        </div>
                        {item.description && (
                          <div className="muted mt-0.5">{item.description}</div>
                        )}
                      </td>
                      <td><span className="font-mono text-fg-muted">{item.code}</span></td>
                      <td className="right">
                        {canEdit && (
                          <Dropdown>
                            <DropdownButton as={IconButton} aria-label={t('common.moreOptions')}>
                              <EllipsisVerticalIcon className="size-4" />
                            </DropdownButton>
                            <DropdownMenu anchor="bottom end">
                              <DropdownItem onClick={() => handleEdit(item)}>
                                {t('common.edit')}
                              </DropdownItem>
                              <DropdownItem onClick={() => handleDelete(item)}>
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
          <SettingsListFooter count={sorted.length} noun={entityLabelPlural.toLowerCase()} />
        </Card>
      )}

      <TaxonomyFormDialog
        isOpen={isDialogOpen}
        onClose={() => { setIsDialogOpen(false); setSelectedItem(null); }}
        entityLabel={entityLabel}
        api={api}
        queryKey={queryKey}
        item={selectedItem || undefined}
        nextSortOrder={nextSortOrder}
      />
    </div>
  );
}
