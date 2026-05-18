import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  equipmentTypesApi,
  equipmentCategoriesApi,
  getApiErrorMessage,
  type EquipmentCategory,
} from '../../../api';
import { useHasCapability } from '../../../hooks/useCurrentUser';
import { Heading } from '../../../components/catalyst/heading';
import { Text } from '../../../components/catalyst/text';
import { Button } from '../../../components/catalyst/button';
import { Select } from '../../../components/catalyst/select';
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
} from '../../../components/catalyst/dropdown';
import { Dialog, DialogActions, DialogBody, DialogTitle } from '../../../components/catalyst/dialog';
import IconButton from '../../../components/IconButton';
import { Field, FieldGroup, Fieldset, Label } from '../../../components/catalyst/fieldset';
import { Input } from '../../../components/catalyst/input';
import { EllipsisVerticalIcon } from '@heroicons/react/16/solid';
import { Card, CardBody } from '../../../components/ui/Card';
import { DenseTable, DenseTHead, DenseRow } from '../../../components/ui/DenseTable';
import { SettingsListFooter } from '../../../components/settings/SettingsListFooter';
import { DragHandle } from '../../../components/settings/DragHandle';

const TYPES_KEY = ['equipment-types'] as const;
const categoriesKey = (typeId: string) => ['equipment-categories', typeId] as const;

export default function EquipmentCategoriesPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canEdit = useHasCapability('EDIT_SETTINGS');

  const [typeId, setTypeId] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selected, setSelected] = useState<EquipmentCategory | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const { data: types } = useQuery({
    queryKey: TYPES_KEY,
    queryFn: () => equipmentTypesApi.getAll(),
  });

  // Default the type selector to the first type once types load.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!typeId && types && types.length > 0) {
      setTypeId(types[0].id);
    }
  }, [types, typeId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const { data: categories, isLoading, error } = useQuery({
    queryKey: categoriesKey(typeId),
    queryFn: () => equipmentCategoriesApi.getAll(typeId),
    enabled: Boolean(typeId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => equipmentCategoriesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoriesKey(typeId) }),
    onError: (err: unknown) => {
      alert(getApiErrorMessage(err) || t('settings.equipmentCategories.errorDelete'));
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => equipmentCategoriesApi.reorder(typeId, orderedIds),
    onSuccess: (updated) => queryClient.setQueryData(categoriesKey(typeId), updated),
    onError: (err: unknown) => {
      alert(getApiErrorMessage(err) || t('settings.equipmentCategories.errorReorder'));
      queryClient.invalidateQueries({ queryKey: categoriesKey(typeId) });
    },
  });

  const sorted = categories
    ? [...categories].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
      )
    : [];
  const nextSortOrder =
    sorted.length > 0 ? Math.max(...sorted.map((i) => i.sortOrder)) + 1 : 0;

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
  const handleEdit = (item: EquipmentCategory) => {
    setSelected(item);
    setIsDialogOpen(true);
  };
  const handleDelete = (item: EquipmentCategory) => {
    if (window.confirm(t('settings.taxonomy.deleteConfirm', { name: item.name }))) {
      deleteMutation.mutate(item.id);
    }
  };

  const noTypes = types && types.length === 0;

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <Heading>{t('settings.equipmentCategories.title')}</Heading>
          <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {t('settings.equipmentCategories.description')}
          </Text>
        </div>
        {canEdit && !noTypes && (
          <Button color="accent" onClick={handleAdd} disabled={!typeId}>
            {t('settings.equipmentCategories.add')}
          </Button>
        )}
      </div>

      {noTypes ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
          <Text className="text-zinc-600 dark:text-zinc-400">
            {t('settings.equipmentCategories.noTypesYet')}
          </Text>
        </div>
      ) : (
        <>
          <div className="mb-4 max-w-sm">
            <Field>
              <Label className="text-xs">
                {t('settings.equipmentCategories.parentType')}
              </Label>
              <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                {(types ?? []).map((tp) => (
                  <option key={tp.id} value={tp.id}>
                    {tp.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {isLoading && <Text>{t('settings.equipmentCategories.loading')}</Text>}
          {error && (
            <Text className="text-red-600">
              {getApiErrorMessage(error) || t('settings.equipmentCategories.errorLoad')}
            </Text>
          )}
          {categories && categories.length === 0 && (
            <Text>{t('settings.equipmentCategories.empty')}</Text>
          )}

          {sorted.length > 0 && (
            <Card>
              <CardBody flush>
                <DenseTable>
                  <DenseTHead>
                    <tr>
                      <th style={{ width: 32 }}></th>
                      <th>{t('common.form.name')}</th>
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
                          <td className="strong">{item.name}</td>
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
                noun={t('settings.equipmentCategories.nounPlural')}
              />
            </Card>
          )}
        </>
      )}

      <EquipmentCategoryFormDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelected(null);
        }}
        equipmentTypeId={typeId}
        item={selected}
        nextSortOrder={nextSortOrder}
      />
    </div>
  );
}

interface FormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  equipmentTypeId: string;
  item: EquipmentCategory | null;
  nextSortOrder: number;
}

function EquipmentCategoryFormDialog({
  isOpen,
  onClose,
  equipmentTypeId,
  item,
  nextSortOrder,
}: FormDialogProps) {
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

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['equipment-categories', equipmentTypeId] });

  const createMutation = useMutation({
    mutationFn: () =>
      equipmentCategoriesApi.create({
        equipmentTypeId,
        name: name.trim(),
        sortOrder: nextSortOrder,
      }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err: unknown) => {
      setErrorMessage(getApiErrorMessage(err) || t('settings.equipmentCategories.errorSave'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => equipmentCategoriesApi.update(item!.id, { name: name.trim() }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err: unknown) => {
      setErrorMessage(getApiErrorMessage(err) || t('settings.equipmentCategories.errorSave'));
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
        {isEdit
          ? t('settings.equipmentCategories.titleEdit')
          : t('settings.equipmentCategories.titleAdd')}
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
