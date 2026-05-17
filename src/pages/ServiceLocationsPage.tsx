import { useEffect, useState, useDeferredValue } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';
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
import { Dropdown, DropdownButton, DropdownItem, DropdownLabel, DropdownMenu } from '../components/catalyst/dropdown';
import IconButton from '../components/IconButton';
import { ListboxOption } from '../components/catalyst/listbox';
import { FilterChipListbox, ChipDivider } from '../components/ui/FilterChipListbox';
import { ListToolbar, ListSearch } from '../components/ui/ListToolbar';
import { ListFooter } from '../components/ui/ListFooter';

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

  const locationNoun = totalLocations === 1
    ? getName('service_location').toLowerCase()
    : getName('service_location', true).toLowerCase();
  const subtitle = totalLocations > 0
    ? (statusFilter === 'ACTIVE'
        ? `${totalLocations.toLocaleString()} ${t('serviceLocations.status.active').toLowerCase()} ${locationNoun}`
        : statusFilter === 'INACTIVE'
          ? `${totalLocations.toLocaleString()} ${t('serviceLocations.status.inactive').toLowerCase()} ${locationNoun}`
          : statusFilter === 'CLOSED'
            ? `${totalLocations.toLocaleString()} ${t('serviceLocations.status.closed').toLowerCase()} ${locationNoun}`
            : `${totalLocations.toLocaleString()} ${locationNoun}`)
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

        <ListToolbar
          search={
            <ListSearch
              placeholder={t('serviceLocations.search.placeholder')}
              value={searchQuery}
              onChange={(value) => {
                setSearchQuery(value);
                updateFilters({ search: value }, { replace: true });
              }}
            />
          }
        >
          {activeRegions.length > 0 && (
            <FilterChipListbox
              label={t('serviceLocations.filter.region')}
              ariaLabel={t('serviceLocations.filter.region')}
              value={regionId || null}
              displayValue={regionId ? activeRegions.find((r) => r.id === regionId)?.name ?? null : null}
              onChange={(id) => updateFilters({ region: id ?? '' })}
              onClear={() => updateFilters({ region: '' })}
            >
              <ListboxOption value={null}>{t('serviceLocations.filter.allRegions')}</ListboxOption>
              <ChipDivider />
              {activeRegions.map((r) => (
                <ListboxOption key={r.id} value={r.id}>{r.name}</ListboxOption>
              ))}
            </FilterChipListbox>
          )}
        </ListToolbar>

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

              <ListFooter
                page={page}
                totalPages={totalPages}
                pageHref={pageHref}
                left={t('common.pagination.showing', {
                  start: showingStart,
                  end: showingEnd,
                  total: totalLocations.toLocaleString(),
                })}
              />
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
