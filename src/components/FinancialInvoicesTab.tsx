import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EllipsisHorizontalIcon,
} from '@heroicons/react/24/outline';
import {
  invoicesApi,
  InvoiceStatus,
  type Invoice,
  type InvoiceStatus as InvoiceStatusType,
} from '../api';
import { Badge } from './catalyst/badge';
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from './catalyst/dropdown';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './catalyst/table';
import { Text } from './catalyst/text';

interface Props {
  workOrderId: string;
}

// §3.3 status pill palette. OVERDUE is server-derived (date-based per §7
// open question); the UI never lets the CSR pick it.
const STATUS_COLORS: Record<
  InvoiceStatusType,
  'zinc' | 'sky' | 'lime' | 'amber'
> = {
  DRAFT: 'zinc',
  SENT: 'sky',
  PAID: 'lime',
  OVERDUE: 'amber',
  CANCELLED: 'zinc',
  VOID: 'zinc',
};

const STATUS_LABEL_KEYS: Record<InvoiceStatusType, string> = {
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
  VOID: 'void',
};

// Valid CSR-driven transitions per §7 (pragmatic v1; backend may reject
// invalid combos). OVERDUE is omitted from every target list — it's
// computed from due-date, not user-driven. PAID & VOID & CANCELLED are
// terminal-ish; you'd void-and-recreate rather than transition out.
const STATUS_TRANSITIONS: Record<InvoiceStatusType, InvoiceStatusType[]> = {
  DRAFT: ['SENT', 'CANCELLED', 'VOID'],
  SENT: ['PAID', 'CANCELLED', 'VOID'],
  PAID: ['VOID'],
  OVERDUE: ['PAID', 'VOID'],
  CANCELLED: [],
  VOID: [],
};

const TERMINAL_STATUSES: InvoiceStatusType[] = ['VOID', 'CANCELLED'];

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

// Invoice / due dates are semantically dates, not timestamps — the backend
// ships them as ISO instants ("2026-05-10T00:00:00Z") but the meaningful
// part is the calendar date. Format in UTC so a CSR west of UTC doesn't
// see "May 9" for an invoice that was billed on May 10.
const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

// Backend serializes BigDecimal as strings (see ask #2 contract). The
// Invoice type still types money fields as `number` for now (pre-existing
// definition); runtime values are strings. `Number()` coerces either form
// safely for display decisions; Intl.NumberFormat tolerates both. Never use
// these for arithmetic — chip / table totals are server-computed.
const amt = (v: number | string | null | undefined): number => Number(v ?? 0) || 0;

