import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  equipmentTypesApi,
  equipmentCategoriesApi,
  getApiErrorMessage,
  type EquipmentType,
} from '../../../api';
import { useHasCapability } from '../../../hooks/useCurrentUser';
import { Heading } from '../../../components/catalyst/heading';
import { Text } from '../../../components/catalyst/text';
import { Button } from '../../../components/catalyst/button';
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
} from '../../../components/catalyst/dropdown';
import { Dialog, DialogActions, DialogBody, DialogTitle } from '../../../components/catalyst/dialog';
import { Field, FieldGroup, Fieldset, Label } from '../../../components/catalyst/fieldset';
import { Input } from '../../../components/catalyst/input';
import { EllipsisVerticalIcon } from '@heroicons/react/16/solid';
import IconButton from '../../../components/IconButton';
import { Card, CardBody } from '../../../components/ui/Card';
import { DenseTable, DenseTHead, DenseRow } from '../../../components/ui/DenseTable';
import { SettingsListFooter } from '../../../components/settings/SettingsListFooter';
import { DragHandle } from '../../../components/settings/DragHandle';

const QUERY_KEY = ['equipment-types'] as const;
const CATEGORIES_QUERY_KEY = ['equipment-categories', 'all'] as const;

export default function EquipmentTypesPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canEdit = useHasCapability('EDIT_SETTINGS');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selected, setSelected] = useState<EquipmentType | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const { data: items, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => equipmentTypesApi.getAll(),
  });

  const { data: allCategories } = useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: () => equipmentCategoriesApi.getAll(),
  });

  const categoryCountByType = useMemo(() => {
    const counts: Record<string, number> = {};
    (allCategories ?? []).forEach((c) => {
      counts[c.equipmentTypeId] = (counts[c.equipmentTypeId] ?? 0) + 1;
    });
    return counts;
  }, [allCategories]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => equipmentTypesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (err: unknown) => {
      alert(getApiErrorMessage(err) || t('settings.equipmentTypes.errorDelete'));
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => equipmentTypesApi.reorder(orderedIds),
    onSuccess: (updated) => queryClient.setQueryData(QUERY_KEY, updated),
    onError: (err: unknown) => {
      alert(getApiErrorMessage(err) || t('settings.equipmentTypes.errorReorder'));
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const sorted = items
    ? [...items].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
      )
    : [];
  const nextSortOrder = sorted.length > 0 ? Math.max(...sorted.map((i) => i.sortOrder)) + 1 : 0;

  const performReorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= sorted.length || to >= sorted.length) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    reorderMutation.mutate(reordered.map((i) => i.id));
  };

  const handleAdd = () => {
    setSelected(null);
    setIsDialogOpen(true);
  };
  const handleEdit = (item: EquipmentType) => {
    setSelected(item);
    setIsDialogOpen(true);
  };
  const handleDelete = (item: EquipmentType) => {
    if (window.confirm(t('settings.taxonomy.deleteConfirm', { name: item.name }))) {
      deleteMutation.mutate(item.id);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <Heading>{t('settings.equipmentTypes.title')}</Heading>
          <Text className="mt-1 text-sm text-fg-muted">
            {t('settings.equipmentTypes.description')}
          </Text>
        </div>
        {canEdit && (
          <Button color="accent" onClick={handleAdd}>{t('settings.equipmentTypes.add')}</Button>
        )}
      </div>

      {isLoading && <Text>{t('settings.equipmentTypes.loading')}</Text>}
      {error && (
        <Text className="text-danger-500">
          {getApiErrorMessage(error) || t('settings.equipmentTypes.errorLoad')}
        </Text>
      )}
      {items && items.length === 0 && <Text>{t('settings.equipmentTypes.empty')}</Text>}

      {sorted.length > 0 && (
        <Card>
          <CardBody flush>
            <DenseTable>
              <DenseTHead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>{t('common.form.name')}</th>
                  <th className="right">{t('settings.equipmentTypes.table.categories')}</th>
                  <th className="right">{t('settings.equipmentTypes.table.items')}</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </DenseTHead>
              <tbody>
                {sorted.map((item, index) => {
                  const categoryCount = categoryCountByType[item.id] ?? 0;
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
                      <td className="strong">{item.name}</td>
                      <td className="right num">
                        <button
                          type="button"
                          onClick={() => navigate('/settings/equipment/categories')}
                          className="inline-flex items-center gap-1 text-fg hover:text-accent-700 dark:hover:text-accent-300"
                        >
                          <span>{categoryCount}</span>
                          <span className="text-fg-dim">→</span>
                        </button>
                      </td>
                      <td className="right num text-fg-dim">—</td>
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
          <SettingsListFooter
            count={sorted.length}
            noun={t('settings.equipmentTypes.title').toLowerCase()}
          />
        </Card>
      )}

      <EquipmentTypeFormDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelected(null);
        }}
        item={selected}
        nextSortOrder={nextSortOrder}
      />
    </div>
  );
}

interface FormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: EquipmentType | null;
  nextSortOrder: number;
}

function EquipmentTypeFormDialog({ isOpen, onClose, item, nextSortOrder }: FormDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEdit = Boolean(item);

  const [name, setName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setName(item?.name ?? '');
  }, [isOpen, item]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const createMutation = useMutation({
    mutationFn: () => equipmentTypesApi.create({ name: name.trim(), sortOrder: nextSortOrder }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      onClose();
    },
    onError: (err: unknown) => {
      setErrorMessage(getApiErrorMessage(err) || t('settings.equipmentTypes.errorSave'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => equipmentTypesApi.update(item!.id, { name: name.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      onClose();
    },
    onError: (err: unknown) => {
      setErrorMessage(getApiErrorMessage(err) || t('settings.equipmentTypes.errorSave'));
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!name.trim()) {
      setErrorMessage(t('common.form.required', { field: t('common.form.name') }));
      return;
    }
    if (isEdit) updateMutation.mutate();
    else createMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} size="md">
      <DialogTitle>
        {isEdit ? t('settings.equipmentTypes.titleEdit') : t('settings.equipmentTypes.titleAdd')}
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogBody>
          {errorMessage && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 ring-1 ring-red-200 dark:bg-red-950/10 dark:ring-red-900/20">
              <p className="text-sm text-red-800 dark:text-red-400">{errorMessage}</p>
            </div>
          )}
          <Fieldset>
            <FieldGroup>
              <Field>
                <Label>{t('common.form.name')} *</Label>
                <Input
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </Field>
            </FieldGroup>
          </Fieldset>
        </DialogBody>
        <DialogActions>
          <Button plain onClick={onClose} disabled={isSaving}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? t('common.saving') : isEdit ? t('common.update') : t('common.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
