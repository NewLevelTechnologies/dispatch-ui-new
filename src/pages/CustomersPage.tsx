import { useEffect, useState, useDeferredValue } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { EllipsisVerticalIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { customerApi, type Customer, type TagSummary } from '../api';
import { useGlossary } from '../contexts/GlossaryContext';
import { useHasCapability } from '../hooks/useCurrentUser';
import AppLayout from '../components/AppLayout';
import CustomerFormDialog from '../components/CustomerFormDialog';
import { formatPhone } from '../utils/formatPhone';
import { extractApiError, showError } from '../lib/toast';
import { Button } from '../components/catalyst/button';
import { Dropdown, DropdownButton, DropdownItem, DropdownLabel, DropdownMenu } from '../components/catalyst/dropdown';
import IconButton from '../components/IconButton';
import { PageHead } from '../components/ui/PageHead';
import { Card, CardBody } from '../components/ui/Card';
import { Pill } from '../components/ui/Pill';
import { CustomerTypeMark } from '../components/ui/CustomerTypeMark';
import { FilterChipRow, FilterChip } from '../components/ui/FilterChipRow';
import {
  DenseTable, DenseTHead, DenseRow, CellStack, CellTop, CellSub,
} from '../components/ui/DenseTable';
import { ListToolbar, ListSearch } from '../components/ui/ListToolbar';
import { ListFooter } from '../components/ui/ListFooter';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';

// Desktop-dense CSR layout — see CLAUDE.md. 50 per page keeps two pages
// visible on a 1080p monitor without scrolling.
const PAGE_SIZE = 50;

type CategoryFilter = '' | 'COMMERCIAL' | 'RESIDENTIAL';

function readCategory(raw: string | null): CategoryFilter {
  return raw === 'COMMERCIAL' || raw === 'RESIDENTIAL' ? raw : '';
}

function readBool(raw: string | null): boolean {
  return raw === 'true' || raw === '1';
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { getName } = useGlossary();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // URL-driven filter state (same pattern as UsersPage). Default values
  // (page=1, no filter) are omitted from the URL to keep links clean.
  const urlSearch = searchParams.get('search') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const categoryFilter = readCategory(searchParams.get('category'));
  const openBalanceFilter = readBool(searchParams.get('openBalance'));
  const openJobsFilter = readBool(searchParams.get('openJobs'));
  const agedFilter = readBool(searchParams.get('aged'));

  // Local input mirrors the URL but lets typing feel instant.
  const [searchQuery, setSearchQuery] = useState(urlSearch);
  useEffect(() => {
    setSearchQuery(urlSearch);
  }, [urlSearch]);
  const deferredSearch = useDeferredValue(searchQuery);

  const canAddCustomers = useHasCapability('ADD_CUSTOMERS');
  const canEditCustomers = useHasCapability('EDIT_CUSTOMERS');
  const canArchiveCustomers = useHasCapability('ARCHIVE_CUSTOMERS');

  const updateFilters = (
    updates: {
      search?: string;
      category?: CategoryFilter;
      openBalance?: boolean;
      openJobs?: boolean;
      aged?: boolean;
      page?: number;
    },
    options: { replace?: boolean } = {}
  ) => {
    const next = new URLSearchParams(searchParams);
    const setOrDelete = (key: string, value: string | undefined) => {
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
    };

    if (updates.search !== undefined) setOrDelete('search', updates.search || undefined);
    if (updates.category !== undefined) setOrDelete('category', updates.category || undefined);
    if (updates.openBalance !== undefined) setOrDelete('openBalance', updates.openBalance ? 'true' : undefined);
    if (updates.openJobs !== undefined) setOrDelete('openJobs', updates.openJobs ? 'true' : undefined);
    if (updates.aged !== undefined) setOrDelete('aged', updates.aged ? 'true' : undefined);
    if (updates.page !== undefined) {
      if (updates.page <= 1) next.delete('page');
      else next.set('page', String(updates.page));
    }
    setSearchParams(next, { replace: options.replace ?? false });
  };

  const pageHref = (target: number): string => {
    const next = new URLSearchParams(searchParams);
    if (target <= 1) next.delete('page');
    else next.set('page', String(target));
    const qs = next.toString();
    return qs ? `?${qs}` : '?';
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      'customers',
      page,
      deferredSearch,
      categoryFilter,
      openBalanceFilter,
      openJobsFilter,
      agedFilter,
    ],
    queryFn: () => customerApi.getAllPaginated({
      page,
      limit: PAGE_SIZE,
      search: deferredSearch || undefined,
      category: categoryFilter || undefined,
      hasOpenBalance: openBalanceFilter || undefined,
      hasOpenJobs: openJobsFilter || undefined,
      hasAgedBalance: agedFilter || undefined,
    }),
  });

  const customers = data?.content ?? [];
  const totalCustomers = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const counts = data?.counts;
  const showingStart = totalCustomers === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingEnd = Math.min(page * PAGE_SIZE, totalCustomers);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customerApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: unknown) => {
      showError(
        t('common.form.errorDelete', { entity: getName('customer') }),
        extractApiError(err) ?? undefined
      );
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

  // Header subtitle uses server counts when available; falls back to the
  // current page's total when the BE counts envelope hasn't landed yet.
  const headerTotal = counts?.total ?? totalCustomers;
  const headerActive = counts?.active;
  const customerNoun =
    headerTotal === 1
      ? getName('customer').toLowerCase()
      : getName('customer', true).toLowerCase();
  const subtitle = (() => {
    if (headerTotal === 0 && !isLoading) return null;
    const parts: string[] = [`${headerTotal.toLocaleString()} ${customerNoun}`];
    if (typeof headerActive === 'number') {
      parts.push(`${headerActive.toLocaleString()} ${t('common.active').toLowerCase()}`);
    }
    return (
      <>
        {parts.join(' · ')}
        {' · '}
        <Link to="/payers" className="text-fg-accent hover:underline">
          {t('customers.viewPayers', { entities: getName('payer', true) })}
        </Link>
      </>
    );
  })();

  const hasFilters = Boolean(
    deferredSearch || categoryFilter || openBalanceFilter || openJobsFilter || agedFilter
  );
  const clearFilters = () => {
    setSearchQuery('');
    setSearchParams(new URLSearchParams(), { replace: false });
  };

  return (
    <AppLayout>
      <div>
        <PageHead
          title={getName('customer', true)}
          sub={subtitle}
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
        >
          <FilterChipRow>
            <FilterChip
              label={t('customers.filter.commercial')}
              count={counts?.commercial}
              active={categoryFilter === 'COMMERCIAL'}
              onToggle={() =>
                updateFilters({
                  category: categoryFilter === 'COMMERCIAL' ? '' : 'COMMERCIAL',
                })
              }
            />
            <FilterChip
              label={t('customers.filter.residential')}
              count={counts?.residential}
              active={categoryFilter === 'RESIDENTIAL'}
              onToggle={() =>
                updateFilters({
                  category: categoryFilter === 'RESIDENTIAL' ? '' : 'RESIDENTIAL',
                })
              }
            />
            <FilterChip
              label={t('customers.filter.openBalance')}
              count={counts?.openBalance}
              active={openBalanceFilter}
              onToggle={() => updateFilters({ openBalance: !openBalanceFilter })}
            />
            <FilterChip
              label={t('customers.filter.openJobs')}
              count={counts?.openJobs}
              tone="info"
              active={openJobsFilter}
              onToggle={() => updateFilters({ openJobs: !openJobsFilter })}
            />
            <FilterChip
              label={t('customers.filter.aged')}
              count={counts?.aged}
              tone="warning"
              active={agedFilter}
              onToggle={() => updateFilters({ aged: !agedFilter })}
            />
          </FilterChipRow>
        </ListToolbar>

        <Card>
          <CardBody flush>
            {isLoading ? (
              <LoadingState
                label={t('common.actions.loading', { entities: getName('customer', true) })}
              />
            ) : error ? (
              <ErrorState
                title={t('common.actions.couldNotLoad', { entities: getName('customer', true) })}
                description={extractApiError(error) ?? (error as Error).message}
                action={
                  <Button outline onClick={() => refetch()}>
                    {t('common.actions.tryAgain')}
                  </Button>
                }
              />
            ) : customers.length === 0 ? (
              hasFilters ? (
                <EmptyState
                  icon={<UserGroupIcon className="size-10 text-fg-dim" />}
                  title={t('common.actions.noMatchFilters', { entities: getName('customer', true) })}
                  description={t('common.actions.tryAdjustingFilters')}
                  action={
                    <Button outline onClick={clearFilters}>
                      {t('users.filter.clearFilters')}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<UserGroupIcon className="size-10 text-fg-dim" />}
                  title={t('common.actions.noEntitiesYet', { entities: getName('customer', true) })}
                  action={
                    canAddCustomers ? (
                      <Button color="accent" onClick={handleAdd}>
                        {t('common.actions.add', { entity: getName('customer') })}
                      </Button>
                    ) : undefined
                  }
                />
              )
            ) : (
              <>
                <DenseTable>
                  <DenseTHead>
                    <tr>
                      <th>{getName('customer')}</th>
                      <th>{t('customers.table.billingAddress')}</th>
                      <th>{t('customers.table.contact')}</th>
                      <th>{t('customers.table.openJobs')}</th>
                      <th>{t('customers.table.tags')}</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </DenseTHead>
                  <tbody>
                    {customers.map((customer) => {
                      const category =
                        customer.category === 'RESIDENTIAL' ? 'RESIDENTIAL' : 'COMMERCIAL';
                      return (
                        <DenseRow
                          key={customer.id}
                          className="cursor-pointer"
                          onClick={(e: React.MouseEvent) => {
                            const target = e.target as HTMLElement;
                            if (target.closest('[role="menu"]') || target.closest('button[aria-label]') || target.closest('a')) return;
                            navigate(`/customers/${customer.id}`);
                          }}
                        >
                          <td>
                            <div className="flex items-center gap-2">
                              <CustomerTypeMark category={category} />
                              <CellStack>
                                <CellTop>
                                  <span className="font-semibold text-fg-strong">{customer.name}</span>
                                  {customer.hasAgedBalance && (
                                    <Pill
                                      tone="warning"
                                      className="ml-1.5 align-middle text-[9.5px] font-bold uppercase tracking-[0.04em]"
                                      title={t('customers.agedBadgeAria')}
                                    >
                                      {t('customers.agedBadge')}
                                    </Pill>
                                  )}
                                </CellTop>
                                <CellSub>
                                  {customer.serviceLocationCount > 1
                                    ? t('customers.table.locationsCount', { count: customer.serviceLocationCount })
                                    : null}
                                </CellSub>
                              </CellStack>
                            </div>
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
                            <CellStack>
                              <CellTop>
                                {customer.phone ? (
                                  <a
                                    href={`tel:${customer.phone}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="font-mono hover:underline"
                                  >
                                    {formatPhone(customer.phone)}
                                  </a>
                                ) : (
                                  <span className="text-fg-dim">—</span>
                                )}
                              </CellTop>
                              <CellSub>
                                <a
                                  href={`mailto:${customer.email}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="hover:underline"
                                >
                                  {customer.email}
                                </a>
                              </CellSub>
                            </CellStack>
                          </td>
                          <td>
                            {customer.openJobsCount && customer.openJobsCount > 0 ? (
                              <Pill tone="info" dot>
                                {t('customers.table.jobsCount', { count: customer.openJobsCount })}
                              </Pill>
                            ) : (
                              <span className="text-fg-dim">—</span>
                            )}
                          </td>
                          <td>
                            <TagList tags={customer.tags} />
                          </td>
                          <td className="right">
                            {(canEditCustomers || canArchiveCustomers) && (
                              <div onClick={(e) => e.stopPropagation()}>
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
                              </div>
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
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <CustomerFormDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        customer={selectedCustomer}
      />
    </AppLayout>
  );
}

// Up to two tags visible + "+N" overflow. Color from tag.color isn't surfaced
// here — uniform muted treatment keeps the row scannable; per-tag color shows
// in the tag editor where it's actionable.
function TagList({ tags }: { tags?: TagSummary[] }) {
  if (!tags || tags.length === 0) return <span className="text-fg-dim">—</span>;
  const visible = tags.slice(0, 2);
  const overflow = tags.slice(2);
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex max-w-[140px] items-center truncate rounded-full border border-border-soft bg-bg-active px-2 py-[1px] text-[10.5px] font-medium text-fg-muted"
        >
          {tag.name}
        </span>
      ))}
      {overflow.length > 0 && (
        <span title={overflow.map((tag) => tag.name).join(', ')}>
          <Pill tone="neutral">+{overflow.length}</Pill>
        </span>
      )}
    </div>
  );
}