export default function FinancialInvoicesTab({ workOrderId }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const {
    data: invoices = [],
    isLoading,
    isError,
  } = useQuery<Invoice[]>({
    queryKey: ['workOrderInvoices', workOrderId],
    queryFn: () => invoicesApi.getByWorkOrder(workOrderId),
    enabled: !!workOrderId,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: InvoiceStatusType }) =>
      invoicesApi.updateStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrderInvoices', workOrderId] });
      // Status changes affect VOID/CANCELLED exclusion in the summary rollup
      // — invalidate so the header chips re-fetch.
      queryClient.invalidateQueries({ queryKey: ['financialSummary', workOrderId] });
    },
  });

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStatusChange = (invoice: Invoice, next: InvoiceStatusType) => {
    if (next === invoice.status) return;
    updateStatus.mutate({ id: invoice.id, status: next });
  };

  const handleVoid = (invoice: Invoice) => {
    if (
      window.confirm(
        t('workOrders.financialDrawer.invoicesTab.voidConfirm', {
          number: invoice.invoiceNumber,
          amount: currencyFormatter.format(amt(invoice.totalAmount)),
        }),
      )
    ) {
      updateStatus.mutate({ id: invoice.id, status: InvoiceStatus.VOID });
    }
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <Text className="!text-sm !text-zinc-500">
          {t('workOrders.financialDrawer.invoicesTab.loading')}
        </Text>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-8 text-center">
        <Text className="!text-sm !text-rose-600 dark:!text-rose-400">
          {t('workOrders.financialDrawer.invoicesTab.errorLoading')}
        </Text>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="py-12 text-center">
        <Text className="!text-sm !text-zinc-500">
          {t('workOrders.financialDrawer.invoicesTab.empty')}
        </Text>
      </div>
    );
  }

  return (
    <Table dense className="[--gutter:theme(spacing.1)] text-sm">
      <TableHead>
        <TableRow>
          <TableHeader className="w-8" />
          <TableHeader>
            {t('workOrders.financialDrawer.invoicesTab.columns.invoiceNumber')}
          </TableHeader>
          <TableHeader>
            {t('workOrders.financialDrawer.invoicesTab.columns.date')}
          </TableHeader>
          <TableHeader>
            {t('workOrders.financialDrawer.invoicesTab.columns.due')}
          </TableHeader>
          <TableHeader>
            {t('workOrders.financialDrawer.invoicesTab.columns.status')}
          </TableHeader>
          <TableHeader className="text-right">
            {t('workOrders.financialDrawer.invoicesTab.columns.total')}
          </TableHeader>
          <TableHeader className="text-right">
            {t('workOrders.financialDrawer.invoicesTab.columns.paid')}
          </TableHeader>
          <TableHeader className="text-right">
            {t('workOrders.financialDrawer.invoicesTab.columns.balance')}
          </TableHeader>
          <TableHeader className="w-8" />
        </TableRow>
      </TableHead>
      <TableBody>
        {invoices.map((invoice) => {
          const isExpanded = expanded.has(invoice.id);
          const isVoided = invoice.status === InvoiceStatus.VOID;
          const isTerminal = TERMINAL_STATUSES.includes(invoice.status);
          const transitions = STATUS_TRANSITIONS[invoice.status];
          // Voided rows render muted — they still appear in the table for
          // audit but visually deprioritized.
          const rowMuted = isVoided ? 'opacity-60' : '';

          return (
            <Fragment key={invoice.id}>
              <TableRow className={rowMuted}>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => toggleExpand(invoice.id)}
                    className="cursor-pointer rounded p-0.5 hover:bg-zinc-100 dark:hover:bg-white/5"
                    aria-label={
                      isExpanded
                        ? t('workOrders.financialDrawer.invoicesTab.collapseRow')
                        : t('workOrders.financialDrawer.invoicesTab.expandRow')
                    }
                  >
                    {isExpanded ? (
                      <ChevronDownIcon className="size-4" />
                    ) : (
                      <ChevronRightIcon className="size-4" />
                    )}
                  </button>
                </TableCell>
                <TableCell className="font-mono">
                  {invoice.invoiceNumber}
                </TableCell>
                <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                <TableCell>
                  {transitions.length === 0 ? (
                    <Badge color={STATUS_COLORS[invoice.status]}>
                      {t(
                        `workOrders.financialDrawer.invoicesTab.statuses.${
                          STATUS_LABEL_KEYS[invoice.status]
                        }`,
                      )}
                    </Badge>
                  ) : (
                    <Dropdown>
                      <DropdownButton
                        as="button"
                        type="button"
                        className="cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        aria-label={t(
                          'workOrders.financialDrawer.invoicesTab.changeStatus',
                          {
                            current: t(
                              `workOrders.financialDrawer.invoicesTab.statuses.${
                                STATUS_LABEL_KEYS[invoice.status]
                              }`,
                            ),
                          },
                        )}
                      >
                        <Badge color={STATUS_COLORS[invoice.status]}>
                          {t(
                            `workOrders.financialDrawer.invoicesTab.statuses.${
                              STATUS_LABEL_KEYS[invoice.status]
                            }`,
                          )}
                        </Badge>
                      </DropdownButton>
                      <DropdownMenu anchor="bottom start">
                        {transitions.map((next) => (
                          <DropdownItem
                            key={next}
                            onClick={() => handleStatusChange(invoice, next)}
                          >
                            <DropdownLabel>
                              {t(
                                `workOrders.financialDrawer.invoicesTab.statuses.${STATUS_LABEL_KEYS[next]}`,
                              )}
                            </DropdownLabel>
                          </DropdownItem>
                        ))}
                      </DropdownMenu>
                    </Dropdown>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {currencyFormatter.format(amt(invoice.totalAmount))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {currencyFormatter.format(amt(invoice.amountPaid))}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {currencyFormatter.format(amt(invoice.balanceDue))}
                </TableCell>
                <TableCell>
                  {!isTerminal && (
                    <Dropdown>
                      <DropdownButton
                        plain
                        aria-label={t('common.moreOptions')}
                      >
                        <EllipsisHorizontalIcon className="size-5" />
                      </DropdownButton>
                      <DropdownMenu anchor="bottom end">
                        {invoice.status !== InvoiceStatus.PAID && (
                          <DropdownItem
                            onClick={() =>
                              handleStatusChange(invoice, InvoiceStatus.PAID)
                            }
                          >
                            <DropdownLabel>
                              {t(
                                'workOrders.financialDrawer.invoicesTab.actions.markPaid',
                              )}
                            </DropdownLabel>
                          </DropdownItem>
                        )}
                        <DropdownItem onClick={() => handleVoid(invoice)}>
                          <DropdownLabel>
                            {t(
                              'workOrders.financialDrawer.invoicesTab.actions.void',
                            )}
                          </DropdownLabel>
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  )}
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow className={rowMuted}>
                  <TableCell />
                  <TableCell
                    colSpan={8}
                    className="!py-3 bg-zinc-50 dark:bg-white/5"
                  >
                    <InvoiceExpansion invoice={invoice} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

interface InvoiceExpansionProps {
  invoice: Invoice;
}

/**
 * Read-only inline expansion (§3.4). Shows line items in a compact table
 * plus notes if present. We're explicitly NOT investing in editing
 * affordances here — line-item editing waits for inventory (§8.1).
 */
function InvoiceExpansion({ invoice }: InvoiceExpansionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t('workOrders.financialDrawer.invoicesTab.lineItemsHeading')}
        </div>
        {invoice.lineItems.length === 0 ? (
          <Text className="!text-sm !text-zinc-500">
            {t('workOrders.financialDrawer.invoicesTab.noLineItems')}
          </Text>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500 dark:text-zinc-400">
              <tr className="text-left">
                <th className="pb-1 font-medium">
                  {t('workOrders.financialDrawer.invoicesTab.lineColumns.description')}
                </th>
                <th className="pb-1 text-right font-medium">
                  {t('workOrders.financialDrawer.invoicesTab.lineColumns.quantity')}
                </th>
                <th className="pb-1 text-right font-medium">
                  {t('workOrders.financialDrawer.invoicesTab.lineColumns.unitPrice')}
                </th>
                <th className="pb-1 text-right font-medium">
                  {t('workOrders.financialDrawer.invoicesTab.lineColumns.lineTotal')}
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((li) => (
                <tr
                  key={li.id}
                  className="border-t border-zinc-200 dark:border-white/10"
                >
                  <td className="py-1">{li.description}</td>
                  <td className="py-1 text-right tabular-nums">
                    {amt(li.quantity)}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {currencyFormatter.format(amt(li.unitPrice))}
                  </td>
                  <td className="py-1 text-right font-medium tabular-nums">
                    {currencyFormatter.format(amt(li.lineTotal))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {invoice.notes && (
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t('workOrders.financialDrawer.invoicesTab.notesHeading')}
          </div>
          <Text className="!text-sm whitespace-pre-wrap">{invoice.notes}</Text>
        </div>
      )}
    </div>
  );
}

