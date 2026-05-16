import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link as RouterLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { EllipsisVerticalIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import {
  workOrderApi,
  workOrderTypesApi,
  divisionsApi,
  workItemStatusesApi,
  dispatchRegionApi,
  type WorkOrderSummary,
  type ProgressCategory,
  type ListWorkOrdersParams,
} from '../api';
import { useGlossary } from '../contexts/GlossaryContext';
import AppLayout from '../components/AppLayout';
import WorkItemsCell from '../components/WorkItemsCell';
import WorkOrderFormDialog from '../components/WorkOrderFormDialog';
import CancelWorkOrderDialog from '../components/CancelWorkOrderDialog';
import { Button } from '../components/catalyst/button';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem, DropdownLabel, DropdownMenu } from '../components/catalyst/dropdown';
import { Input, InputGroup } from '../components/catalyst/input';
import { Select } from '../components/catalyst/select';
import { Checkbox, CheckboxField } from '../components/catalyst/checkbox';
import { Field, Label } from '../components/catalyst/fieldset';
import { PageHead } from '../components/ui/PageHead';
import { Card, CardBody } from '../components/ui/Card';
import { Pill } from '../components/ui/Pill';
import { ViewTabs } from '../components/ui/Tabs';
import { FilterChip } from '../components/ui/FilterChip';
import {
  DenseTable, DenseTHead, DenseRow, CellStack, CellTop, CellSub,
} from '../components/ui/DenseTable';
import { ListFooter } from '../components/ui/ListFooter';
import { dense } from '../components/ui/dense';

// ─── Filter constants ────────────────────────────────────────────────────────

type LifecycleTabId = 'active' | 'notStarted' | 'inProgress' | 'blocked' | 'completed' | 'cancelled' | 'all';

const DEFAULT_TAB: LifecycleTabId = 'active';

interface LifecycleTab {
  id: LifecycleTabId;
  labelKey: string;
  params: Pick<ListWorkOrdersParams, 'lifecycleState' | 'progressCategory'>;
}

const LIFECYCLE_TABS: LifecycleTab[] = [
  { id: 'active', labelKey: 'workOrders.filters.open', params: { lifecycleState: 'ACTIVE' } },
  { id: 'notStarted', labelKey: 'workOrders.filters.notStarted', params: { progressCategory: 'NOT_STARTED' } },
  { id: 'inProgress', labelKey: 'workOrders.filters.inProgress', params: { progressCategory: 'IN_PROGRESS' } },
  { id: 'blocked', labelKey: 'workOrders.filters.blocked', params: { progressCategory: 'BLOCKED' } },
  { id: 'completed', labelKey: 'workOrders.filters.completed', params: { progressCategory: 'COMPLETED' } },
  { id: 'cancelled', labelKey: 'workOrders.filters.cancelled', params: { lifecycleState: 'CANCELLED' } },
  { id: 'all', labelKey: 'workOrders.filters.all', params: {} },
];

type DatePreset = '' | 'today' | 'yesterday' | 'thisWeek' | 'last7' | 'thisMonth' | 'last30' | 'custom';

const DATE_PRESETS: { id: DatePreset; labelKey: string }[] = [
  { id: '', labelKey: 'workOrders.dates.any' },
  { id: 'today', labelKey: 'workOrders.dates.today' },
  { id: 'yesterday', labelKey: 'workOrders.dates.yesterday' },
  { id: 'thisWeek', labelKey: 'workOrders.dates.thisWeek' },
  { id: 'last7', labelKey: 'workOrders.dates.last7' },
  { id: 'thisMonth', labelKey: 'workOrders.dates.thisMonth' },
  { id: 'last30', labelKey: 'workOrders.dates.last30' },
  { id: 'custom', labelKey: 'workOrders.dates.custom' },
];

const PAGE_SIZE = 50;

type PillTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent' | 'violet';

const PROGRESS_TONES: Record<ProgressCategory, PillTone> = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'info',
  BLOCKED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

const PROGRESS_TRANSLATION_KEYS: Record<ProgressCategory, string> = {
  NOT_STARTED: 'notStarted',
  IN_PROGRESS: 'inProgress',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const PRIORITY_TONES: Record<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT', PillTone> = {
  LOW: 'neutral',
  NORMAL: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
};

const PRIORITY_TRANSLATION_KEYS: Record<string, string> = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
};

