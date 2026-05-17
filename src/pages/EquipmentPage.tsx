import { useState, useDeferredValue } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { EllipsisVerticalIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useGlossary } from '../contexts/GlossaryContext';
import {
  equipmentApi,
  equipmentTypesApi,
  equipmentCategoriesApi,
  EquipmentStatus,
  type Equipment,
  type EquipmentSummary,
  type EquipmentSortField,
  type EquipmentSortDirection,
} from '../api';
import AppLayout from '../components/AppLayout';
import EquipmentFormDialog from '../components/EquipmentFormDialog';
import EquipmentThumbnail from '../components/EquipmentThumbnail';
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

const PAGE_SIZE = 50;

export default function EquipmentPage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { getName } = useGlossary();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  // Empty string = "All" (both ACTIVE and RETIRED). Default lands on ACTIVE so
  // retired equipment doesn't crowd the day-to-day view.
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | ''>(EquipmentStatus.ACTIVE);
  const [page, setPage] = useState(0); // 0-indexed
  const [sortBy] = useState<EquipmentSortField>('name');
  const [sortDir] = useState<EquipmentSortDirection>('asc');

  // Defer the search input so we don't fire a request on every keystroke
  const deferredSearch = useDeferredValue(searchQuery.trim());

  const { data: equipmentTypes = [] } = useQuery({
    queryKey: ['equipment-types'],
    queryFn: () => equipmentTypesApi.getAll(),
  });

  const { data: equipmentCategories = [] } = useQuery({
    queryKey: ['equipment-categories', typeFilter],
    queryFn: () => equipmentCategoriesApi.getAll(typeFilter || undefined),
    enabled: Boolean(typeFilter),
  });

  const {
    data: equipmentPage,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['equipment', { search: deferredSearch, typeFilter, categoryFilter, statusFilter, page, sortBy, sortDir }],
    queryFn: () =>
      equipmentApi.list({
        search: deferredSearch || undefined,
        equipmentTypeId: typeFilter || undefined,
        equipmentCategoryId: categoryFilter || undefined,
        status: statusFilter || undefined,
        page,
        size: PAGE_SIZE,
        sortBy,
        sortDir,
      }),
  });

  const equipment: EquipmentSummary[] = equipmentPage?.content ?? [];
  const totalElements = equipmentPage?.totalElements ?? 0;
  const totalPages = equipmentPage?.totalPages ?? 0;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => equipmentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      // Equipment summaries are embedded on workItems[].equipment in WO
      // detail and list responses — refresh both so deleted equipment
      // disappears from row expansions / service history.
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders-list'] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      alert(msg || t('common.form.errorDelete', { entity: getName('equipment') }));
    },
  });

  const handleAdd = () => {
    setSelectedEquipment(null);
    setIsDialogOpen(true);
  };

  const handleEdit = async (item: EquipmentSummary) => {
    // Fetch the full record so the dialog has all fields (description, install date, etc.)
    const full = await equipmentApi.getById(item.id);
    setSelectedEquipment(full);
    setIsDialogOpen(true);
  };

  const handleDelete = (item: EquipmentSummary) => {
    if (window.confirm(t('common.actions.deleteConfirm', { name: item.name }))) {
      deleteMutation.mutate(item.id);
    }
  };

  const getStatusBadge = (status: EquipmentStatus | undefined) => {
    if (status === EquipmentStatus.RETIRED) {
      return <Pill tone="neutral">{t('equipment.status.retired')}</Pill>;
    }
    // Default to active when the backend omits status (older payloads). Most
    // equipment is active, so this avoids a misleading "Retired" badge.
    return <Pill tone="success">{t('equipment.status.active')}</Pill>;
  };

  const formatTypeCategory = (item: EquipmentSummary) => {
    if (item.equipmentTypeName && item.equipmentCategoryName) {
      return `${item.equipmentTypeName} / ${item.equipmentCategoryName}`;
    }
    return item.equipmentTypeName || item.equipmentCategoryName || '-';
  };

  const formatMakeModel = (item: EquipmentSummary) => {
    if (item.make && item.model) return `${item.make} ${item.model}`;
    return item.make || item.model || '-';
  };

  // Compose the address line from the discrete fields the backend returns.
  // Street + city run through titleCaseAddress (db is uppercase); state and
  // zip stay raw. "City, ST ZIP" tail uses a space between state and zip.
  const formatAddress = (item: EquipmentSummary): string => {
    const parts: string[] = [];
    if (item.streetAddress) parts.push(titleCaseAddress(item.streetAddress));
    const stateZip = [item.state, item.zipCode].filter(Boolean).join(' ');
    const cityState = [titleCaseAddress(item.city), stateZip].filter(Boolean).join(', ');
    if (cityState) parts.push(cityState);
    return parts.join(', ');
  };

  const statusViewTabs = [
    { id: EquipmentStatus.ACTIVE, label: t('equipment.status.active') },
    { id: EquipmentStatus.RETIRED, label: t('equipment.status.retired') },
    { id: '', label: t('equipment.status.all') },
  ];

  const subtitle = totalElements > 0
    ? `${totalElements.toLocaleString()} ${totalElements === 1 ? getName('equipment').toLowerCase() : getName('equipment', true).toLowerCase()}${
        totalElements > PAGE_SIZE
          ? ' · ' + t('common.pagination.showing', {
              start: page * PAGE_SIZE + 1,
              end: Math.min((page + 1) * PAGE_SIZE, totalElements),
              total: totalElements.toLocaleString(),
            })
          : ''
      }`
    : null;

  return (
    <AppLayout>
      <div>
        <PageHead
          title={getName('equipment', true)}
          sub={subtitle}
          actions={
            <Button color="accent" onClick={handleAdd}>
              {t('common.actions.add', { entity: getName('equipment') })}
            </Button>
          }
        />

        {/* Search + type + category filters */}
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <InputGroup className="min-w-[260px] flex-1">
            <MagnifyingGlassIcon data-slot="icon" />
            <Input
              type="text"
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              className={dense.input}
            />
          </InputGroup>

          <div className="w-48">
            <Select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCategoryFilter('');
                setPage(0);
              }}
              className={dense.select}
              aria-label={t('equipment.filter.allTypes')}
            >
              <option value="">{t('equipment.filter.allTypes')}</option>
              {equipmentTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </Select>
          </div>

          <div className="w-48">
            <Select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(0);
              }}
              disabled={!typeFilter}
              className={dense.select}
              aria-label={t('equipment.filter.allCategories')}
            >
              <option value="">{t('equipment.filter.allCategories')}</option>
              {equipmentCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </Select>
          </div>
        </div>

        <ViewTabs
          className="mb-3"
          value={statusFilter}
          onChange={(id) => {
            setStatusFilter(id as EquipmentStatus | '');
            setPage(0);
          }}
          tabs={statusViewTabs}
        />

        {error && (
          <Card className="border-danger-500/40 bg-danger-100/40">
            <CardBody>
              <p className="text-[12.5px] text-danger-500">
                {t('common.actions.errorLoading', { entities: getName('equipment', true) })}: {(error as Error).message}
              </p>
            </CardBody>
          </Card>
        )}

        {isLoading ? (
          <Card>
            <CardBody>
              <p className="text-center text-[12.5px] text-fg-muted">
                {t('common.actions.loading', { entities: getName('equipment', true) })}
              </p>
            </CardBody>
          </Card>
        ) : equipment.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-[12.5px] text-fg-muted">
                {deferredSearch || typeFilter || categoryFilter
                  ? t('common.actions.noMatchSearch', { entities: getName('equipment', true) })
                  : t('common.actions.notFound', { entities: getName('equipment', true) })}
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody flush>
              <DenseTable>
                <DenseTHead>
                  <tr>
                    <th>{t('common.form.name')}</th>
                    <th>{getName('service_location')}</th>
                    <th>{t('equipment.table.type')}</th>
                    <th>{t('equipment.table.makeModel')}</th>
                    <th>{t('equipment.form.serialNumber')}</th>
                    <th>{t('equipment.form.locationOnSite')}</th>
                    <th>{t('common.form.status')}</th>
                    <th></th>
                  </tr>
                </DenseTHead>
                <tbody>
                  {equipment.map((item) => (
                    <DenseRow key={item.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <RouterLink to={`/equipment/${item.id}`}>
                            <EquipmentThumbnail
                              url={item.profileImageUrl}
                              name={item.name}
                              sizeClass="size-12"
                              fit="contain"
                            />
                          </RouterLink>
                          <CellStack>
                            <CellTop>
                              <RouterLink
                                to={`/equipment/${item.id}`}
                                className="hover:text-accent-500 hover:underline"
                              >
                                {item.name}
                              </RouterLink>
                            </CellTop>
                            {item.parentId && item.parentName && (
                              <CellSub>
                                <RouterLink
                                  to={`/equipment/${item.parentId}`}
                                  className="hover:text-accent-500 hover:underline"
                                >
                                  {t('equipment.table.componentOf', {
                                    entity: getName('equipment_component'),
                                    parent: item.parentName,
                                  })}
                                </RouterLink>
                              </CellSub>
                            )}
                          </CellStack>
                        </div>
                      </td>
                      <td>
                        {item.serviceLocationId ? (
                          <RouterLink
                            to={`/service-locations/${item.serviceLocationId}`}
                            className="block hover:text-accent-500"
                          >
                            <CellStack>
                              <CellTop>{item.serviceLocationName || formatAddress(item) || '-'}</CellTop>
                              <CellSub>
                                {[
                                  item.serviceLocationName ? formatAddress(item) : null,
                                  item.customerName,
                                ].filter(Boolean).join(' · ')}
                              </CellSub>
                            </CellStack>
                          </RouterLink>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                      <td>{formatTypeCategory(item)}</td>
                      <td>{formatMakeModel(item)}</td>
                      <td>{item.serialNumber || '-'}</td>
                      <td>{item.locationOnSite || '-'}</td>
                      <td>{getStatusBadge(item.status)}</td>
                      <td>
                        <Dropdown>
                          <DropdownButton as={IconButton} aria-label={t('common.moreOptions')}>
                            <EllipsisVerticalIcon className="size-4" />
                          </DropdownButton>
                          <DropdownMenu anchor="bottom end">
                            <DropdownItem onClick={() => handleEdit(item)}>
                              <DropdownLabel>{t('common.edit')}</DropdownLabel>
                            </DropdownItem>
                            <DropdownItem onClick={() => handleDelete(item)}>
                              <DropdownLabel>{t('common.delete')}</DropdownLabel>
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      </td>
                    </DenseRow>
                  ))}
                </tbody>
              </DenseTable>

              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 border-t border-border-soft bg-bg-elev-2 px-3 py-2 text-[11.5px] text-fg-muted">
                  <Button
                    plain
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    {t('common.pagination.previous')}
                  </Button>
                  <span>
                    {t('common.pagination.pageOf', { page: page + 1, total: totalPages })}
                  </span>
                  <Button
                    plain
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t('common.pagination.next')}
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>

      <EquipmentFormDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedEquipment(null);
        }}
        equipment={selectedEquipment}
      />
    </AppLayout>
  );
}
