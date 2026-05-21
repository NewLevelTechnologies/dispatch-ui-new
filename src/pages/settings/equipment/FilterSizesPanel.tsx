import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  EllipsisVerticalIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import {
  tenantFilterSizesApi,
  type TenantFilterSize,
} from '../../../api';
import { Button } from '../../../components/catalyst/button';
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '../../../components/catalyst/dropdown';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '../../../components/catalyst/dialog';
import {
  Field,
  FieldGroup,
  Fieldset,
  Label,
} from '../../../components/catalyst/fieldset';
import { Input } from '../../../components/catalyst/input';
import ConfirmDialog from '../../../components/ConfirmDialog';
import IconButton from '../../../components/IconButton';
import { DragHandle } from '../../../components/settings/DragHandle';
import { Card, CardBody } from '../../../components/ui/Card';
import {
  DenseTable,
  DenseTHead,
  DenseRow,
} from '../../../components/ui/DenseTable';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import {
  ListSearch,
  ListToolbar,
} from '../../../components/ui/ListToolbar';
import { ListFooter } from '../../../components/ui/ListFooter';
import { LoadingState } from '../../../components/ui/LoadingState';
import { PageHead } from '../../../components/ui/PageHead';
import { extractApiError, showError, showSuccess } from '../../../lib/toast';
import { formatFilterSize } from '../../../utils/formatFilterSize';

const QUERY_KEY = ['tenant-filter-sizes'] as const;

// Accept "16x20x1", "16×20×1", "16 X 20 X 1", with decimals like 0.5 allowed.
// Anything else (slashes, dashes, missing parts) fails the format check.
function parseFilterSizeInput(
  raw: string,
): { lengthIn: number; widthIn: number; thicknessIn: number } | null {
  const parts = raw
    .trim()
    .split(/\s*[×xX]\s*/)
    .map((s) => s.trim());
  if (parts.length !== 3) return null;
  const nums = parts.map((p) => Number(p));
  if (!nums.every((n) => Number.isFinite(n) && n > 0)) return null;
  return { lengthIn: nums[0], widthIn: nums[1], thicknessIn: nums[2] };
}

function dimsKey(s: {
  lengthIn: number;
  widthIn: number;
  thicknessIn: number;
}): string {
  return `${s.lengthIn}×${s.widthIn}×${s.thicknessIn}`;
}

