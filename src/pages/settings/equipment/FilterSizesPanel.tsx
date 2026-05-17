import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  tenantFilterSizesApi,
  getApiErrorMessage,
  type TenantFilterSize,
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
import IconButton from '../../../components/IconButton';
import { Field, FieldGroup, Fieldset, Label } from '../../../components/catalyst/fieldset';
import { Input } from '../../../components/catalyst/input';
import { EllipsisVerticalIcon } from '@heroicons/react/16/solid';
import { formatFilterSize } from '../../../utils/formatFilterSize';
import { Card, CardBody } from '../../../components/ui/Card';
import { DenseTable, DenseTHead, DenseRow } from '../../../components/ui/DenseTable';
import { SettingsListFooter } from '../../../components/settings/SettingsListFooter';
import { DragHandle } from '../../../components/settings/DragHandle';

const QUERY_KEY = ['tenant-filter-sizes'] as const;


export default function FilterSizesPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canEdit = useHasCapability('EDIT_SETTINGS');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selected, setSelected] = useState<TenantFilterSize | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const { data: items, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => tenantFilterSizesApi.getAll(),
  });
  const active = (items ?? []).filter((s) => !s.archivedAt);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tenantFilterSizesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (err: unknown) => {
      alert(getApiErrorMessage(err) || t('settings.filterSizes.errorDelete'));
    },
  });

  const seedCommonMutation = useMutation({
    mutationFn: () => tenantFilterSizesApi.seedCommon(),
    onSuccess: ({ added, skipped }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      // Tell the user what happened — added=10 first time, skipped=10 if
      // they hit it again. Idempotent on the backend, so we don't need a
      // confirm prompt; just surface the result.
      alert(t('settings.filterSizes.seedResult', { added, skipped }));
    },
    onError: (err: unknown) => {
      alert(getApiErrorMessage(err) || t('settings.filterSizes.errorSeed'));
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => tenantFilterSizesApi.reorder(orderedIds),
    onSuccess: (updated) => queryClient.setQueryData(QUERY_KEY, updated),
    onError: (err: unknown) => {
      alert(getApiErrorMessage(err) || t('settings.filterSizes.errorReorder'));
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const sorted = [...active].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.lengthIn - b.lengthIn ||
      a.widthIn - b.widthIn ||
      a.thicknessIn - b.thicknessIn
  );
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
  const handleEdit = (item: TenantFilterSize) => {
    setSelected(item);
    setIsDialogOpen(true);
  };
  const handleDelete = (item: TenantFilterSize) => {
    if (window.confirm(t('settings.taxonomy.deleteConfirm', { name: formatFilterSize(item) }))) {
      deleteMutation.mutate(item.id);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <Heading>{t('settings.filterSizes.title')}</Heading>
          <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {t('settings.filterSizes.description')}
          </Text>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              plain
              onClick={() => seedCommonMutation.mutate()}
              disabled={seedCommonMutation.isPending}
              title={t('settings.filterSizes.seedCommonHelp')}
            >
              {seedCommonMutation.isPending
                ? t('common.saving')
                : t('settings.filterSizes.seedCommon')}
            </Button>
            <Button color="accent" onClick={handleAdd}>{t('settings.filterSizes.add')}</Button>
          </div>
        )}
      </div>

      {isLoading && <Text>{t('settings.filterSizes.loading')}</Text>}
      {error && (
        <Text className="text-red-600">
          {getApiErrorMessage(error) || t('settings.filterSizes.errorLoad')}
        </Text>
      )}
      {items && active.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
          <Text className="text-zinc-600 dark:text-zinc-400">
            {t('settings.filterSizes.empty')}
          </Text>
          {canEdit && (
            <div className="mt-3">
              <Button
                onClick={() => seedCommonMutation.mutate()}
                disabled={seedCommonMutation.isPending}
              >
                {seedCommonMutation.isPending
                  ? t('common.saving')
                  : t('settings.filterSizes.seedCommonCta')}
              </Button>
            </div>
          )}
        </div>
      )}

      {sorted.length > 0 && (
        <Card>
          <CardBody flush>
            <DenseTable>
              <DenseTHead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>{t('settings.filterSizes.size')}</th>
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
                      <td className="strong">{formatFilterSize(item)}</td>
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
            noun={t('settings.filterSizes.nounPlural')}
          />
        </Card>
      )}

      <FilterSizeFormDialog
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
  item: TenantFilterSize | null;
  nextSortOrder: number;
}

function FilterSizeFormDialog({ isOpen, onClose, item, nextSortOrder }: FormDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEdit = Boolean(item);

  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [thickness, setThickness] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setLength(item ? String(item.lengthIn) : '');
    setWidth(item ? String(item.widthIn) : '');
    setThickness(item ? String(item.thicknessIn) : '');
  }, [isOpen, item]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const createMutation = useMutation({
    mutationFn: () =>
      tenantFilterSizesApi.create({
        lengthIn: Number(length),
        widthIn: Number(width),
        thicknessIn: Number(thickness),
        sortOrder: nextSortOrder,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-filter-sizes'] });
      onClose();
    },
    onError: (err: unknown) => {
      setErrorMessage(getApiErrorMessage(err) || t('settings.filterSizes.errorSave'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      tenantFilterSizesApi.update(item!.id, {
        lengthIn: Number(length),
        widthIn: Number(width),
        thicknessIn: Number(thickness),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-filter-sizes'] });
      onClose();
    },
    onError: (err: unknown) => {
      setErrorMessage(getApiErrorMessage(err) || t('settings.filterSizes.errorSave'));
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const l = Number(length);
    const w = Number(width);
    const th = Number(thickness);
    if (![l, w, th].every((n) => Number.isFinite(n) && n > 0)) {
      setErrorMessage(t('settings.filterSizes.invalidDimensions'));
      return;
    }
    if (isEdit) updateMutation.mutate();
    else createMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} size="md">
      <DialogTitle>
        {isEdit ? t('settings.filterSizes.titleEdit') : t('settings.filterSizes.titleAdd')}
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogBody>
          {errorMessage && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 ring-1 ring-red-200 dark:bg-red-950/10 dark:ring-red-900/20">
              <p className="text-sm text-red-800 dark:text-red-400">{errorMessage}</p>
            </div>
          )}
          <Fieldset>
            <FieldGroup className="!space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Field>
                  <Label>{t('settings.filterSizes.length')} *</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.25"
                    min="0"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    required
                    autoFocus
                  />
                </Field>
                <Field>
                  <Label>{t('settings.filterSizes.width')} *</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.25"
                    min="0"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <Label>{t('settings.filterSizes.thickness')} *</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.25"
                    min="0"
                    value={thickness}
                    onChange={(e) => setThickness(e.target.value)}
                    required
                  />
                </Field>
              </div>
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
