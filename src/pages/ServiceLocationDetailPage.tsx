/* eslint-disable i18next/no-literal-string -- dense visual detail page; entity names + major strings go through getName()/t(), but inline glyphs, separators, and short operational labels are kept as literals to keep the dense markup readable (same convention as UserDetailPage). */
import type React from 'react';
import { useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  MapPinIcon,
  EllipsisVerticalIcon,
  PlusIcon,
  WrenchScrewdriverIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  UserIcon,
  ReceiptPercentIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import {
  customerApi,
  equipmentApi,
  EquipmentStatus,
  type Equipment,
  type EquipmentSummary,
  type ServiceLocationSearchResult,
} from '../api';
import { workOrdersListQueryOptions } from '../api/workOrdersListQuery';
import { useGlossary } from '../contexts/GlossaryContext';
import { useHasCapability } from '../hooks/useCurrentUser';
import { formatPhone } from '../utils/formatPhone';
import { titleCaseAddress } from '../utils/titleCaseAddress';
import { extractApiError, showError, showInfo, showSuccess } from '../lib/toast';
import AppLayout from '../components/AppLayout';
import ServiceLocationFormDialog from '../components/ServiceLocationFormDialog';
import EquipmentFormDialog from '../components/EquipmentFormDialog';
import WorkOrderFormDialog from '../components/WorkOrderFormDialog';
import WorkOrdersList from '../components/WorkOrdersList';
import NotificationLogsList from '../components/NotificationLogsList';
import AdditionalContactsList from '../components/AdditionalContactsList';
import ConfirmDialog from '../components/ConfirmDialog';
import IconButton from '../components/IconButton';
import { Card } from '../components/catalyst/card';
import { Button } from '../components/catalyst/button';
import { Heading } from '../components/catalyst/heading';
import { Dropdown, DropdownButton, DropdownItem, DropdownLabel, DropdownMenu } from '../components/catalyst/dropdown';
import { Pill } from '../components/ui/Pill';
import { Callout } from '../components/ui/Callout';
import { Tabs } from '../components/ui/Tabs';
import type { ServiceLocationDetailDto } from '../api/customerApi';
import {
  mockAttention,
  mockUpcomingVisits,
  mockActivityFeed,
  mockEquipmentHealth,
  type MockTone,
} from './serviceLocationDetailMocks';

type TabId = 'overview' | 'equipment' | 'jobs' | 'visits' | 'contacts' | 'files' | 'activity';

// ─────────────────────────────────────────────────────────────────────────
// Smart back-link. Up-direction is dynamic — users land here from a work
// order, the parent customer, the Locations list, or search. The linking
// surface writes `?from=…`; we read it back. Default (cold link / refresh) is
// the parent customer. The browser back button is always independent of this.
// ─────────────────────────────────────────────────────────────────────────
function useBackContext(location: ServiceLocationDetailDto): { label: string; href: string } {
  const [params] = useSearchParams();
  const from = (params.get('from') || '').toLowerCase();

  if (from.startsWith('wo-')) {
    const id = from.toUpperCase();
    return { label: id, href: `/work-orders/${id}` };
  }
  if (from === 'locations') {
    return { label: 'All locations', href: '/service-locations' };
  }
  if (from === 'search') {
    const q = params.get('q');
    return { label: q ? `Search results · “${q}”` : 'Search results', href: '/search' };
  }
  // 'customer' and default both resolve to the parent customer.
  return { label: location.customerName, href: `/customers/${location.customerId}` };
}

export default function ServiceLocationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { getName } = useGlossary();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEquipmentDialogOpen, setIsEquipmentDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [isNewWorkOrderOpen, setIsNewWorkOrderOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const canEditServiceLocations = useHasCapability('EDIT_SERVICE_LOCATIONS');
  const canCloseServiceLocations = useHasCapability('CLOSE_SERVICE_LOCATIONS');

  const { data: location, isLoading, error } = useQuery({
    queryKey: ['service-location', id],
    queryFn: () => customerApi.getServiceLocationById(id!),
    enabled: !!id,
  });

  const { data: workOrdersData } = useQuery(
    workOrdersListQueryOptions({ serviceLocationId: location?.id ?? '' })
  );

  const { data: equipmentPage } = useQuery({
    queryKey: ['equipment', { serviceLocationId: id }],
    queryFn: () => equipmentApi.list({ serviceLocationId: id!, status: EquipmentStatus.ACTIVE, size: 100 }),
    enabled: !!id,
  });
  const equipment: EquipmentSummary[] = useMemo(() => equipmentPage?.content ?? [], [equipmentPage]);

  const deleteEquipmentMutation = useMutation({
    mutationFn: (equipmentId: string) => equipmentApi.delete(equipmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment', { serviceLocationId: id }] });
      // WO detail + list caches embed workItems[].equipment summaries.
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders-list'] });
    },
    onError: (err) => showError(t('common.form.errorDelete', { entity: getName('equipment') }), extractApiError(err) ?? undefined),
  });

  const handleEditEquipment = async (item: EquipmentSummary) => {
    const full = await equipmentApi.getById(item.id);
    setEditingEquipment(full);
    setIsEquipmentDialogOpen(true);
  };

  const handleDeleteEquipment = (item: EquipmentSummary) => {
    if (window.confirm(t('common.actions.deleteConfirm', { name: item.name }))) {
      deleteEquipmentMutation.mutate(item.id);
    }
  };

  const closeLocationMutation = useMutation({
    mutationFn: () => customerApi.closeServiceLocation(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-location', id] });
      queryClient.invalidateQueries({ queryKey: ['service-locations'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      showSuccess(t('serviceLocations.actions.closed', { defaultValue: 'Location closed' }));
    },
    onError: (err) => showError(t('common.form.errorUpdate', { entity: getName('service_location') }), extractApiError(err) ?? undefined),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-[12.5px] text-fg-muted">
          {t('common.actions.loading', { entities: getName('service_location', true) })}
        </div>
      </AppLayout>
    );
  }

  if (error || !location) {
    return (
      <AppLayout>
        <div className="p-8">
          <Callout kind="danger">
            {t('common.actions.errorLoadingEntity', { entity: getName('service_location') })}
            {error && `: ${(error as Error).message}`}
          </Callout>
          <Button className="mt-4" onClick={() => navigate('/service-locations')}>
            {t('common.actions.backTo', { entities: getName('service_location', true) })}
          </Button>
        </div>
      </AppLayout>
    );
  }

  const headline = location.locationName || location.customerName;
  const contactCount = location.additionalContacts.length + (location.siteContactName ? 1 : 0);

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: t('serviceLocations.tabs.overview') },
    { id: 'equipment', label: getName('equipment', true), count: equipmentPage?.totalElements ?? equipment.length },
    { id: 'jobs', label: getName('work_order', true), count: workOrdersData?.totalElements ?? 0 },
    { id: 'visits', label: getName('dispatch', true), count: mockUpcomingVisits.length },
    { id: 'contacts', label: 'Contacts', count: contactCount },
    { id: 'files', label: 'Files' },
    { id: 'activity', label: t('serviceLocations.tabs.activity') },
  ];

  return (
    <AppLayout>
      <div className="px-1 py-1">
        <div className="mx-auto max-w-[1240px]">
          <BackLink location={location} />

          <LocationHeader
            location={location}
            headline={headline}
            onNewJob={() => setIsNewWorkOrderOpen(true)}
            onEdit={canEditServiceLocations ? () => setIsEditDialogOpen(true) : undefined}
            onClose={
              canCloseServiceLocations && location.status !== 'CLOSED'
                ? () => setConfirmClose(true)
                : undefined
            }
          />

          <div className="mb-3.5">
            <Tabs value={activeTab} onChange={(tabId) => setActiveTab(tabId as TabId)} tabs={tabs} />
          </div>

          {activeTab === 'overview' && (
            <OverviewTab
              location={location}
              equipment={equipment}
              onViewEquipment={() => setActiveTab('equipment')}
              onViewJobs={() => setActiveTab('jobs')}
              onNewJob={() => setIsNewWorkOrderOpen(true)}
              onEdit={canEditServiceLocations ? () => setIsEditDialogOpen(true) : undefined}
              canEdit={canEditServiceLocations}
            />
          )}

          {activeTab === 'equipment' && (
            <EquipmentTab
              equipment={equipment}
              total={equipmentPage?.totalElements ?? equipment.length}
              onAdd={() => {
                setEditingEquipment(null);
                setIsEquipmentDialogOpen(true);
              }}
              onEdit={handleEditEquipment}
              onDelete={handleDeleteEquipment}
            />
          )}

          {activeTab === 'jobs' && (
            <Card
              title={<CardTitle icon={<ChartBarIcon className="size-3.5" />}>{getName('work_order', true)}</CardTitle>}
              action={
                <Button plain onClick={() => setIsNewWorkOrderOpen(true)}>
                  <PlusIcon className="size-4" />
                  {t('common.actions.new', { entity: getName('work_order') })}
                </Button>
              }
              padding="none"
            >
              <div className="p-3.5">
                <WorkOrdersList serviceLocationId={location.id} showLocation={false} />
              </div>
            </Card>
          )}

          {activeTab === 'visits' && <TabStub label={getName('dispatch', true)} />}
          {activeTab === 'contacts' && <TabStub label="Contacts" />}
          {activeTab === 'files' && <TabStub label="Files" />}

          {activeTab === 'activity' && (
            <Card title={t('serviceLocations.tabs.activity')} padding="none">
              <div className="p-3.5">
                <NotificationLogsList entityType="SERVICE_LOCATION" entityId={location.id} />
              </div>
            </Card>
          )}

          <CloseFooter
            location={location}
            headline={headline}
            onClose={
              canCloseServiceLocations && location.status !== 'CLOSED'
                ? () => setConfirmClose(true)
                : undefined
            }
          />
        </div>
      </div>

      <ServiceLocationFormDialog
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        serviceLocation={location}
        customerId={location.customerId}
      />

      <EquipmentFormDialog
        isOpen={isEquipmentDialogOpen}
        onClose={() => {
          setIsEquipmentDialogOpen(false);
          setEditingEquipment(null);
        }}
        equipment={editingEquipment}
        lockedServiceLocationId={location.id}
      />

      <WorkOrderFormDialog
        isOpen={isNewWorkOrderOpen}
        onClose={() => setIsNewWorkOrderOpen(false)}
        prefilledServiceLocation={
          {
            id: location.id,
            customerId: location.customerId,
            customerName: location.customerName,
            locationName: location.locationName ?? null,
            address: {
              streetAddress: location.address.streetAddress,
              city: location.address.city,
              state: location.address.state,
              zipCode: location.address.zipCode,
            },
            siteContactName: location.siteContactName ?? null,
            siteContactPhone: location.siteContactPhone ?? null,
            status: 'ACTIVE',
          } satisfies ServiceLocationSearchResult
        }
      />

      <ConfirmDialog
        isOpen={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={() => closeLocationMutation.mutate()}
        title={t('serviceLocations.actions.closeConfirm', { name: headline })}
        message="Stops new jobs at this site. Equipment, visit history, files and notes are preserved. The parent customer is unaffected."
        confirmLabel={t('serviceLocations.actions.close', { defaultValue: 'Close location' })}
        isDestructive
        isPending={closeLocationMutation.isPending}
      />
    </AppLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Back-link
// ─────────────────────────────────────────────────────────────────────────
function BackLink({ location }: { location: ServiceLocationDetailDto }) {
  const ctx = useBackContext(location);
  return (
    <Link
      to={ctx.href}
      className="mb-2.5 inline-flex max-w-[600px] items-center gap-1 truncate text-[11.5px] text-fg-muted hover:text-fg-strong"
    >
      ← {ctx.label}
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Header card — pin mark, name, status / priority / agreement pills, meta, actions
// ─────────────────────────────────────────────────────────────────────────
function LocationHeader({
  location,
  headline,
  onNewJob,
  onEdit,
  onClose,
}: {
  location: ServiceLocationDetailDto;
  headline: string;
  onNewJob: () => void;
  onEdit?: () => void;
  onClose?: () => void;
}) {
  const { t } = useTranslation();
  const { getName } = useGlossary();

  const statusTone: MockTone | 'neutral' =
    location.status === 'ACTIVE' ? 'success' : location.status === 'INACTIVE' ? 'neutral' : 'neutral';
  const statusLabel = t(`serviceLocations.status.${location.status.toLowerCase()}`);

  const street = [location.address.streetAddress, location.address.streetAddressLine2].filter(Boolean).join(' ');
  const stateZip = [location.address.state, location.address.zipCode].filter(Boolean).join(' ');
  const fullAddress = [titleCaseAddress(street), titleCaseAddress(location.address.city), stateZip]
    .filter(Boolean)
    .join(', ');
  const regionLabel = location.region?.abbreviation || location.region?.name || null;

  // Meta items — render only what exists. sq ft / hours / priority are deferred
  // to the Add/Edit Location pass (no writer yet), so they're intentionally absent.
  const meta: React.ReactNode[] = [];
  if (fullAddress) meta.push(<span key="addr">{fullAddress}</span>);
  if (regionLabel) meta.push(<span key="region" className="font-mono">{regionLabel}</span>);

  return (
    <div className="mb-3 flex flex-col gap-3 rounded-[10px] border border-border bg-bg-elev px-4 py-3.5 shadow-sm sm:flex-row sm:items-center sm:gap-3.5">
      <LocationMark />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Heading level={1} size="page-sm" className="m-0">
            {headline}
          </Heading>
          <Pill tone={statusTone === 'neutral' ? 'neutral' : 'success'} dot live={location.status === 'ACTIVE'}>
            {statusLabel}
          </Pill>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-fg-muted">
          {meta.map((node, i) => (
            <span key={i} className="flex items-center gap-x-2.5">
              {i > 0 && <span className="text-fg-dim">·</span>}
              {node}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-1.5 max-sm:w-full max-sm:[&>*]:flex-1 sm:flex-shrink-0">
        <Button outline size="xs" onClick={onNewJob}>
          <PlusIcon className="size-4" />
          {t('common.actions.new', { entity: getName('work_order') })}
        </Button>
        <Button outline size="xs" onClick={() => showInfo('Visit scheduling isn’t available yet')}>
          Schedule visit
        </Button>
        {(onEdit || onClose) && (
          <Dropdown>
            <DropdownButton as={IconButton} aria-label={t('common.moreOptions')}>
              <EllipsisVerticalIcon className="size-4" />
            </DropdownButton>
            <DropdownMenu anchor="bottom end">
              {onEdit && (
                <DropdownItem onClick={onEdit}>
                  <DropdownLabel>{t('common.edit')}</DropdownLabel>
                </DropdownItem>
              )}
              {onClose && (
                <DropdownItem onClick={onClose}>
                  <DropdownLabel>{t('serviceLocations.actions.close', { defaultValue: 'Close location' })}</DropdownLabel>
                </DropdownItem>
              )}
            </DropdownMenu>
          </Dropdown>
        )}
        {onEdit && (
          <Button color="accent" size="xs" onClick={onEdit}>
            {t('common.edit')}
          </Button>
        )}
      </div>
    </div>
  );
}

// Square mark with a pin glyph — distinguishes a location (pin) from a
// customer (square initials) and a user (round avatar).
function LocationMark() {
  return (
    <div className="grid size-[52px] shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-info-500 to-[color-mix(in_oklch,var(--info-500)_70%,black)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.12)]">
      <MapPinIcon className="size-[22px]" />
    </div>
  );
}

function CardTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      {icon && <span className="text-fg-muted">{icon}</span>}
      {children}
    </span>
  );
}

function CardLink({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="text-[11px] font-medium text-fg-accent hover:underline">
      {children}
    </button>
  );
}

function TabStub({ label }: { label: string }) {
  return (
    <Card padding="none">
      <div className="px-5 py-14 text-center">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
          Not in this design pass
        </div>
        <div className="text-[14px] font-semibold text-fg-strong">{label}</div>
        <div className="mt-1 text-[12px] text-fg-muted">Coming soon.</div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Overview tab
// ─────────────────────────────────────────────────────────────────────────
function OverviewTab({
  location,
  equipment,
  onViewEquipment,
  onViewJobs,
  onNewJob,
  onEdit,
  canEdit,
}: {
  location: ServiceLocationDetailDto;
  equipment: EquipmentSummary[];
  onViewEquipment: () => void;
  onViewJobs: () => void;
  onNewJob: () => void;
  onEdit?: () => void;
  canEdit: boolean;
}) {
  const attentionItems = buildAttentionItems(location);

  return (
    <div className="flex flex-col gap-3">
      {attentionItems.length > 0 && <AttentionStrip items={attentionItems} />}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_340px]">
        {/* Left rail — operational */}
        <div className="flex flex-col gap-3">
          <EquipmentSummaryCard equipment={equipment} onViewAll={onViewEquipment} onNewJob={onNewJob} />
          <SiteWorkOrdersCard location={location} onViewAll={onViewJobs} onNewJob={onNewJob} />
          <UpcomingVisitsCard />
          <OperationalActivityCard />
        </div>

        {/* Right rail — reference / pre-arrival */}
        <div className="flex flex-col gap-3">
          <SiteInstructionsCard location={location} onEdit={canEdit ? onEdit : undefined} />
          <SiteContactCard location={location} canEdit={canEdit} />
          <ParentCustomerCard location={location} />
          <TagsCard location={location} />
          <NotesCard location={location} />
        </div>
      </div>
    </div>
  );
}

type AttentionItem = {
  key: string;
  severity: 'live' | 'warning';
  title: string;
  sub: string;
  action: string;
};

// Visibility of the live-tech and open-jobs rows is gated on the REAL detail
// flags (location.techOnSite / location.hasOpenJobs). Their descriptive detail
// (tech name / WO / since, open-job counts) still comes from mockAttention —
// that detail lives in dispatch / work-order services that aren't wired here.
// PM-overdue and equipment-flagged rows remain fully mock (scheduling +
// equipment-health services not built). Agreement SLA context was dropped (no
// agreement service exists).
function buildAttentionItems(location: ServiceLocationDetailDto): AttentionItem[] {
  const a = mockAttention;
  const items: AttentionItem[] = [];

  if (location.techOnSite && a.techOnSite) {
    items.push({
      key: 'live',
      severity: 'live',
      title: `${a.techOnSite.name} on site · ${a.techOnSite.job.id}`,
      sub: `${a.techOnSite.job.title} · on-site ${a.techOnSite.since} · ${a.techOnSite.eta}`,
      action: 'Open job',
    });
  }
  if (location.hasOpenJobs) {
    const remainingCritical = a.openCritical - (location.techOnSite ? 1 : 0);
    items.push({
      key: 'critical',
      severity: 'warning',
      title:
        remainingCritical > 0
          ? `${remainingCritical} open critical ${remainingCritical === 1 ? 'job' : 'jobs'}`
          : 'Open jobs at this site',
      sub: 'Critical priority',
      action: 'Open jobs',
    });
  }
  if (a.pmOverdueDays > 0) {
    items.push({
      key: 'pm',
      severity: 'warning',
      title: `PM overdue · ${a.pmOverdueDays} days`,
      sub: `Next quarterly visit was due ${a.pmOverdueDays}d ago`,
      action: 'Schedule',
    });
  }
  if (a.equipmentFlagged > 0) {
    items.push({
      key: 'equip',
      severity: 'warning',
      title: `${a.equipmentFlagged} equipment flagged for attention`,
      sub: a.equipmentFlaggedDetail,
      action: 'Review',
    });
  }
  const rank = { live: 0, warning: 1 } as const;
  return items.sort((x, y) => rank[x.severity] - rank[y.severity]);
}

function AttentionStrip({ items }: { items: AttentionItem[] }) {
  return (
    <Card padding="none">
      <div className="flex items-center gap-2 border-b border-border-soft px-3.5 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-fg">Needs attention</span>
        <span className="rounded bg-bg-active px-1.5 font-mono text-[10.5px] font-semibold text-fg-strong">
          {items.length}
        </span>
      </div>
      <div>
        {items.map((it, i) => (
          <div
            key={it.key}
            className={`relative flex items-center gap-2.5 py-1.5 pl-3 pr-3.5 ${i < items.length - 1 ? 'border-b border-border-soft' : ''}`}
          >
            <span
              className="absolute inset-y-1.5 left-0 w-[3px] rounded"
              style={{ background: it.severity === 'warning' ? 'var(--warning-500)' : 'var(--info-500)' }}
            />
            <div className="flex grow flex-wrap items-baseline gap-2 leading-normal">
              {it.severity === 'live' && <LivePulse />}
              <span
                className="text-[12.5px] font-semibold"
                style={{ color: it.severity === 'warning' ? 'var(--warning-fg)' : 'var(--fg-strong)' }}
              >
                {it.title}
              </span>
              <span className="text-[11.5px] text-fg-muted">· {it.sub}</span>
            </div>
            <Button outline size="xxs" className="shrink-0" onClick={() => showInfo('Not available yet')}>
              {it.action}
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function LivePulse() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-[color-mix(in_oklch,var(--info-500)_14%,transparent)] px-1.5 text-[10px] font-bold tracking-wider text-info-500">
      <span className="size-1.5 animate-pulse rounded-full bg-info-500" />
      LIVE
    </span>
  );
}

function EquipmentSummaryCard({
  equipment,
  onViewAll,
  onNewJob,
}: {
  equipment: EquipmentSummary[];
  onViewAll: () => void;
  onNewJob: () => void;
}) {
  const { getName } = useGlossary();

  const byType = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const e of equipment) {
      const type = e.equipmentTypeName || 'Other';
      acc[type] = (acc[type] || 0) + 1;
    }
    return acc;
  }, [equipment]);

  // Flagged rows — derived from MOCK health until equipment-service carries it.
  const flagged = useMemo(
    () => equipment.map((e, i) => ({ e, h: mockEquipmentHealth(i) })).filter((x) => x.h.flag),
    [equipment]
  );

  return (
    <Card
      title={<CardTitle icon={<WrenchScrewdriverIcon className="size-3.5" />}>{getName('equipment', true)}</CardTitle>}
      action={<CardLink onClick={onViewAll}>View all {equipment.length} →</CardLink>}
      padding="none"
    >
      {equipment.length === 0 ? (
        <div className="px-3.5 py-6 text-center text-[12px] text-fg-muted">
          {getName('equipment', true)} not recorded at this site yet.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 border-b border-border-soft bg-bg-elev-2 px-3.5 py-2.5">
            {Object.entries(byType).map(([type, n]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className="font-mono text-[12px] font-bold tabular-nums text-fg-strong">{n}</span>
                <span className="text-[11.5px] text-fg-muted">{type}</span>
              </div>
            ))}
            <span className="grow" />
            {flagged.length > 0 && (
              <Pill tone="warning" dot>
                {flagged.length} flagged
              </Pill>
            )}
          </div>
          {flagged.length > 0 && (
            <div>
              <div className="px-3.5 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
                Flagged
              </div>
              {flagged.map(({ e, h }, i) => (
                <div
                  key={e.id}
                  className={`grid grid-cols-[110px_1fr_auto] items-center gap-3 px-3.5 py-2 ${i < flagged.length - 1 ? 'border-b border-border-soft' : ''}`}
                >
                  <div>
                    <div className="font-mono text-[12px] font-bold text-fg-strong">{e.name}</div>
                    <div className="text-[11px] text-fg-muted">{e.locationOnSite || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[12.5px] font-medium text-fg-strong">
                      {[e.make, e.model].filter(Boolean).join(' ') || e.equipmentTypeName || '—'}
                    </div>
                    {h.flag && (
                      <div
                        className="mt-0.5 text-[11.5px] font-medium"
                        style={{ color: h.flag.tone === 'warning' ? 'var(--warning-fg)' : 'var(--fg-accent)' }}
                      >
                        {h.flag.text}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <Button plain size="xxs" href={`/equipment/${e.id}`}>
                      Details
                    </Button>
                    {h.flag?.tone === 'warning' && (
                      <Button outline size="xxs" onClick={onNewJob}>
                        New job
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// The site's work-order list (open + recent). Title pulls the tenant glossary
// term — a location almost always has 0–1 active job, so this is a record list,
// not a "jobs in flight" dashboard.
function SiteWorkOrdersCard({
  location,
  onViewAll,
  onNewJob,
}: {
  location: ServiceLocationDetailDto;
  onViewAll: () => void;
  onNewJob: () => void;
}) {
  const { getName } = useGlossary();
  const { t } = useTranslation();
  return (
    <Card
      title={<CardTitle icon={<ChartBarIcon className="size-3.5" />}>{getName('work_order', true)}</CardTitle>}
      subtitle="Open and recent"
      action={
        <div className="flex items-center gap-2">
          <CardLink onClick={onViewAll}>View all →</CardLink>
          <Button plain size="xxs" onClick={onNewJob}>
            <PlusIcon className="size-3.5" />
            {t('common.actions.new', { entity: getName('work_order') })}
          </Button>
        </div>
      }
      padding="none"
    >
      <div className="p-3.5">
        <WorkOrdersList serviceLocationId={location.id} showLocation={false} />
      </div>
    </Card>
  );
}

function UpcomingVisitsCard() {
  const { getName } = useGlossary();
  return (
    <Card
      title={<CardTitle icon={<CalendarDaysIcon className="size-3.5" />}>Upcoming {getName('dispatch', true)}</CardTitle>}
      action={<MockBadge />}
      padding="none"
    >
      {mockUpcomingVisits.map((v, i) => (
        <div
          key={i}
          className={`grid grid-cols-[78px_72px_1fr_auto] items-center gap-3 px-3.5 py-2.5 ${i < mockUpcomingVisits.length - 1 ? 'border-b border-border-soft' : ''}`}
        >
          <div>
            <div className="text-[12px] font-semibold text-fg-strong">{v.date}</div>
            <div className="font-mono text-[11px] text-fg-muted">{v.time}</div>
          </div>
          <Pill tone={v.tone === 'neutral' ? 'neutral' : v.tone} dot live={v.live}>
            {v.kind}
          </Pill>
          <div>
            <div className="text-[12px] font-medium text-fg-strong">{v.job}</div>
            <div className="text-[11px] text-fg-muted">Tech {v.tech}</div>
          </div>
        </div>
      ))}
    </Card>
  );
}

const ACTIVITY_GLYPH_STYLE: Record<MockTone, { bg: string; fg: string }> = {
  info: { bg: 'var(--bg-active)', fg: 'var(--fg-muted)' },
  success: { bg: 'color-mix(in oklch, var(--success-500) 14%, transparent)', fg: 'var(--success-500)' },
  warning: { bg: 'color-mix(in oklch, var(--warning-500) 14%, transparent)', fg: 'var(--warning-fg)' },
  accent: { bg: 'color-mix(in oklch, var(--accent-500) 14%, transparent)', fg: 'var(--accent-700)' },
  neutral: { bg: 'var(--bg-active)', fg: 'var(--fg-muted)' },
};

function OperationalActivityCard() {
  return (
    <Card
      title={<CardTitle icon={<ChartBarIcon className="size-3.5" />}>Recent activity at this site</CardTitle>}
      action={<MockBadge />}
      padding="none"
    >
      {mockActivityFeed.map((e, i) => {
        const s = ACTIVITY_GLYPH_STYLE[e.tone];
        return (
          <div
            key={i}
            className={`grid grid-cols-[60px_22px_1fr] items-center gap-2.5 px-3.5 py-2 ${i < mockActivityFeed.length - 1 ? 'border-b border-border-soft' : ''}`}
          >
            <span className="text-[11px] text-fg-dim">{e.ts}</span>
            <div
              className="flex size-[18px] items-center justify-center rounded text-[11px] font-bold"
              style={{ background: s.bg, color: s.fg }}
            >
              {e.glyph}
            </div>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-[12.5px] font-medium text-fg-strong">{e.text}</span>
              <span className="text-[11px] text-fg-dim">· {e.sub}</span>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

// Small "MOCK" badge for cards backed entirely by placeholder data, so reviewers
// can tell at a glance which sections are awaiting a backend.
function MockBadge() {
  return (
    <span
      title="Placeholder data — awaiting backend"
      className="rounded bg-bg-active px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-fg-dim"
    >
      Mock
    </span>
  );
}

function SiteInstructionsCard({
  location,
  onEdit,
}: {
  location: ServiceLocationDetailDto;
  onEdit?: () => void;
}) {
  // Free-form arrival prose — REAL (accessInstructions). The structured
  // label/value facts (gate code, lockbox, etc.) are deferred to the Add/Edit
  // Location pass (no writer yet), so only the prose renders for now.
  return (
    <Card
      title={<CardTitle icon={<MapPinIcon className="size-3.5" />}>Site instructions</CardTitle>}
      action={onEdit ? <CardLink onClick={onEdit}>Edit</CardLink> : undefined}
    >
      {location.accessInstructions ? (
        <div className="text-[12px] leading-relaxed text-fg">{location.accessInstructions}</div>
      ) : (
        <div className="text-[12px] text-fg-muted">No site instructions yet.</div>
      )}
    </Card>
  );
}

function SiteContactCard({
  location,
  canEdit,
}: {
  location: ServiceLocationDetailDto;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const hasSiteContact = location.siteContactName || location.siteContactPhone || location.siteContactEmail;
  const showContacts = location.additionalContacts.length > 0 || canEdit;

  return (
    <Card title={<CardTitle icon={<UserIcon className="size-3.5" />}>{t('serviceLocations.detail.siteContact')}</CardTitle>}>
      {hasSiteContact ? (
        <div className="space-y-0.5">
          {location.siteContactName && (
            <div className="text-[13px] font-semibold text-fg-strong">{location.siteContactName}</div>
          )}
          {location.siteContactPhone && (
            <a href={`tel:${location.siteContactPhone}`} className="block font-mono text-[11.5px] text-fg-muted hover:text-fg-strong hover:underline">
              {formatPhone(location.siteContactPhone)}
            </a>
          )}
          {location.siteContactEmail && (
            <a href={`mailto:${location.siteContactEmail}`} className="block font-mono text-[11.5px] text-fg-muted hover:text-fg-strong hover:underline">
              {location.siteContactEmail}
            </a>
          )}
        </div>
      ) : (
        <div className="text-[12px] text-fg-muted">No site contact on file.</div>
      )}

      {showContacts && (
        <div className="mt-2.5 border-t border-dashed border-border-soft pt-2.5">
          <AdditionalContactsList
            contacts={location.additionalContacts}
            parentId={location.id}
            parentType="serviceLocation"
            customerId={location.customerId}
            queryKey={['service-location', location.id]}
            canEdit={canEdit}
            showAddButton={canEdit}
          />
        </div>
      )}
    </Card>
  );
}

function ParentCustomerCard({ location }: { location: ServiceLocationDetailDto }) {
  // REAL — customer billing context now rides the detail payload. Agreement
  // coverage was dropped (no agreement service exists in the platform).
  const termsDays = location.customerPaymentTermsDays;
  return (
    <Card
      title={<CardTitle icon={<ReceiptPercentIcon className="size-3.5" />}>Billed to</CardTitle>}
      action={<Link to={`/customers/${location.customerId}`} className="text-[11px] font-medium text-fg-accent hover:underline">Open customer →</Link>}
    >
      <div className="text-[13px] font-semibold text-fg-strong">{location.customerName}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {location.customerStatus && (
          <Pill tone={location.customerStatus === 'ACTIVE' ? 'success' : 'neutral'} dot>
            {location.customerStatus === 'ACTIVE' ? 'Active' : 'Inactive'}
          </Pill>
        )}
        {typeof termsDays === 'number' && <Pill tone="neutral">Net {termsDays}</Pill>}
      </div>
      <div className="mt-2 text-[11.5px] text-fg-muted">
        Customer AR rolls up across all of this customer’s locations. Job-level bill-to overrides apply per job when set.
      </div>
    </Card>
  );
}

function TagsCard({ location }: { location: ServiceLocationDetailDto }) {
  const tags = location.tags ?? [];
  return (
    <Card title="Tags">
      {tags.length === 0 ? (
        <div className="text-[12px] text-fg-muted">No tags.</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-bg-active px-2 py-0.5 text-[11px] font-medium text-fg"
            >
              <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function NotesCard({ location }: { location: ServiceLocationDetailDto }) {
  // REAL — the single free-form `notes` field. The richer pinned/dated notes
  // feed in the design is a backend gap (one ask: a notes collection on the
  // location with author + timestamp + pin).
  return (
    <Card title="Notes">
      {location.notes ? (
        <div className="rounded-md border-l-[3px] border-border-strong bg-bg-elev-2 px-2.5 py-2 text-[11.5px] leading-relaxed text-fg">
          {location.notes}
        </div>
      ) : (
        <div className="text-[12px] text-fg-muted">No notes yet.</div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Equipment tab — search + filter chips → grouped dense table → footer.
// Identity columns are REAL; health columns (capacity/age/last svc/next PM/
// warranty/flag) are MOCK until equipment-service carries them.
// ─────────────────────────────────────────────────────────────────────────
type EquipFilter = 'flagged' | 'eol' | 'warranty' | null;

function EquipmentTab({
  equipment,
  total,
  onAdd,
  onEdit,
  onDelete,
}: {
  equipment: EquipmentSummary[];
  total: number;
  onAdd: () => void;
  onEdit: (item: EquipmentSummary) => void;
  onDelete: (item: EquipmentSummary) => void;
}) {
  const { getName } = useGlossary();
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<EquipFilter>(null);

  // Pair each real unit with its mock health record once, by stable position.
  const withHealth = useMemo(
    () => equipment.map((e, i) => ({ e, h: mockEquipmentHealth(i) })),
    [equipment]
  );

  const counts = useMemo(
    () => ({
      flagged: withHealth.filter((x) => x.h.flag).length,
      eol: withHealth.filter((x) => x.h.ageYrs >= 10).length,
      warranty: withHealth.filter((x) => /expired/i.test(x.h.warranty)).length,
    }),
    [withHealth]
  );

  const rows = useMemo(() => {
    let r = withHealth;
    const needle = q.trim().toLowerCase();
    if (needle) {
      r = r.filter(({ e }) =>
        [e.name, e.equipmentTypeName, e.make, e.model, e.serialNumber, e.locationOnSite]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(needle))
      );
    }
    if (filter === 'flagged') r = r.filter((x) => x.h.flag);
    if (filter === 'eol') r = r.filter((x) => x.h.ageYrs >= 10);
    if (filter === 'warranty') r = r.filter((x) => /expired/i.test(x.h.warranty));
    return r;
  }, [withHealth, q, filter]);

  const grouped = useMemo(() => {
    const acc: Record<string, typeof rows> = {};
    for (const row of rows) {
      const type = row.e.equipmentTypeName || 'Other';
      (acc[type] = acc[type] || []).push(row);
    }
    return acc;
  }, [rows]);

  const chips: { id: Exclude<EquipFilter, null>; label: string; count: number }[] = [
    { id: 'flagged', label: 'Flagged', count: counts.flagged },
    { id: 'eol', label: 'EOL approaching', count: counts.eol },
    { id: 'warranty', label: 'Warranty expired', count: counts.warranty },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-8 min-w-[220px] max-w-[360px] flex-1 items-center gap-2 rounded-md border border-border bg-bg-elev px-2.5">
          <MagnifyingGlassIcon className="size-3.5 text-fg-dim" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by ID, make, model, serial…"
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-fg outline-none placeholder:text-fg-dim"
          />
          {q && (
            <button onClick={() => setQ('')} className="px-1 text-[11px] text-fg-dim hover:text-fg-strong">
              ×
            </button>
          )}
        </div>

        {chips.map((c) => {
          const active = filter === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setFilter(active ? null : c.id)}
              className={`inline-flex h-[30px] items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium ${
                active
                  ? 'border-[color-mix(in_oklch,var(--accent-500)_45%,var(--border))] bg-[color-mix(in_oklch,var(--accent-500)_9%,var(--bg-elev))] text-fg-accent'
                  : 'border-border bg-bg-elev text-fg'
              }`}
            >
              {c.label}
              <span
                className={`rounded px-1.5 font-mono text-[10.5px] font-semibold tabular-nums ${active ? 'bg-[color-mix(in_oklch,var(--accent-500)_18%,var(--bg-elev))] text-fg-accent' : 'bg-bg-active text-fg-dim'}`}
              >
                {c.count}
              </span>
            </button>
          );
        })}

        {filter && (
          <Button plain size="xs" onClick={() => setFilter(null)}>
            Clear
          </Button>
        )}

        <span className="grow" />
        <MockBadge />
        <Button color="accent" size="xs" onClick={onAdd}>
          <PlusIcon className="size-4" />
          {t('common.actions.add', { entity: getName('equipment') })}
        </Button>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead className="bg-bg-elev-2">
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
                <th className="px-3.5 py-2 font-semibold">{getName('equipment')}</th>
                <th className="px-3.5 py-2 font-semibold">Make / Model</th>
                <th className="px-3.5 py-2 font-semibold">Location on site</th>
                <th className="px-3.5 py-2 font-semibold">Capacity</th>
                <th className="px-3.5 py-2 text-right font-semibold">Age</th>
                <th className="px-3.5 py-2 font-semibold">Last service</th>
                <th className="px-3.5 py-2 font-semibold">Next PM</th>
                <th className="px-3.5 py-2 font-semibold">Warranty</th>
                <th className="px-3.5 py-2 font-semibold">Status</th>
                <th className="w-9 px-3.5 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center">
                    <div className="text-[13px] font-semibold text-fg-strong">
                      {equipment.length === 0
                        ? t('common.actions.noEntitiesYet', { entities: getName('equipment', true) })
                        : 'No equipment matches'}
                    </div>
                    <div className="mt-1 text-[12px] text-fg-muted">
                      {equipment.length === 0 ? 'Add equipment to get started.' : 'Adjust your search or clear filters.'}
                    </div>
                  </td>
                </tr>
              ) : (
                Object.entries(grouped).flatMap(([type, items]) => [
                  <tr key={`h-${type}`}>
                    <td colSpan={10} className="border-y border-border-soft bg-bg-elev-2 px-3.5 py-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-strong">{type}</span>
                      <span className="ml-2 font-mono text-[10.5px] tabular-nums text-fg-muted">{items.length}</span>
                    </td>
                  </tr>,
                  ...items.map(({ e, h }) => (
                    <EquipmentRow key={e.id} e={e} h={h} onEdit={onEdit} onDelete={onDelete} />
                  )),
                ])
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center border-t border-border-soft bg-bg-elev-2 px-4 py-2.5 text-[11.5px] text-fg-muted">
          <span>
            Showing <strong className="text-fg-strong">{rows.length}</strong> of {total}
          </span>
        </div>
      </Card>
    </div>
  );
}

function EquipmentRow({
  e,
  h,
  onEdit,
  onDelete,
}: {
  e: EquipmentSummary;
  h: ReturnType<typeof mockEquipmentHealth>;
  onEdit: (item: EquipmentSummary) => void;
  onDelete: (item: EquipmentSummary) => void;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const warrantyExpired = /expired/i.test(h.warranty);
  const statusTone = h.health === 'Attention' ? 'warning' : h.health === 'In service' ? 'info' : 'success';
  const tint =
    h.flag?.tone === 'warning'
      ? 'bg-[color-mix(in_oklch,var(--warning-500)_6%,var(--bg-elev))]'
      : h.flag?.tone === 'info'
        ? 'bg-[color-mix(in_oklch,var(--info-500)_6%,var(--bg-elev))]'
        : '';

  return (
    <tr
      className={`cursor-pointer border-b border-border-soft hover:bg-bg-hover ${tint}`}
      onClick={(ev) => {
        const target = ev.target as HTMLElement;
        if (target.closest('[role="menu"]') || target.closest('button[aria-label]')) return;
        navigate(`/equipment/${e.id}`);
      }}
    >
      <td className="px-3.5 py-2">
        <div className="font-mono text-[12px] font-bold text-fg-strong">{e.name}</div>
        {e.serialNumber && <div className="text-[11px] text-fg-muted">{e.serialNumber}</div>}
      </td>
      <td className="px-3.5 py-2">
        <div className="text-[12px] text-fg">{e.make || '—'}</div>
        {e.model && <div className="font-mono text-[11px] text-fg-muted">{e.model}</div>}
      </td>
      <td className="px-3.5 py-2 text-[11.5px] text-fg-muted">{e.locationOnSite || '—'}</td>
      <td className="px-3.5 py-2 font-mono text-[11px] text-fg">{h.capacity}</td>
      <td className="px-3.5 py-2 text-right font-mono text-[12px] font-semibold tabular-nums text-fg-strong">{h.ageYrs}y</td>
      <td className="px-3.5 py-2 text-[11.5px] text-fg-muted">{h.lastSvc}</td>
      <td className="px-3.5 py-2 text-[11.5px] text-fg-muted">{h.nextPm}</td>
      <td className={`px-3.5 py-2 text-[11.5px] ${warrantyExpired ? 'text-fg-dim' : 'text-fg-muted'}`}>{h.warranty}</td>
      <td className="px-3.5 py-2">
        <div className="flex flex-col gap-0.5">
          <Pill tone={statusTone} dot live={h.flag?.tone === 'info'}>
            {h.health}
          </Pill>
          {h.flag && (
            <span className="text-[10.5px]" style={{ color: h.flag.tone === 'warning' ? 'var(--warning-fg)' : 'var(--fg-accent)' }}>
              {h.flag.text}
            </span>
          )}
        </div>
      </td>
      <td className="px-3.5 py-2 text-right">
        <Dropdown>
          <DropdownButton as={IconButton} aria-label={t('common.moreOptions')}>
            <EllipsisVerticalIcon className="size-4" />
          </DropdownButton>
          <DropdownMenu anchor="bottom end">
            <DropdownItem onClick={() => navigate(`/equipment/${e.id}`)}>
              <DropdownLabel>{t('common.view')}</DropdownLabel>
            </DropdownItem>
            <DropdownItem onClick={() => onEdit(e)}>
              <DropdownLabel>{t('common.edit')}</DropdownLabel>
            </DropdownItem>
            <DropdownItem onClick={() => onDelete(e)}>
              <DropdownLabel>{t('common.delete')}</DropdownLabel>
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Destructive footer — Close (the real lifecycle transition the backend
// exposes). The design's "Deactivate → INACTIVE" verb is a separate transition
// that doesn't have a backend endpoint yet (design open-question #1).
// ─────────────────────────────────────────────────────────────────────────
function CloseFooter({
  location,
  headline,
  onClose,
}: {
  location: ServiceLocationDetailDto;
  headline: string;
  onClose?: () => void;
}) {
  if (location.status === 'CLOSED') {
    return (
      <div className="mt-3.5">
        <Callout kind="neutral" icon={null} title={`${headline} is closed`}>
          This location is closed. Equipment, visit history, files and notes are preserved.
        </Callout>
      </div>
    );
  }
  if (!onClose) return null;
  return (
    <div className="mt-3.5">
      <Callout
        kind="neutral"
        icon={null}
        title={`Close ${headline}`}
        action={
          <Button outline="red" size="xxs" onClick={onClose}>
            Close location
          </Button>
        }
      >
        Stops new jobs at this site. Equipment, visit history, files and notes are preserved. The parent customer is unaffected.
      </Callout>
    </div>
  );
}