export default function FilterSizesPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  // null = closed; { item: null } = dialog open in create mode; { item: x } = edit.
  // Create mode is only used from the empty state — once the table has rows
  // the InlineAddRow handles new entries.
  const [formState, setFormState] = useState<{ item: TenantFilterSize | null } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TenantFilterSize | null>(null);
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const {
    data: items,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => tenantFilterSizesApi.getAll(),
  });

  const active = useMemo(
    () => (items ?? []).filter((s) => !s.archivedAt),
    [items],
  );

  const sorted = useMemo(
    () =>
      [...active].sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          a.lengthIn - b.lengthIn ||
          a.widthIn - b.widthIn ||
          a.thicknessIn - b.thicknessIn,
      ),
    [active],
  );

  const nextSortOrder =
    sorted.length > 0 ? Math.max(...sorted.map((i) => i.sortOrder)) + 1 : 0;

  const filteredSizes = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((s) =>
      formatFilterSize(s).toLowerCase().includes(needle),
    );
  }, [sorted, searchQuery]);

  const hasFilters = searchQuery.trim().length > 0;
  const clearSearch = () => setSearchQuery('');

  // ── Mutations ───────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tenantFilterSizesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      showSuccess(t('settings.filterSizes.toastDeleted'));
    },
    onError: (err) =>
      showError(t('settings.filterSizes.toastDeleteFailed'), extractApiError(err)),
  });

  const seedCommonMutation = useMutation({
    mutationFn: () => tenantFilterSizesApi.seedCommon(),
    onSuccess: ({ added }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      if (added > 0) {
        showSuccess(
          t('settings.filterSizes.seedSuccess', { count: added }),
        );
      } else {
        showSuccess(t('settings.filterSizes.seedSkipped'));
      }
    },
    onError: (err) =>
      showError(t('settings.filterSizes.toastSeedFailed'), extractApiError(err)),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => tenantFilterSizesApi.reorder(orderedIds),
    onSuccess: (updated) => queryClient.setQueryData(QUERY_KEY, updated),
    onError: (err) => {
      showError(
        t('settings.filterSizes.toastReorderFailed'),
        extractApiError(err),
      );
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const performReorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    if (from >= sorted.length || to >= sorted.length) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    reorderMutation.mutate(reordered.map((i) => i.id));
  };

  // ── Subtitle ────────────────────────────────────────────────

  const subtitle = sorted.length > 0
    ? t('settings.filterSizes.subtitle', { count: sorted.length })
    : null;

  return (
    <>
      <PageHead
        title={t('settings.filterSizes.title')}
        sub={subtitle}
        actions={
          <div className="flex items-center gap-2">
            <Dropdown>
              <DropdownButton
                as={IconButton}
                aria-label={t('common.moreOptions')}
              >
                <EllipsisVerticalIcon className="size-4" />
              </DropdownButton>
              <DropdownMenu anchor="bottom end">
                <DropdownItem onClick={() => setSeedDialogOpen(true)}>
                  <DropdownLabel>
                    {t('settings.filterSizes.seedCommon')}
                  </DropdownLabel>
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        }
      />

      {sorted.length > 0 && (
        <ListToolbar
          search={
            <ListSearch
              placeholder={t('settings.filterSizes.searchPlaceholder')}
              value={searchQuery}
              onChange={setSearchQuery}
            />
          }
        />
      )}

      <div className="mt-4 max-w-[680px]">
        <Card>
          <CardBody flush>
            {isLoading ? (
              <LoadingState label={t('settings.filterSizes.loading')} />
            ) : error ? (
              <ErrorState
                title={t('common.actions.couldNotLoad', {
                  entities: t('settings.filterSizes.title'),
                })}
                description={
                  extractApiError(error) ?? (error as Error).message
                }
                action={
                  <Button outline onClick={() => refetch()}>
                    {t('common.actions.tryAgain')}
                  </Button>
                }
              />
            ) : sorted.length === 0 ? (
              <EmptyState
                icon={<FunnelIcon className="size-10 text-fg-dim" />}
                title={t('settings.filterSizes.emptyTitle')}
                description={t('settings.filterSizes.emptyDescription')}
                action={
                  <div className="flex gap-2">
                    <Button
                      color="accent"
                      onClick={() => setFormState({ item: null })}
                    >
                      {t('settings.filterSizes.add')}
                    </Button>
                    <Button outline onClick={() => setSeedDialogOpen(true)}>
                      {t('settings.filterSizes.seedCommonCta')}
                    </Button>
                  </div>
                }
              />
            ) : hasFilters && filteredSizes.length === 0 ? (
              <EmptyState
                icon={<MagnifyingGlassIcon className="size-10 text-fg-dim" />}
                title={t('settings.filterSizes.noMatchTitle')}
                description={t('settings.filterSizes.noMatchDescription')}
                action={
                  <Button outline onClick={clearSearch}>
                    {t('settings.filterSizes.clearSearch')}
                  </Button>
                }
              />
            ) : (
              <>
                <DenseTable>
                  <DenseTHead>
                    <tr>
                      <th
                        style={{ width: 28 }}
                        className="hidden sm:table-cell"
                      ></th>
                      <th>{t('settings.filterSizes.size')}</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </DenseTHead>
                  <tbody>
                    {filteredSizes.map((item, index) => {
                      const isDragging = dragIndex === index;
                      const isDragOver =
                        dragOverIndex === index &&
                        dragIndex !== null &&
                        dragIndex !== index;
                      const isFirst = index === 0;
                      const isLast = index === filteredSizes.length - 1;
                      return (
                        <DenseRow
                          key={item.id}
                          draggable
                          onDragStart={(e: React.DragEvent) => {
                            setDragIndex(index);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e: React.DragEvent) => {
                            if (dragIndex === null) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (dragOverIndex !== index)
                              setDragOverIndex(index);
                          }}
                          onDragLeave={() => {
                            if (dragOverIndex === index)
                              setDragOverIndex(null);
                          }}
                          onDrop={(e: React.DragEvent) => {
                            e.preventDefault();
                            if (dragIndex !== null)
                              performReorder(dragIndex, index);
                            setDragIndex(null);
                            setDragOverIndex(null);
                          }}
                          onDragEnd={() => {
                            setDragIndex(null);
                            setDragOverIndex(null);
                          }}
                          className={[
                            isDragging && 'opacity-50',
                            isDragOver &&
                              'outline outline-2 outline-accent-500/40 outline-offset-[-2px]',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <td className="hidden sm:table-cell">
                            <DragHandle />
                          </td>
                          <td className="strong">{formatFilterSize(item)}</td>
                          <td className="right">
                            <Dropdown>
                              <DropdownButton
                                as={IconButton}
                                aria-label={t('common.moreOptions')}
                              >
                                <EllipsisVerticalIcon className="size-4" />
                              </DropdownButton>
                              <DropdownMenu anchor="bottom end">
                                {/* Mobile-only reorder. Drag handle is sm:hidden
                                    so the kebab is the only reorder affordance
                                    below the sm breakpoint. */}
                                <span className="contents sm:hidden">
                                  <DropdownItem
                                    onClick={() =>
                                      performReorder(index, index - 1)
                                    }
                                    disabled={isFirst}
                                  >
                                    <DropdownLabel>
                                      {t('common.moveUp')}
                                    </DropdownLabel>
                                  </DropdownItem>
                                  <DropdownItem
                                    onClick={() =>
                                      performReorder(index, index + 1)
                                    }
                                    disabled={isLast}
                                  >
                                    <DropdownLabel>
                                      {t('common.moveDown')}
                                    </DropdownLabel>
                                  </DropdownItem>
                                  <DropdownDivider />
                                </span>
                                <DropdownItem
                                  onClick={() => setFormState({ item })}
                                >
                                  <DropdownLabel>
                                    {t('common.actions.rename')}
                                  </DropdownLabel>
                                </DropdownItem>
                                <DropdownItem
                                  onClick={() => setPendingDelete(item)}
                                >
                                  <DropdownLabel>
                                    {t('common.delete')}
                                  </DropdownLabel>
                                </DropdownItem>
                              </DropdownMenu>
                            </Dropdown>
                          </td>
                        </DenseRow>
                      );
                    })}
                    {!hasFilters && (
                      <InlineAddRow
                        existing={sorted}
                        nextSortOrder={nextSortOrder}
                      />
                    )}
                  </tbody>
                </DenseTable>
                <ListFooter
                  left={t('settings.showingCount', {
                    count: filteredSizes.length,
                    noun: t('settings.filterSizes.nounPlural'),
                  })}
                />
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <FilterSizeFormDialog
        isOpen={formState !== null}
        onClose={() => setFormState(null)}
        item={formState?.item ?? null}
        nextSortOrder={nextSortOrder}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
        }}
        title={t('settings.filterSizes.deleteTitle', {
          name: pendingDelete ? formatFilterSize(pendingDelete) : '',
        })}
        message={t('settings.filterSizes.deleteBody')}
        confirmLabel={t('common.delete')}
        isDestructive
        isPending={deleteMutation.isPending}
      />

      <ConfirmDialog
        isOpen={seedDialogOpen}
        onClose={() => setSeedDialogOpen(false)}
        onConfirm={() => seedCommonMutation.mutate()}
        title={t('settings.filterSizes.seedCommonConfirmTitle')}
        message={t('settings.filterSizes.seedCommonConfirmBody')}
        confirmLabel={t('settings.filterSizes.seedCommon')}
        isPending={seedCommonMutation.isPending}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// InlineAddRow — last row in the table. Tap to expand into a single
// input that parses "16×20×1" → three numbers and posts. Enter
// re-focuses for rapid bulk entry; Esc / blur-empty closes.
// ─────────────────────────────────────────────────────────────────

interface InlineAddRowProps {
  existing: TenantFilterSize[];
  nextSortOrder: number;
}

function InlineAddRow({ existing, nextSortOrder }: InlineAddRowProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const createMutation = useMutation({
    mutationFn: (dims: {
      lengthIn: number;
      widthIn: number;
      thicknessIn: number;
    }) =>
      tenantFilterSizesApi.create({
        ...dims,
        sortOrder: nextSortOrder,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setValue('');
      setErr(null);
      // Stay in adding mode and refocus — rapid-entry pattern.
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    onError: (e) => {
      setErr(extractApiError(e) ?? t('settings.filterSizes.errorSave'));
    },
  });

  const reset = () => {
    setAdding(false);
    setValue('');
    setErr(null);
  };

  const submit = () => {
    setErr(null);
    const raw = value.trim();
    if (!raw) {
      reset();
      return;
    }
    const dims = parseFilterSizeInput(raw);
    if (!dims) {
      setErr(t('settings.filterSizes.invalidFormat'));
      return;
    }
    const newKey = dimsKey(dims);
    if (existing.some((s) => dimsKey(s) === newKey)) {
      setErr(
        t('settings.filterSizes.duplicateError', { name: newKey }),
      );
      return;
    }
    createMutation.mutate(dims);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      reset();
    }
  };

  const handleBlur = () => {
    // Blur-with-empty cancels; blur-with-text saves so the typed work
    // isn't lost. Don't reset if an error is showing — user needs to
    // fix the value, not lose it.
    if (err) return;
    if (!value.trim()) {
      reset();
      return;
    }
    submit();
  };

  if (!adding) {
    return (
      <tr>
        <td colSpan={3}>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="m-2 flex w-full items-center gap-1.5 rounded-md border border-dashed border-border-strong px-3 py-2 text-[12.5px] text-fg-muted hover:border-fg-muted hover:bg-bg-elev hover:text-fg-strong"
          >
            <PlusIcon className="size-3.5" />
            {t('settings.filterSizes.add')}
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="hidden sm:table-cell"></td>
      <td colSpan={2}>
        <form onSubmit={handleSubmit} className="px-2 py-1.5">
          <Input
            ref={inputRef}
            size="xs"
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (err) setErr(null);
            }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={t('settings.filterSizes.addPlaceholder')}
            disabled={createMutation.isPending}
            aria-label={t('settings.filterSizes.add')}
          />
          {err && (
            <div
              role="alert"
              className="mt-1 text-[11px] text-danger-500"
            >
              {err}
            </div>
          )}
        </form>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────
// FilterSizeFormDialog — edit (rename) flow, plus create mode from
// the empty-state Add button. Inline-add (table footer) is the
// rapid-entry path once at least one size exists.
// ─────────────────────────────────────────────────────────────────

interface FormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: TenantFilterSize | null;
  nextSortOrder: number;
}

function FilterSizeFormDialog({
  isOpen,
  onClose,
  item,
  nextSortOrder,
}: FormDialogProps) {
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
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      onClose();
    },
    onError: (err) =>
      setErrorMessage(
        extractApiError(err) ?? t('settings.filterSizes.errorSave'),
      ),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      tenantFilterSizesApi.update(item!.id, {
        lengthIn: Number(length),
        widthIn: Number(width),
        thicknessIn: Number(thickness),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      onClose();
    },
    onError: (err) =>
      setErrorMessage(
        extractApiError(err) ?? t('settings.filterSizes.errorSave'),
      ),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: FormEvent) => {
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
        {isEdit
          ? t('settings.filterSizes.titleEdit')
          : t('settings.filterSizes.titleAdd')}
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogBody>
          {errorMessage && (
            <div className="mb-4 rounded-lg bg-danger-100 p-3 text-[12.5px] text-danger-500 ring-1 ring-danger-500/20">
              {errorMessage}
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
          <Button type="submit" color="accent" disabled={isSaving}>
            {isSaving
              ? t('common.saving')
              : isEdit
                ? t('common.update')
                : t('common.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