// ─── Date helpers ────────────────────────────────────────────────────────────

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rangeForPreset(preset: Exclude<DatePreset, '' | 'custom'>, today = new Date()): { from: string; to: string } {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;

  switch (preset) {
    case 'today':
      return { from: isoDay(t), to: isoDay(t) };
    case 'yesterday': {
      const y = new Date(t.getTime() - dayMs);
      return { from: isoDay(y), to: isoDay(y) };
    }
    case 'thisWeek': {
      const dow = t.getDay(); // 0 = Sunday
      const start = new Date(t.getTime() - dow * dayMs);
      const end = new Date(start.getTime() + 6 * dayMs);
      return { from: isoDay(start), to: isoDay(end) };
    }
    case 'last7': {
      const start = new Date(t.getTime() - 6 * dayMs);
      return { from: isoDay(start), to: isoDay(t) };
    }
    case 'thisMonth': {
      const start = new Date(t.getFullYear(), t.getMonth(), 1);
      const end = new Date(t.getFullYear(), t.getMonth() + 1, 0);
      return { from: isoDay(start), to: isoDay(end) };
    }
    case 'last30': {
      const start = new Date(t.getTime() - 29 * dayMs);
      return { from: isoDay(start), to: isoDay(t) };
    }
  }
}

function formatDate(dateString?: string | null) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function isCancelled(wo: WorkOrderSummary): boolean {
  return wo.lifecycleState === 'CANCELLED';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WorkOrdersPage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { getName } = useGlossary();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderSummary | null>(null);

  // ── Read filter state from URL ────────────────────────────────────────────
  const tabId = (searchParams.get('tab') as LifecycleTabId | null) ?? DEFAULT_TAB;
  const urlSearch = searchParams.get('search') ?? '';
  const typeId = searchParams.get('type') ?? '';
  const divisionId = searchParams.get('division') ?? '';
  const regionId = searchParams.get('region') ?? '';
  const itemStatusId = searchParams.get('itemStatus') ?? '';
  const datePreset = (searchParams.get('date') as DatePreset | null) ?? '';
  const customFrom = searchParams.get('from') ?? '';
  const customTo = searchParams.get('to') ?? '';
  const includeArchived = searchParams.get('archived') === 'true';
  const pageNumber = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  // Local search input state — mirrors URL for instant feedback. Written to the
  // URL synchronously on each keystroke (with replace so we don't flood history),
  // and `useDeferredValue` keeps the actual query from refetching on every key.
  const [searchInput, setSearchInput] = useState(urlSearch);
  const deferredSearch = useDeferredValue(searchInput);

  // Sync from URL → input when the URL changes via back/forward or elsewhere
  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  // ── URL writer ────────────────────────────────────────────────────────────
  // Pass null to remove a param; pass a string/number/true to set it.
  // Pass `replace: true` for high-frequency updates (typing) so the back button
  // doesn't have to step through every keystroke.
  function updateParams(
    updates: Record<string, string | number | boolean | null>,
    options: { replace?: boolean } = {}
  ) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '' || value === false) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    }
    setSearchParams(next, { replace: options.replace ?? false });
  }

  const handleSearchInputChange = (value: string) => {
    setSearchInput(value);
    updateParams({ search: value || null, page: null }, { replace: true });
  };

  // ── Tenant config queries (for filter dropdowns) ──────────────────────────
  const { data: workOrderTypes } = useQuery({
    queryKey: ['work-order-types'],
    queryFn: () => workOrderTypesApi.getAll(),
  });
  const { data: divisions } = useQuery({
    queryKey: ['divisions'],
    queryFn: () => divisionsApi.getAll(),
  });
  const { data: regions } = useQuery({
    queryKey: ['dispatch-regions'],
    queryFn: () => dispatchRegionApi.getAll(),
  });
  const { data: itemStatuses } = useQuery({
    queryKey: ['work-item-statuses'],
    queryFn: () => workItemStatusesApi.getAll(),
  });

  const activeTypes = (Array.isArray(workOrderTypes) ? workOrderTypes : []).filter((x) => x.isActive);
  const activeDivisions = (Array.isArray(divisions) ? divisions : []).filter((x) => x.isActive);
  const activeRegions = (Array.isArray(regions) ? regions : []).filter((x) => x.isActive !== false);
  const activeItemStatuses = (Array.isArray(itemStatuses) ? itemStatuses : []).filter((x) => x.isActive);

  // ── Resolve date range to send to the API ─────────────────────────────────
  const dateRange = useMemo<{ from?: string; to?: string }>(() => {
    if (datePreset === '') return {};
    if (datePreset === 'custom') return { from: customFrom || undefined, to: customTo || undefined };
    const r = rangeForPreset(datePreset);
    return { from: r.from, to: r.to };
  }, [datePreset, customFrom, customTo]);

  const tab = useMemo(
    () => LIFECYCLE_TABS.find((f) => f.id === tabId) ?? LIFECYCLE_TABS[0],
    [tabId]
  );

  // ── Build the API query params ────────────────────────────────────────────
  const queryParams: ListWorkOrdersParams = useMemo(
    () => ({
      ...tab.params,
      search: deferredSearch || undefined,
      workOrderTypeId: typeId || undefined,
      divisionId: divisionId || undefined,
      dispatchRegionId: regionId || undefined,
      workItemStatusId: itemStatusId || undefined,
      scheduledDateFrom: dateRange.from,
      scheduledDateTo: dateRange.to,
      includeArchived: includeArchived || undefined,
      page: pageNumber - 1, // URL is 1-based; backend Spring Page is 0-based
      size: PAGE_SIZE,
    }),
    [tab, deferredSearch, typeId, divisionId, regionId, itemStatusId, dateRange, includeArchived, pageNumber]
  );

  const { data: pageData, isLoading, error } = useQuery({
    queryKey: ['work-orders', queryParams],
    queryFn: () => workOrderApi.getAll(queryParams),
  });

  const workOrders: WorkOrderSummary[] = pageData?.content ?? [];
  const totalElements = pageData?.totalElements ?? 0;
  const totalPages = pageData?.totalPages ?? 0;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => workOrderApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => workOrderApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error && 'response' in err
        ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message)
        : undefined;
      alert(message || t('workOrders.actions.archiveError', { entity: getName('work_order') }));
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: (id: string) => workOrderApi.unarchive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error && 'response' in err
        ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message)
        : undefined;
      alert(message || t('workOrders.actions.unarchiveError', { entity: getName('work_order') }));
    },
  });

  const handleAdd = () => {
    setSelectedWorkOrder(null);
    setIsFormOpen(true);
  };

  const handleEdit = (workOrder: WorkOrderSummary) => {
    setSelectedWorkOrder(workOrder);
    setIsFormOpen(true);
  };

  const handleCancel = (workOrder: WorkOrderSummary) => {
    setSelectedWorkOrder(workOrder);
    setIsCancelOpen(true);
  };

  const handleArchiveToggle = (workOrder: WorkOrderSummary) => {
    if (workOrder.archivedAt) {
      unarchiveMutation.mutate(workOrder.id);
    } else {
      if (window.confirm(t('workOrders.actions.archiveConfirm', { entity: getName('work_order') }))) {
        archiveMutation.mutate(workOrder.id);
      }
    }
  };

  const handleDelete = (workOrder: WorkOrderSummary) => {
    if (window.confirm(t('common.actions.deleteConfirmGeneric', { entity: getName('work_order') }))) {
      deleteMutation.mutate(workOrder.id);
    }
  };

  const handleCloseForm = () => setIsFormOpen(false);
  const handleCloseCancel = () => setIsCancelOpen(false);

  // ── Active filter chips ───────────────────────────────────────────────────
  const lookupName = (id: string, list: { id: string; name: string }[]) =>
    list.find((x) => x.id === id)?.name ?? id;

  type ActiveChip = { key: string; label: string; value: string; onClear: () => void };
  const activeChips: ActiveChip[] = [];
  if (urlSearch) {
    activeChips.push({
      key: 'search',
      label: t('common.search').replace('...', ''),
      value: `"${urlSearch}"`,
      onClear: () => updateParams({ search: null, page: null }),
    });
  }
  if (typeId) {
    activeChips.push({
      key: 'type',
      label: t('workOrders.form.type'),
      value: lookupName(typeId, activeTypes),
      onClear: () => updateParams({ type: null, page: null }),
    });
  }
  if (divisionId) {
    activeChips.push({
      key: 'division',
      label: getName('division'),
      value: lookupName(divisionId, activeDivisions),
      onClear: () => updateParams({ division: null, page: null }),
    });
  }
  if (regionId) {
    activeChips.push({
      key: 'region',
      label: t('workOrders.filters.region'),
      value: lookupName(regionId, activeRegions),
      onClear: () => updateParams({ region: null, page: null }),
    });
  }
  if (itemStatusId) {
    activeChips.push({
      key: 'itemStatus',
      label: t('workOrders.filters.itemStatus'),
      value: lookupName(itemStatusId, activeItemStatuses),
      onClear: () => updateParams({ itemStatus: null, page: null }),
    });
  }
  if (datePreset !== '') {
    const presetLabel = datePreset === 'custom'
      ? `${customFrom || '…'} – ${customTo || '…'}`
      : t(DATE_PRESETS.find((p) => p.id === datePreset)?.labelKey ?? '');
    activeChips.push({
      key: 'date',
      label: t('workOrders.filters.scheduled'),
      value: presetLabel,
      onClear: () => updateParams({ date: null, from: null, to: null, page: null }),
    });
  }

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams());
    setSearchInput('');
  };

  // ── Tab options for ViewTabs (no per-tab counts available yet) ─────────────
  const viewTabs = LIFECYCLE_TABS.map((f) => ({ id: f.id, label: t(f.labelKey) }));

  const showingStart = totalElements === 0 ? 0 : (pageNumber - 1) * PAGE_SIZE + 1;
  const showingEnd = Math.min(pageNumber * PAGE_SIZE, totalElements);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div>
        <PageHead
          title={getName('work_order', true)}
          actions={
            <Button color="accent" onClick={handleAdd}>
              {t('common.actions.create', { entity: getName('work_order') })}
            </Button>
          }
        />

        {/* Filter bar */}
        <Card className="mb-3">
          <CardBody>
            <div className="flex flex-wrap items-end gap-2">
              <InputGroup className="min-w-[260px] flex-1">
                <MagnifyingGlassIcon data-slot="icon" />
                <Input
                  type="text"
                  placeholder={t('workOrders.filters.searchPlaceholder')}
                  value={searchInput}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  aria-label={t('common.search')}
                  className={dense.input}
                />
              </InputGroup>

              {activeTypes.length > 0 && (
                <div className="w-44">
                  <Select
                    aria-label={t('workOrders.form.type')}
                    value={typeId}
                    onChange={(e) => updateParams({ type: e.target.value || null, page: null })}
                    className={dense.select}
                  >
                    <option value="">{t('workOrders.filters.anyType')}</option>
                    {activeTypes.map((tx) => (
                      <option key={tx.id} value={tx.id}>{tx.name}</option>
                    ))}
                  </Select>
                </div>
              )}

              {activeDivisions.length > 0 && (
                <div className="w-44">
                  <Select
                    aria-label={getName('division')}
                    value={divisionId}
                    onChange={(e) => updateParams({ division: e.target.value || null, page: null })}
                    className={dense.select}
                  >
                    <option value="">{t('workOrders.filters.any', { entity: getName('division') })}</option>
                    {activeDivisions.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </Select>
                </div>
              )}

              {activeRegions.length > 0 && (
                <div className="w-44">
                  <Select
                    aria-label={t('workOrders.filters.region')}
                    value={regionId}
                    onChange={(e) => updateParams({ region: e.target.value || null, page: null })}
                    className={dense.select}
                  >
                    <option value="">{t('workOrders.filters.anyRegion')}</option>
                    {activeRegions.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </Select>
                </div>
              )}

              {activeItemStatuses.length > 0 && (
                <div className="w-44">
                  <Select
                    aria-label={t('workOrders.filters.itemStatus')}
                    value={itemStatusId}
                    onChange={(e) => updateParams({ itemStatus: e.target.value || null, page: null })}
                    className={dense.select}
                  >
                    <option value="">{t('workOrders.filters.anyItemStatus')}</option>
                    {activeItemStatuses.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </div>
              )}

              <div className="w-40">
                <Select
                  aria-label={t('workOrders.filters.scheduled')}
                  value={datePreset}
                  onChange={(e) => {
                    const next = e.target.value as DatePreset;
                    const updates: Record<string, string | null> = { date: next || null, page: null };
                    if (next !== 'custom') {
                      updates.from = null;
                      updates.to = null;
                    }
                    updateParams(updates);
                  }}
                  className={dense.select}
                >
                  {DATE_PRESETS.map((p) => (
                    <option key={p.id || 'any'} value={p.id}>{t(p.labelKey)}</option>
                  ))}
                </Select>
              </div>

              <CheckboxField className="ml-2 flex-none">
                <Checkbox
                  name="includeArchived"
                  checked={includeArchived}
                  onChange={(checked) => updateParams({ archived: checked ? 'true' : null, page: null })}
                />
                <Label className="text-sm">{t('workOrders.actions.showArchived')}</Label>
              </CheckboxField>

              {pageData && (
                <div className="ml-auto pb-2 text-[11.5px] text-fg-muted tnum">
                  {totalElements} {totalElements === 1 ? getName('work_order').toLowerCase() : getName('work_order', true).toLowerCase()}
                </div>
              )}
            </div>

            {/* Custom date range inputs */}
            {datePreset === 'custom' && (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <Field className="w-44">
                  <Label className="text-xs text-fg-muted">{t('workOrders.dates.from')}</Label>
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => updateParams({ from: e.target.value || null, page: null })}
                    className={dense.input}
                  />
                </Field>
                <Field className="w-44">
                  <Label className="text-xs text-fg-muted">{t('workOrders.dates.to')}</Label>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => updateParams({ to: e.target.value || null, page: null })}
                    className={dense.input}
                  />
                </Field>
              </div>
            )}

            {/* Active filter chips */}
            {activeChips.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {activeChips.map((chip) => (
                  <FilterChip
                    key={chip.key}
                    label={chip.label}
                    value={chip.value}
                    onClear={chip.onClear}
                  />
                ))}
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="ml-1 text-[11.5px] font-medium text-fg-muted underline-offset-2 hover:underline hover:text-fg-strong"
                >
                  {t('workOrders.filters.clearAll')}
                </button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Lifecycle / progress tabs */}
        <ViewTabs
          className="mb-3"
          value={tabId}
          onChange={(id) => updateParams({ tab: id === DEFAULT_TAB ? null : id, page: null })}
          tabs={viewTabs}
        />

        {isLoading && (
          <Card>
            <CardBody>
              <p className="text-[12.5px] text-fg-muted text-center">
                {t('common.actions.loading', { entities: getName('work_order', true) })}
              </p>
            </CardBody>
          </Card>
        )}

        {error && (
          <Card className="border-danger-500/40 bg-danger-100/40">
            <CardBody>
              <p className="text-[12.5px] text-danger-500">
                {t('common.actions.errorLoading', { entities: getName('work_order', true) })}: {(error as Error).message}
              </p>
            </CardBody>
          </Card>
        )}

        {pageData && workOrders.length === 0 && activeChips.length === 0 && tabId === DEFAULT_TAB && (
          <Card>
            <CardBody>
              <p className="text-[12.5px] text-fg-muted">
                {t('common.actions.notFound', { entities: getName('work_order', true) })}
              </p>
              <Button className="mt-2" onClick={handleAdd}>
                {t('common.actions.createFirst', { entity: getName('work_order') })}
              </Button>
            </CardBody>
          </Card>
        )}

        {pageData && workOrders.length === 0 && (activeChips.length > 0 || tabId !== DEFAULT_TAB) && (
          <Card>
            <CardBody>
              <p className="text-[12.5px] text-fg-muted">
                {t('common.actions.noMatchSearch', { entities: getName('work_order', true) })}
              </p>
              {activeChips.length > 0 && (
                <Button plain className="mt-2" onClick={clearAllFilters}>
                  {t('workOrders.filters.clearAll')}
                </Button>
              )}
            </CardBody>
          </Card>
        )}

        {workOrders.length > 0 && (
          <Card>
            <CardBody flush>
              <DenseTable>
                <DenseTHead>
                  <tr>
                    <th>{t('workOrders.table.id')}</th>
                    <th>{getName('service_location')}</th>
                    <th>{t('workOrders.table.work')}</th>
                    <th>{t('workOrders.table.type')}</th>
                    <th>{t('workOrders.table.statusHeader')}</th>
                    <th>{t('workOrders.table.priority')}</th>
                    <th>{t('workOrders.table.scheduled')}</th>
                    <th></th>
                  </tr>
                </DenseTHead>
                <tbody>
                  {workOrders.map((workOrder) => {
                    const cancelled = isCancelled(workOrder);
                    const archived = !!workOrder.archivedAt;
                    const completed = workOrder.progressCategory === 'COMPLETED';
                    const dimmed = cancelled || archived;
                    return (
                      <DenseRow key={workOrder.id} className={dimmed ? 'opacity-60' : undefined}>
                        <td>
                          <CellStack>
                            <CellTop>
                              <RouterLink
                                to={`/work-orders/${workOrder.id}`}
                                className="id-mono strong hover:text-accent-500 hover:underline"
                              >
                                {workOrder.workOrderNumber || `#${workOrder.id.substring(0, 8)}`}
                              </RouterLink>
                            </CellTop>
                            {archived && (
                              <CellSub>{t('workOrders.actions.archived')}</CellSub>
                            )}
                          </CellStack>
                        </td>
                        <td>
                          <CellStack>
                            <CellTop>
                              {workOrder.serviceLocation?.locationName || workOrder.customer?.name || '-'}
                            </CellTop>
                            <CellSub>
                              {workOrder.serviceLocation?.address.streetAddress || ''}{' '}
                              {workOrder.serviceLocation?.address.city || ''}, {workOrder.serviceLocation?.address.state || ''}
                            </CellSub>
                          </CellStack>
                        </td>
                        <td>
                          <WorkItemsCell
                            items={workOrder.workItems}
                            totalCount={workOrder.workItemCount}
                          />
                        </td>
                        <td className="muted">
                          {activeTypes.find((tp) => tp.id === workOrder.workOrderTypeId)?.name ?? '—'}
                        </td>
                        <td>
                          {cancelled ? (
                            <CellStack>
                              <CellTop><Pill tone="neutral">{t('workOrders.actions.cancelledBadge')}</Pill></CellTop>
                              {workOrder.cancelledAt && (
                                <CellSub>
                                  {t('workOrders.table.cancelledOn', { date: formatDate(workOrder.cancelledAt) })}
                                </CellSub>
                              )}
                            </CellStack>
                          ) : (
                            <Pill tone={PROGRESS_TONES[workOrder.progressCategory]} dot>
                              {t(`workOrders.progress.${PROGRESS_TRANSLATION_KEYS[workOrder.progressCategory]}`)}
                            </Pill>
                          )}
                        </td>
                        <td>
                          <Pill tone={PRIORITY_TONES[workOrder.priority ?? 'NORMAL']}>
                            {t(`workOrders.priority.${PRIORITY_TRANSLATION_KEYS[workOrder.priority ?? 'NORMAL']}`)}
                          </Pill>
                        </td>
                        <td className="muted">
                          {formatDate(workOrder.scheduledDate)}
                        </td>
                        <td>
                          <Dropdown>
                            <DropdownButton plain aria-label={t('common.moreOptions')}>
                              <EllipsisVerticalIcon className="size-5" />
                            </DropdownButton>
                            <DropdownMenu anchor="bottom end">
                              <DropdownItem onClick={() => handleEdit(workOrder)}>
                                <DropdownLabel>{cancelled ? t('common.view') : t('common.edit')}</DropdownLabel>
                              </DropdownItem>
                              {!cancelled && !completed && (
                                <DropdownItem onClick={() => handleCancel(workOrder)}>
                                  <DropdownLabel>{t('workOrders.actions.cancel', { entity: getName('work_order') })}</DropdownLabel>
                                </DropdownItem>
                              )}
                              <DropdownItem onClick={() => handleArchiveToggle(workOrder)}>
                                <DropdownLabel>
                                  {archived ? t('workOrders.actions.unarchive') : t('workOrders.actions.archive')}
                                </DropdownLabel>
                              </DropdownItem>
                              <DropdownDivider />
                              <DropdownItem onClick={() => handleDelete(workOrder)}>
                                <DropdownLabel>{t('common.delete')}</DropdownLabel>
                              </DropdownItem>
                            </DropdownMenu>
                          </Dropdown>
                        </td>
                      </DenseRow>
                    );
                  })}
                </tbody>
              </DenseTable>

              {/* Pagination: onClick mutates URL via updateParams. NOTE: this
                  drops the previous href-preserving behavior (no middle-click
                  open-in-new-tab). For prod, ListFooter would need href
                  support. Acceptable for the design-system experiment. */}
              {totalElements > 0 && (
                <ListFooter
                  page={pageNumber}
                  totalPages={Math.max(1, totalPages)}
                  showing={[showingStart, showingEnd]}
                  total={totalElements}
                  perPage={PAGE_SIZE}
                  perPageOptions={[PAGE_SIZE]}
                  onPageChange={(p) => updateParams({ page: p > 1 ? p : null })}
                  labels={{
                    showing: (s, e, tot) => (
                      <>
                        {t('common.pagination.showing', { start: s, end: e, total: tot })}
                      </>
                    ),
                    prev: t('common.previous'),
                    next: t('common.next'),
                    rowsPerPage: t('common.actions.rowsPerPage'),
                  }}
                />
              )}
            </CardBody>
          </Card>
        )}

        <WorkOrderFormDialog
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          workOrder={selectedWorkOrder}
        />

        <CancelWorkOrderDialog
          isOpen={isCancelOpen}
          onClose={handleCloseCancel}
          workOrder={selectedWorkOrder}
        />
      </div>
    </AppLayout>
  );
}
