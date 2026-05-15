import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EllipsisHorizontalIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import {
  invoicesApi,
  InvoiceStatus,
  paymentsApi,
  type Invoice,
  type InvoiceStatus as InvoiceStatusType,
  type NestedInvoicePayment,
  type PaymentMethod as PaymentMethodType,
} from '../api';
import PaymentDialog from './PaymentDialog';
import { Badge } from './catalyst/badge';
import { Button } from './catalyst/button';
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
  workOrderNumber: string;
  customerName: string;
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

// Invoice / due / payment dates are semantically dates, not timestamps —
// the backend ships them as ISO instants ("2026-05-10T00:00:00Z") but the
// meaningful part is the calendar date. Format in UTC so a CSR west of
// UTC doesn't see "May 9" for something that happened on May 10.
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

export default function FinancialInvoicesTab({
  workOrderId,
  workOrderNumber,
  customerName,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // PaymentDialog state — both entry points (tab-level + row-level) share
  // a single mounted dialog. `lockedInvoice` set ⇒ row-level entry; absent
  // ⇒ tab-level entry with the picker.
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [lockedInvoiceForPayment, setLockedInvoiceForPayment] =
    useState<Invoice | null>(null);

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

  const voidPayment = useMutation({
    mutationFn: (paymentId: string) => paymentsApi.void(paymentId),
    onSuccess: () => {
      // Backend cascade may demote PAID → SENT on the parent invoice and
      // adjust amountPaid/balanceDue across any invoices the payment was
      // applied to (split-payment case). Invalidate both queries.
      queryClient.invalidateQueries({ queryKey: ['workOrderInvoices', workOrderId] });
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

  const handleVoidPayment = (payment: NestedInvoicePayment) => {
    // Confirmation is honest about the cascade: voiding the payment row
    // here unwinds the FULL payment, not just its slice — backend reverses
    // amountPaid/balanceDue on every invoice it touched and demotes PAID
    // → SENT where applicable. The slice amount is shown as the "money
    // affecting this invoice" context.
    if (
      window.confirm(
        t('workOrders.financialDrawer.invoicesTab.voidPaymentConfirm', {
          number: payment.paymentNumber,
          amount: currencyFormatter.format(amt(payment.amount)),
        }),
      )
    ) {
      voidPayment.mutate(payment.id);
    }
  };

  // Tab-level + Record Payment: open dialog without a lock so the picker
  // shows. Disabled when no invoices have outstanding balance.
  const openInvoicesWithBalance = invoices.filter(
    (i) => amt(i.balanceDue) > 0 && !TERMINAL_STATUSES.includes(i.status),
  );

  const openPaymentDialogForRow = (invoice: Invoice) => {
    setLockedInvoiceForPayment(invoice);
    setPaymentDialogOpen(true);
  };

  const openPaymentDialogFromTab = () => {
    setLockedInvoiceForPayment(null);
    setPaymentDialogOpen(true);
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
    <div>
      {/* Tab header CTA row (§3.3). + New Invoice ships in step 8;
          + Record Payment ships now alongside the payments fold. */}
      <div className="mb-3 flex justify-end gap-2">
        <Button
          outline
          onClick={openPaymentDialogFromTab}
          disabled={openInvoicesWithBalance.length === 0}
          title={
            openInvoicesWithBalance.length === 0
              ? t('workOrders.financialDrawer.paymentDialog.noOpenInvoices')
              : undefined
          }
        >
          <PlusIcon className="size-4" />
          {t('workOrders.financialDrawer.invoicesTab.recordPayment')}
        </Button>
      </div>

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
                      <InvoiceExpansion
                        invoice={invoice}
                        onAddPayment={() => openPaymentDialogForRow(invoice)}
                        canAddPayment={
                          !isTerminal && amt(invoice.balanceDue) > 0
                        }
                        onVoidPayment={handleVoidPayment}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

      <PaymentDialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        workOrderId={workOrderId}
        workOrderNumber={workOrderNumber}
        customerName={customerName}
        openInvoices={openInvoicesWithBalance}
        lockedInvoice={lockedInvoiceForPayment ?? undefined}
      />
    </div>
  );
}

interface InvoiceExpansionProps {
  invoice: Invoice;
  onAddPayment: () => void;
  canAddPayment: boolean;
  onVoidPayment: (payment: NestedInvoicePayment) => void;
}

/**
 * Read-only inline expansion (§3.4). Three subsections in lifecycle order:
 * Line items → Payments → Notes. Payments are the new addition with the
 * ask #2 fold; they were a sibling Payments tab in the earlier design.
 *
 * Line-item editing is explicitly NOT here — that waits for inventory
 * (§8.1).
 */
function InvoiceExpansion({
  invoice,
  onAddPayment,
  canAddPayment,
  onVoidPayment,
}: InvoiceExpansionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
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

      <PaymentsSubsection
        payments={invoice.payments ?? []}
        invoiceId={invoice.id}
        onAddPayment={onAddPayment}
        canAddPayment={canAddPayment}
        onVoidPayment={onVoidPayment}
      />

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

interface PaymentsSubsectionProps {
  payments: NestedInvoicePayment[];
  invoiceId: string;
  onAddPayment: () => void;
  canAddPayment: boolean;
  onVoidPayment: (payment: NestedInvoicePayment) => void;
}

const PAYMENT_METHOD_LABEL_KEYS: Record<PaymentMethodType, string> = {
  CASH: 'CASH',
  CHECK: 'CHECK',
  CREDIT_CARD: 'CREDIT_CARD',
  DEBIT_CARD: 'DEBIT_CARD',
  ACH: 'ACH',
  WIRE_TRANSFER: 'WIRE_TRANSFER',
  OTHER: 'OTHER',
};

/**
 * Payments under an invoice row. Each row shows the slice of the payment
 * applied to *this* invoice (server-side: split payments appear in each
 * invoice's payments[] with their respective slice). The `paymentNumber`
 * may repeat across invoices for split payments — that's fine.
 *
 * Void per-row action (⋯ menu) unwinds the FULL payment, not just its
 * slice — the backend cascade reverses every invoice the payment touched
 * and demotes PAID → SENT where applicable. The confirmation copy makes
 * this explicit. Voided rows render muted with the ⋯ menu omitted.
 */
function PaymentsSubsection({
  payments,
  invoiceId,
  onAddPayment,
  canAddPayment,
  onVoidPayment,
}: PaymentsSubsectionProps) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t('workOrders.financialDrawer.invoicesTab.paymentsHeading')}
        </div>
        {canAddPayment && (
          <button
            type="button"
            onClick={onAddPayment}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-dashed border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:border-zinc-400 hover:text-zinc-800 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
          >
            <PlusIcon className="size-3" />
            {t('workOrders.financialDrawer.invoicesTab.addPayment')}
          </button>
        )}
      </div>
      {payments.length === 0 ? (
        <Text className="!text-sm !text-zinc-500">
          {t('workOrders.financialDrawer.invoicesTab.noPayments')}
        </Text>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs text-zinc-500 dark:text-zinc-400">
            <tr className="text-left">
              <th className="pb-1 font-medium">
                {t('workOrders.financialDrawer.invoicesTab.paymentColumns.paymentNumber')}
              </th>
              <th className="pb-1 font-medium">
                {t('workOrders.financialDrawer.invoicesTab.paymentColumns.date')}
              </th>
              <th className="pb-1 font-medium">
                {t('workOrders.financialDrawer.invoicesTab.paymentColumns.method')}
              </th>
              <th className="pb-1 text-right font-medium">
                {t('workOrders.financialDrawer.invoicesTab.paymentColumns.amount')}
              </th>
              <th className="pb-1 font-medium">
                {t('workOrders.financialDrawer.invoicesTab.paymentColumns.reference')}
              </th>
              <th className="w-8 pb-1" />
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => {
              const isVoided = p.status === 'VOID';
              return (
                <tr
                  // Composite key: a payment id may repeat across invoices
                  // (split payment case per backend ask #2 update); scope
                  // the key to this invoice to keep React happy.
                  key={`${invoiceId}-${p.id}`}
                  className={`border-t border-zinc-200 dark:border-white/10 ${
                    isVoided ? 'opacity-50' : ''
                  }`}
                >
                  <td className="py-1 font-mono">{p.paymentNumber}</td>
                  <td className="py-1">{formatDate(p.paymentDate)}</td>
                  <td className="py-1">
                    {t(
                      `workOrders.financialDrawer.paymentDialog.methods.${PAYMENT_METHOD_LABEL_KEYS[p.paymentMethod]}`,
                    )}
                  </td>
                  <td className="py-1 text-right font-medium tabular-nums">
                    {currencyFormatter.format(amt(p.amount))}
                  </td>
                  <td className="py-1 text-zinc-500 dark:text-zinc-400">
                    {p.referenceNumber ?? '—'}
                  </td>
                  <td className="py-1">
                    {!isVoided && (
                      <Dropdown>
                        <DropdownButton
                          plain
                          aria-label={t('common.moreOptions')}
                        >
                          <EllipsisHorizontalIcon className="size-4" />
                        </DropdownButton>
                        <DropdownMenu anchor="bottom end">
                          <DropdownItem onClick={() => onVoidPayment(p)}>
                            <DropdownLabel>
                              {t(
                                'workOrders.financialDrawer.invoicesTab.actions.voidPayment',
                              )}
                            </DropdownLabel>
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
