import { useEffect, useState, useDeferredValue } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { EllipsisVerticalIcon, HomeIcon, BuildingOfficeIcon, CreditCardIcon } from '@heroicons/react/24/outline';
import { customerApi, type Customer } from '../api';
import { useGlossary } from '../contexts/GlossaryContext';
import { useHasCapability } from '../hooks/useCurrentUser';
import AppLayout from '../components/AppLayout';
import CustomerFormDialog from '../components/CustomerFormDialog';
import { formatPhone } from '../utils/formatPhone';
import { Button } from '../components/catalyst/button';
import { Dropdown, DropdownButton, DropdownItem, DropdownLabel, DropdownMenu } from '../components/catalyst/dropdown';
import IconButton from '../components/IconButton';
import { PageHead } from '../components/ui/PageHead';
import { Card, CardBody } from '../components/ui/Card';
import { Pill } from '../components/ui/Pill';
import { ViewTabs } from '../components/ui/Tabs';
import {
  DenseTable, DenseTHead, DenseRow, CellStack, CellTop, CellSub,
} from '../components/ui/DenseTable';
import { ListToolbar, ListSearch } from '../components/ui/ListToolbar';
import { ListFooter } from '../components/ui/ListFooter';

export default function CustomersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { getName } = useGlossary();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Read filters from URL
  const urlSearch = searchParams.get('search') ?? '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const statusFilter = searchParams.get('status') || 'all';

  // Local input state mirrors the URL but lets typing feel instant. The sync
  // effect below keeps it aligned with the URL when navigation happens externally
  // (back/forward, deep link).
  const [searchQuery, setSearchQuery] = useState(urlSearch);
  useEffect(() => {
    setSearchQuery(urlSearch);
  }, [urlSearch]);
  const deferredSearch = useDeferredValue(searchQuery);

  // Permission checks
  const canAddCustomers = useHasCapability('ADD_CUSTOMERS');
  const canEditCustomers = useHasCapability('EDIT_CUSTOMERS');
  const canArchiveCustomers = useHasCapability('ARCHIVE_CUSTOMERS');

  // Update URL when search/filter changes. Pass `replace: true` for high-frequency
  // updates (typing) so the back button doesn't have to step through every keystroke.
  // Default values (page=1, status=all) are omitted to keep URLs clean.
  const updateFilters = (
    updates: { search?: string; status?: string; page?: number },
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
    if (updates.page !== undefined) {
      if (updates.page <= 1) {
        newParams.delete('page');
      } else {
        newParams.set('page', updates.page.toString());
      }
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

  const { data, isLoading, error } = useQuery({
    queryKey: ['customers', page, statusFilter, deferredSearch],
    queryFn: () => customerApi.getAllPaginated({
      page,
      limit: 50,
      status: statusFilter === 'all' ? undefined : (statusFilter as 'ACTIVE' | 'INACTIVE'),
      search: deferredSearch || undefined,
    }),
  });

  const customers = data?.content || [];
  const totalCustomers = data?.totalElements || 0;
  const totalPages = data?.totalPages || 0;
  const PAGE_SIZE = 50;
  const showingStart = totalCustomers === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingEnd = Math.min(page * PAGE_SIZE, totalCustomers);

  const statusViewTabs = [
    { id: 'all', label: t('customers.filter.allStatuses') },
    { id: 'ACTIVE', label: t('common.active') },
    { id: 'INACTIVE', label: t('common.inactive') },
  ];

  // Subtitle describes the currently-displayed set. The status tab is already
  // reflected in totalCustomers; we lean on the active tab label rather than
  // re-deriving the breakdown (would require a separate counts endpoint).
  const customerNoun = totalCustomers === 1
    ? getName('customer').toLowerCase()
    : getName('customer', true).toLowerCase();
  const customerSubtitle = totalCustomers > 0
    ? (statusFilter === 'ACTIVE'
        ? `${totalCustomers.toLocaleString()} ${t('common.active').toLowerCase()} ${customerNoun}`
        : statusFilter === 'INACTIVE'
          ? `${totalCustomers.toLocaleString()} ${t('common.inactive').toLowerCase()} ${customerNoun}`
          : `${totalCustomers.toLocaleString()} ${customerNoun}`)
    : null;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customerApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error && 'response' in error
        ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message)
        : undefined;
      alert(errorMessage || t('common.form.errorDelete', { entity: getName('customer') }));
    },
  });

  const handleAdd = () => {
    setSelectedCustomer(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleDelete = (customer: Customer) => {
    if (window.confirm(t('common.actions.deleteConfirm', { name: customer.name }))) {
      deleteMutation.mutate(customer.id);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedCustomer(null);
  };

  return (
    <AppLayout>
      <div>
        <PageHead
          title={getName('customer', true)}
          sub={customerSubtitle}
          actions={
            canAddCustomers ? (
              <Button color="accent" onClick={handleAdd}>
                {t('common.actions.add', { entity: getName('customer') })}
              </Button>
            ) : null
          }
        />

        <ListToolbar
          search={
            <ListSearch
              placeholder={t('customers.search.placeholder')}
              value={searchQuery}
              onChange={(value) => {
                setSearchQuery(value);
                updateFilters({ search: value }, { replace: true });
              }}
            />
          }
        />

        {/* Status tabs */}
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
                {t('common.actions.loading', { entities: getName('customer', true) })}
              </p>
            </CardBody>
          </Card>
        )}

        {error && (
          <Card className="border-danger-500/40 bg-danger-100/40">
            <CardBody>
              <p className="text-[12.5px] text-danger-500">
                {t('common.actions.errorLoading', { entities: getName('customer', true) })}: {(error as Error).message}
              </p>
            </CardBody>
          </Card>
        )}

        {totalCustomers === 0 && !isLoading && (
          <Card>
            <CardBody>
              <p className="text-[12.5px] text-fg-muted">
                {deferredSearch || statusFilter !== 'all'
                  ? t('common.actions.noMatchSearch', { entities: getName('customer', true) })
                  : t('common.actions.notFound', { entities: getName('customer', true) })}
              </p>
              {canAddCustomers && !deferredSearch && statusFilter === 'all' && (
                <Button color="accent" className="mt-2" onClick={handleAdd}>
                  {t('common.actions.addFirst', { entity: getName('customer') })}
                </Button>
              )}
            </CardBody>
          </Card>
        )}

        {customers.length > 0 && (
          <Card>
            <CardBody flush>
              <DenseTable>
                <DenseTHead>
                  <tr>
                    <th>{t('customers.table.type')}</th>
                    <th>{t('common.form.name')}</th>
                    <th>{t('common.form.phone')}</th>
                    <th>{t('common.form.email')}</th>
                    <th>{t('customers.table.billingAddress')}</th>
                    <th>{t('customers.table.locations')}</th>
                    <th>{t('customers.table.terms')}</th>
                    <th>{t('common.form.status')}</th>
                    <th></th>
                  </tr>
                </DenseTHead>
                <tbody>
                  {customers.map((customer) => {
                    const terms: string[] = [];
                    if (customer.paymentTermsDays > 0) terms.push(`Net-${customer.paymentTermsDays}`);
                    if (customer.requiresPurchaseOrder) terms.push('PO');
                    if (customer.contractPricingTier) terms.push(customer.contractPricingTier);

                    return (
                      <DenseRow
                        key={customer.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/customers/${customer.id}`)}
                      >
                        <td>
                          {customer.displayMode === 'SIMPLE' ? (
                            <HomeIcon className="h-4 w-4 text-fg-muted" title="Homeowner" />
                          ) : customer.displayMode === 'BILLING_ONLY' ? (
                            <CreditCardIcon
                              className="h-4 w-4 text-fg-muted"
                              title={t('customers.detail.billingOnlyBadge')}
                            />
                          ) : (
                            <BuildingOfficeIcon className="h-4 w-4 text-fg-muted" title="Business" />
                          )}
                        </td>
                        <td className="strong">{customer.name}</td>
                        <td>
                          {customer.phone ? (
                            <a
                              href={`tel:${customer.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:underline"
                            >
                              {formatPhone(customer.phone)}
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>
                          <a
                            href={`mailto:${customer.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:underline"
                          >
                            {customer.email}
                          </a>
                        </td>
                        <td>
                          <CellStack>
                            <CellTop>{customer.billingAddress.streetAddress}</CellTop>
                            <CellSub>
                              {customer.billingAddress.city}, {customer.billingAddress.state} {customer.billingAddress.zipCode}
                            </CellSub>
                          </CellStack>
                        </td>
                        <td>
                          {customer.serviceLocationCount > 0
                            ? t('customers.table.locationsCount', { count: customer.serviceLocationCount })
                            : <span className="muted">{t('customers.table.none')}</span>}
                        </td>
                        <td>
                          {terms.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {terms.map((term, idx) => (
                                <Pill key={idx} tone="neutral">{term}</Pill>
                              ))}
                            </div>
                          ) : (
                            <span className="muted">-</span>
                          )}
                        </td>
                        <td>
                          <Pill tone={customer.status === 'ACTIVE' ? 'success' : 'neutral'}>
                            {customer.status === 'ACTIVE' ? t('common.active') : t('common.inactive')}
                          </Pill>
                        </td>
                        <td>
                          {(canEditCustomers || canArchiveCustomers) && (
                            <Dropdown>
                              <DropdownButton as={IconButton} aria-label={t('common.moreOptions')}>
                                <EllipsisVerticalIcon className="size-4" />
                              </DropdownButton>
                              <DropdownMenu anchor="bottom end">
                                <DropdownItem onClick={() => navigate(`/customers/${customer.id}`)}>
                                  <DropdownLabel>{t('common.view')}</DropdownLabel>
                                </DropdownItem>
                                {canEditCustomers && (
                                  <DropdownItem
                                    onClick={async () => {
                                      const fullCustomer = await customerApi.getById(customer.id);
                                      handleEdit(fullCustomer);
                                    }}
                                  >
                                    <DropdownLabel>{t('common.edit')}</DropdownLabel>
                                  </DropdownItem>
                                )}
                                {canArchiveCustomers && (
                                  <DropdownItem
                                    onClick={async () => {
                                      const fullCustomer = await customerApi.getById(customer.id);
                                      handleDelete(fullCustomer);
                                    }}
                                  >
                                    <DropdownLabel>{t('common.delete')}</DropdownLabel>
                                  </DropdownItem>
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
                  total: totalCustomers.toLocaleString(),
                })}
              />
            </CardBody>
          </Card>
        )}
      </div>

      <CustomerFormDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        customer={selectedCustomer}
      />
    </AppLayout>
  );
}
