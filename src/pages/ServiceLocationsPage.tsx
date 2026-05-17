import { useEffect, useState, useDeferredValue } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { EllipsisVerticalIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { customerApi, dispatchRegionApi, type ServiceLocation } from '../api';
import { useGlossary } from '../contexts/GlossaryContext';
import { useHasCapability } from '../hooks/useCurrentUser';
import AppLayout from '../components/AppLayout';
import ServiceLocationFormDialog from '../components/ServiceLocationFormDialog';
import { formatPhone } from '../utils/formatPhone';
import { titleCaseAddress } from '../utils/titleCaseAddress';
import { Button } from '../components/catalyst/button';
import { PageHead } from '../components/ui/PageHead';
import { Card, CardBody } from '../components/ui/Card';
import { Pill } from '../components/ui/Pill';
import { ViewTabs } from '../components/ui/Tabs';
import {
  DenseTable, DenseTHead, DenseRow, CellStack, CellTop, CellSub,
} from '../components/ui/DenseTable';
import { dense } from '../components/ui/dense';
import { Dropdown, DropdownButton, DropdownItem, DropdownLabel, DropdownMenu } from '../components/catalyst/dropdown';
import IconButton from '../components/IconButton';
import { Input, InputGroup } from '../components/catalyst/input';
import { Select } from '../components/catalyst/select';
import { Pagination, PaginationGap, PaginationList, PaginationNext, PaginationPage, PaginationPrevious } from '../components/catalyst/pagination';

export default function ServiceLocationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { getName } = useGlossary();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<ServiceLocation | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Read filters from URL
  const urlSearch = searchParams.get('search') ?? '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const statusFilter = searchParams.get('status') || 'all';
  const regionId = searchParams.get('region') ?? '';

  // Local input state mirrors the URL but lets typing feel instant. The sync
  // effect below keeps it aligned with the URL when navigation happens externally
  // (back/forward, deep link).
  const [searchQuery, setSearchQuery] = useState(urlSearch);
  useEffect(() => {
    setSearchQuery(urlSearch);
  }, [urlSearch]);
  const deferredSearch = useDeferredValue(searchQuery);

  // Tenant config — dispatch regions for the filter dropdown and chip lookup
  const { data: regions } = useQuery({
    queryKey: ['dispatch-regions'],
    queryFn: () => dispatchRegionApi.getAll(),
  });
  const activeRegions = (Array.isArray(regions) ? regions : []).filter((r) => r.isActive !== false);

  // Permission checks
  const canAddServiceLocations = useHasCapability('ADD_SERVICE_LOCATIONS');
  const canEditServiceLocations = useHasCapability('EDIT_SERVICE_LOCATIONS');
  const canCloseServiceLocations = useHasCapability('CLOSE_SERVICE_LOCATIONS');

  // Update URL when search/filter changes. Pass `replace: true` for high-frequency
  // updates (typing) so the back button doesn't have to step through every keystroke.
  // Default values (page=1, status=all) are omitted to keep URLs clean.
  const updateFilters = (
    updates: { search?: string; status?: string; region?: string },
    options: { replace?: boolean } = {}
  ) => {
    const newParams = new URLSearchParams(searchParams);
    if (updates.search !== undefined) {
      if (updates.search) {
        newParams.set('search', updates.search);
      } else {
        newParams.delete('search');
      }
      newParams.delete('page'); // Reset to page 1 (the default) on filter change
    }
    if (updates.status !== undefined) {
      if (updates.status === 'all') {
        newParams.delete('status');
      } else {
        newParams.set('status', updates.status);
      }
      newParams.delete('page');
    }
    if (updates.region !== undefined) {
      if (updates.region) {
        newParams.set('region', updates.region);
      } else {
        newParams.delete('region');
      }
      newParams.delete('page');
    }
    setSearchParams(newParams, { replace: options.replace ?? false });
  };

  // Build a relative href that preserves all current filters but jumps to a
  // specific page (omitting the page param when it would be the default).
  const pageHref = (target: number): string => {
    const next = new URLSearchParams(searchParams);
    if (target <= 1) next.delete('page');
    else next.set('page', target.toString());
    const qs = next.toString();
    return qs ? `?${qs}` : '?';
  };

  // Fetch paginated service locations
  const { data, isLoading, error } = useQuery({
    queryKey: ['service-locations', page, statusFilter, deferredSearch, regionId],
    queryFn: () => customerApi.getAllServiceLocationsPaginated({
      page,
      limit: 50,
      status: statusFilter === 'all' ? undefined : (statusFilter as 'ACTIVE' | 'INACTIVE' | 'CLOSED'),
      search: deferredSearch || undefined,
      dispatchRegionId: regionId || undefined,
    }),
  });

  const locations = data?.content || [];
  const totalLocations = data?.totalElements || 0;
  const totalPages = data?.totalPages || 0;

  const closeLocationMutation = useMutation({
    mutationFn: (locationId: string) =>
      customerApi.closeServiceLocation(locationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-locations'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: (locationId: string) =>
      customerApi.deleteServiceLocation(locationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-locations'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error && 'response' in error
        ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message)
        : undefined;
      alert(errorMessage || t('common.form.errorDelete', { entity: getName('service_location') }));
    },
  });

  const handleAdd = () => {
    setSelectedLocation(null);
    setSelectedCustomerId(null);
    setIsDialogOpen(true);
  };

  const handleEdit = async (locationId: string, customerId: string) => {
    // Fetch full location details for editing
    const location = await customerApi.getServiceLocationById(locationId);
    setSelectedLocation(location);
    setSelectedCustomerId(customerId);
    setIsDialogOpen(true);
  };

  const handleClose = (locationId: string, locationName: string, streetAddress: string) => {
    if (window.confirm(t('serviceLocations.actions.closeConfirm', { name: locationName || streetAddress }))) {
      closeLocationMutation.mutate(locationId);
    }
  };

  const handleDelete = (locationId: string, locationName: string, streetAddress: string) => {
    if (window.confirm(t('common.actions.deleteConfirm', { name: locationName || streetAddress }))) {
      deleteLocationMutation.mutate(locationId);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedLocation(null);
    setSelectedCustomerId(null);
  };

  const PAGE_SIZE = 50;
  const showingStart = totalLocations === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingEnd = Math.min(page * PAGE_SIZE, totalLocations);

  const statusViewTabs = [
    { id: 'all', label: t('serviceLocations.filter.allStatuses') },
    { id: 'ACTIVE', label: t('serviceLocations.status.active') },
    { id: 'INACTIVE', label: t('serviceLocations.status.inactive') },
    { id: 'CLOSED', label: t('serviceLocations.status.closed') },
  ];

  const subtitle = totalLocations > 0
    ? `${totalLocations.toLocaleString()} ${totalLocations === 1 ? getName('service_location').toLowerCase() : getName('service_location', true).toLowerCase()}${
        totalLocations > PAGE_SIZE
          ? ' · ' + t('common.pagination.showing', { start: showingStart, end: showingEnd, total: totalLocations.toLocaleString() })
          : ''
      }`
    : null;

  return (
    <AppLayout>
      <div>
        <PageHead
          title={getName('service_location', true)}
          sub={subtitle}
          actions={
            canAddServiceLocations ? (
              <Button color="accent" onClick={handleAdd}>
                {t('common.actions.add', { entity: getName('service_location') })}
              </Button>
            ) : null
          }
        />

        {/* Search + region filter */}
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <InputGroup className="min-w-[260px] flex-1">
            <MagnifyingGlassIcon data-slot="icon" />
            <Input
              type="text"
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                updateFilters({ search: e.target.value }, { replace: true });
              }}
              className={dense.input}
            />
          </InputGroup>
          {activeRegions.length > 0 && (
            <div className="w-44">
              <Select
                aria-label={t('serviceLocations.filter.region')}
                value={regionId}
                onChange={(e) => updateFilters({ region: e.target.value })}
                className={dense.select}
              >
                <option value="">{t('serviceLocations.filter.allRegions')}</option>
                {activeRegions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <ViewTabs
          className="mb-3"
          value={statusFilter}
          onChange={(id) => updateFilters({ status: id })}
          tabs={statusViewTabs}
        />

        {isLoading && (
          <Card>
            <CardBody>
              <p className="text-center text-[12.5px] text-fg-muted">
                {t('common.actions.loading', { entities: getName('service_location', true) })}
              </p>
            </CardBody>
          </Card>
        )}

        {error && (
          <Card className="border-danger-500/40 bg-danger-100/40">
            <CardBody>
              <p className="text-[12.5px] text-danger-500">
                {t('common.actions.errorLoading', { entities: getName('service_location', true) })}: {(error as Error).message}
              </p>
            </CardBody>
          </Card>
        )}

        {totalLocations === 0 && !isLoading && (
          <Card>
            <CardBody>
              <p className="text-[12.5px] text-fg-muted">
                {deferredSearch || statusFilter !== 'all'
                  ? t('common.actions.noMatchSearch', { entities: getName('service_location', true) })
                  : t('common.actions.notFound', { entities: getName('service_location', true) })}
              </p>
              {canAddServiceLocations && !deferredSearch && statusFilter === 'all' && (
                <Button color="accent" className="mt-2" onClick={handleAdd}>
                  {t('common.actions.addFirst', { entity: getName('service_location') })}
                </Button>
              )}
            </CardBody>
          </Card>
        )}

        {locations.length > 0 && (
          <Card>
            <CardBody flush>
              <DenseTable>
                <DenseTHead>
                  <tr>
                    <th>{t('common.form.name')}</th>
                    <th>{t('serviceLocations.table.address')}</th>
                    <th>{t('serviceLocations.table.contact')}</th>
                    <th>{t('serviceLocations.table.lastService')}</th>
                    <th>{t('common.form.status')}</th>
                    <th></th>
                  </tr>
                </DenseTHead>
                <tbody>
                  {locations.map((location) => {
                    const street = [location.address.streetAddress, location.address.streetAddressLine2]
                      .filter(Boolean).join(' ');
                    const stateZip = [location.address.state, location.address.zipCode].filter(Boolean).join(' ');
                    return (
                      <DenseRow
                        key={location.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/service-locations/${location.id}`)}
                      >
                        <td className="strong">
                          {location.locationName || (
                            <span className="muted italic">{t('serviceLocations.detail.unnamedLocation')}</span>
                          )}
                        </td>
                        <td>
                          <CellStack>
                            <CellTop>{titleCaseAddress(street)}</CellTop>
                            <CellSub>
                              {[titleCaseAddress(location.address.city), stateZip].filter(Boolean).join(', ')}
                            </CellSub>
                          </CellStack>
                        </td>
                        <td>
                          {location.siteContactName || location.siteContactPhone ? (
                            <CellStack>
                              {location.siteContactName && <CellTop>{location.siteContactName}</CellTop>}
                              {location.siteContactPhone && (
                                <CellSub>
                                  <a
                                    href={`tel:${location.siteContactPhone}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="hover:underline"
                                  >
                                    {formatPhone(location.siteContactPhone)}
                                  </a>
                                </CellSub>
                              )}
                            </CellStack>
                          ) : (
                            <span className="muted">-</span>
                          )}
                        </td>
                        <td className="muted">{t('serviceLocations.table.neverServiced')}</td>
                        <td>
                          {location.status === 'ACTIVE' ? (
                            // Pill recedes when 100% of the list is Active
                            // (.pill.success is already a soft 12% mix on bg-elev).
                            <Pill tone="success">
                              {t(`serviceLocations.status.${location.status.toLowerCase()}`)}
                            </Pill>
                          ) : (
                            <span
                              className={
                                location.status === 'INACTIVE'
                                  ? 'text-fg-muted'
                                  : 'text-fg-dim'
                              }
                            >
                              {t(`serviceLocations.status.${location.status.toLowerCase()}`)}
                            </span>
                          )}
                        </td>
                        <td>
                          {(canEditServiceLocations || canCloseServiceLocations) && (
                            <Dropdown>
                              <DropdownButton as={IconButton} aria-label={t('common.moreOptions')}>
                                <EllipsisVerticalIcon className="size-4" />
                              </DropdownButton>
                              <DropdownMenu anchor="bottom end">
                                <DropdownItem onClick={() => navigate(`/service-locations/${location.id}`)}>
                                  <DropdownLabel>{t('common.view')}</DropdownLabel>
                                </DropdownItem>
                                {canEditServiceLocations && (
                                  <DropdownItem onClick={() => handleEdit(location.id, location.customerId)}>
                                    <DropdownLabel>{t('common.edit')}</DropdownLabel>
                                  </DropdownItem>
                                )}
                                {canCloseServiceLocations && (
                                  <>
                                    {location.status !== 'CLOSED' && (
                                      <DropdownItem onClick={() => handleClose(location.id, location.locationName || '', location.address.streetAddress)}>
                                        <DropdownLabel>{t('serviceLocations.actions.close')}</DropdownLabel>
                                      </DropdownItem>
                                    )}
                                    <DropdownItem onClick={() => handleDelete(location.id, location.locationName || '', location.address.streetAddress)}>
                                      <DropdownLabel>{t('common.delete')}</DropdownLabel>
                                    </DropdownItem>
                                  </>
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

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border-soft bg-bg-elev-2 px-3 py-2 text-[11.5px] text-fg-muted">
                  <span>
                    {t('common.pagination.showing', {
                      start: showingStart,
                      end: showingEnd,
                      total: totalLocations.toLocaleString(),
                    })}
                  </span>
                  <Pagination className="m-0">
                    <PaginationPrevious href={page > 1 ? pageHref(page - 1) : null} />
                    <PaginationList>
                      {(() => {
                        const pages: (number | 'gap')[] = [];
                        if (totalPages <= 7) {
                          for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                          pages.push(1);
                          if (page > 3) pages.push('gap');
                          const start = Math.max(2, page - 1);
                          const end = Math.min(totalPages - 1, page + 1);
                          for (let i = start; i <= end; i++) pages.push(i);
                          if (page < totalPages - 2) pages.push('gap');
                          pages.push(totalPages);
                        }
                        return pages.map((p, idx) =>
                          p === 'gap' ? (
                            <PaginationGap key={`gap-${idx}`} />
                          ) : (
                            <PaginationPage key={p} href={pageHref(p)} current={p === page}>
                              {String(p)}
                            </PaginationPage>
                          )
                        );
                      })()}
                    </PaginationList>
                    <PaginationNext href={page < totalPages ? pageHref(page + 1) : null} />
                  </Pagination>
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>

      <ServiceLocationFormDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        serviceLocation={selectedLocation}
        customerId={selectedCustomerId}
      />
    </AppLayout>
  );
}
