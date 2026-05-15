import { Fragment, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EllipsisHorizontalIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import {
  quotesApi,
  QuoteStatus,
  type Quote,
  type QuoteStatus as QuoteStatusType,
} from '../api';
import { useGlossary } from '../contexts/GlossaryContext';
import QuoteDialog from './QuoteDialog';
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
  customerId: string;
  customerName: string;
  /**
   * Increments each time the parent chip-row's `[+ Quote]` ghost is
   * clicked. Same monotonic-counter signal pattern used by the
   * Invoices tab — auto-opens the create dialog whenever the value
   * changes and is non-zero.
   */
  openQuoteCreateSignal?: number;
}

// §3.3 status pill palette for Quotes. EXPIRED is server-derived
// (date-based); the UI never lets a CSR pick it directly.
const STATUS_COLORS: Record<
  QuoteStatusType,
  'zinc' | 'sky' | 'lime' | 'amber' | 'rose'
> = {
  DRAFT: 'zinc',
  SENT: 'sky',
  ACCEPTED: 'lime',
  DECLINED: 'rose',
  EXPIRED: 'amber',
};

const STATUS_LABEL_KEYS: Record<QuoteStatusType, string> = {
  DRAFT: 'draft',
  SENT: 'sent',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
};

// Valid CSR-driven transitions. EXPIRED omitted (server-derived from
// expirationDate). Terminal-ish states (ACCEPTED / DECLINED / EXPIRED)
// stay terminal — recreate-and-resend rather than transition out.
const STATUS_TRANSITIONS: Record<QuoteStatusType, QuoteStatusType[]> = {
  DRAFT: ['SENT'],
  SENT: ['ACCEPTED', 'DECLINED'],
  ACCEPTED: [],
  DECLINED: [],
  EXPIRED: [],
};

const TERMINAL_STATUSES: QuoteStatusType[] = ['ACCEPTED', 'DECLINED', 'EXPIRED'];

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

// Same UTC-formatted display as the Invoices tab — quote / expiration
// dates are semantically dates, not timestamps, despite the backend
// shipping them as ISO instants.
const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

const amt = (v: number | string | null | undefined): number => Number(v ?? 0) || 0;

/**
 * WO-scoped quotes tab inside the financial drawer (Phase 7b). Mirrors
 * `FinancialInvoicesTab`'s structure — dense Catalyst table with status
 * pill inline-edit, `⋯` row menu, and read-only line-item row expansion.
 * Quotes don't carry payments, so the expansion is simpler than the
 * invoices one.
 */
export default function FinancialQuotesTab({
  workOrderId,
  workOrderNumber,
  customerId,
  customerName,
  openQuoteCreateSignal,
}: Props) {
  const { t } = useTranslation();
  const { getName } = useGlossary();
  const quoteLabel = getName('quote');
  const quotesLabel = getName('quote', true);
  const workOrderLabel = getName('work_order');
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);

  // Auto-open the create dialog when the parent chip-row ghost signals.
  // Same monotonic counter pattern as the Invoices tab.
  useEffect(() => {
    if (openQuoteCreateSignal && openQuoteCreateSignal > 0) {
      /* eslint-disable react-hooks/set-state-in-effect -- parent signal pattern */
      setQuoteDialogOpen(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [openQuoteCreateSignal]);

  const {
    data: quotes = [],
    isLoading,
    isError,
  } = useQuery<Quote[]>({
    queryKey: ['workOrderQuotes', workOrderId],
    queryFn: () => quotesApi.getByWorkOrder(workOrderId),
    enabled: !!workOrderId,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuoteStatusType }) =>
      quotesApi.updateStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrderQuotes', workOrderId] });
      // Status changes affect DECLINED/EXPIRED exclusion in the summary
      // rollup's `quoted` field — invalidate so the header chips refetch.
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

  const handleStatusChange = (quote: Quote, next: QuoteStatusType) => {
    if (next === quote.status) return;
    updateStatus.mutate({ id: quote.id, status: next });
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <Text className="!text-sm !text-zinc-500">
          {t('workOrders.financialDrawer.quotesTab.loading', {
            entities: quotesLabel,
          })}
        </Text>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-8 text-center">
        <Text className="!text-sm !text-rose-600 dark:!text-rose-400">
          {t('workOrders.financialDrawer.quotesTab.errorLoading', {
            entities: quotesLabel,
          })}
        </Text>
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <>
        <div className="py-12 text-center">
          <Text className="!text-sm !text-zinc-500">
            {t('workOrders.financialDrawer.quotesTab.empty', {
              entities: quotesLabel,
              workOrder: workOrderLabel,
            })}
          </Text>
          <div className="mt-4 flex justify-center">
            <Button color="dark/zinc" onClick={() => setQuoteDialogOpen(true)}>
              <PlusIcon className="size-4" />
              {t('workOrders.financialDrawer.quotesTab.newQuote', {
                entity: quoteLabel,
              })}
            </Button>
          </div>
        </div>
        <QuoteDialog
          open={quoteDialogOpen}
          onClose={() => setQuoteDialogOpen(false)}
          workOrderId={workOrderId}
          workOrderNumber={workOrderNumber}
          defaultCustomer={{ id: customerId, name: customerName }}
        />
      </>
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end gap-2">
        <Button color="dark/zinc" onClick={() => setQuoteDialogOpen(true)}>
          <PlusIcon className="size-4" />
          {t('workOrders.financialDrawer.quotesTab.newQuote', {
            entity: quoteLabel,
          })}
        </Button>
      </div>

      <Table dense className="[--gutter:theme(spacing.1)] text-sm">
        <TableHead>
          <TableRow>
            <TableHeader className="w-8" />
            <TableHeader>
              {t('workOrders.financialDrawer.quotesTab.columns.quoteNumber', {
                entity: quoteLabel,
              })}
            </TableHeader>
            <TableHeader>
              {t('workOrders.financialDrawer.quotesTab.columns.date')}
            </TableHeader>
            <TableHeader>
              {t('workOrders.financialDrawer.quotesTab.columns.expires')}
            </TableHeader>
            <TableHeader>
              {t('workOrders.financialDrawer.quotesTab.columns.status')}
            </TableHeader>
            <TableHeader className="text-right">
              {t('workOrders.financialDrawer.quotesTab.columns.total')}
            </TableHeader>
            <TableHeader className="w-8" />
          </TableRow>
        </TableHead>
        <TableBody>
          {quotes.map((quote) => {
            const isExpanded = expanded.has(quote.id);
            const isTerminal = TERMINAL_STATUSES.includes(quote.status);
            const transitions = STATUS_TRANSITIONS[quote.status];
            // Terminal rows (declined / expired) render muted; accepted
            // stays at normal opacity since it's the success state.
            const rowMuted =
              quote.status === 'DECLINED' || quote.status === 'EXPIRED'
                ? 'opacity-60'
                : '';

            return (
              <Fragment key={quote.id}>
                <TableRow className={rowMuted}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => toggleExpand(quote.id)}
                      className="cursor-pointer rounded p-0.5 hover:bg-zinc-100 dark:hover:bg-white/5"
                      aria-label={
                        isExpanded
                          ? t('workOrders.financialDrawer.quotesTab.collapseRow')
                          : t('workOrders.financialDrawer.quotesTab.expandRow')
                      }
                    >
                      {isExpanded ? (
                        <ChevronDownIcon className="size-4" />
                      ) : (
                        <ChevronRightIcon className="size-4" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="font-mono">{quote.quoteNumber}</TableCell>
                  <TableCell>{formatDate(quote.quoteDate)}</TableCell>
                  <TableCell>{formatDate(quote.expirationDate)}</TableCell>
                  <TableCell>
                    {transitions.length === 0 ? (
                      <Badge color={STATUS_COLORS[quote.status]}>
                        {t(
                          `workOrders.financialDrawer.quotesTab.statuses.${
                            STATUS_LABEL_KEYS[quote.status]
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
                            'workOrders.financialDrawer.quotesTab.changeStatus',
                            {
                              current: t(
                                `workOrders.financialDrawer.quotesTab.statuses.${
                                  STATUS_LABEL_KEYS[quote.status]
                                }`,
                              ),
                            },
                          )}
                        >
                          <Badge color={STATUS_COLORS[quote.status]}>
                            {t(
                              `workOrders.financialDrawer.quotesTab.statuses.${
                                STATUS_LABEL_KEYS[quote.status]
                              }`,
                            )}
                          </Badge>
                        </DropdownButton>
                        <DropdownMenu anchor="bottom start">
                          {transitions.map((next) => (
                            <DropdownItem
                              key={next}
                              onClick={() => handleStatusChange(quote, next)}
                            >
                              <DropdownLabel>
                                {t(
                                  `workOrders.financialDrawer.quotesTab.statuses.${STATUS_LABEL_KEYS[next]}`,
                                )}
                              </DropdownLabel>
                            </DropdownItem>
                          ))}
                        </DropdownMenu>
                      </Dropdown>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {currencyFormatter.format(amt(quote.totalAmount))}
                  </TableCell>
                  <TableCell>
                    {!isTerminal && quote.status === QuoteStatus.SENT && (
                      <Dropdown>
                        <DropdownButton plain aria-label={t('common.moreOptions')}>
                          <EllipsisHorizontalIcon className="size-5" />
                        </DropdownButton>
                        <DropdownMenu anchor="bottom end">
                          <DropdownItem
                            onClick={() =>
                              handleStatusChange(quote, QuoteStatus.ACCEPTED)
                            }
                          >
                            <DropdownLabel>
                              {t(
                                'workOrders.financialDrawer.quotesTab.actions.markAccepted',
                              )}
                            </DropdownLabel>
                          </DropdownItem>
                          <DropdownItem
                            onClick={() =>
                              handleStatusChange(quote, QuoteStatus.DECLINED)
                            }
                          >
                            <DropdownLabel>
                              {t(
                                'workOrders.financialDrawer.quotesTab.actions.markDeclined',
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
                      colSpan={6}
                      className="!py-3 bg-zinc-50 dark:bg-white/5"
                    >
                      <QuoteExpansion quote={quote} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

      <QuoteDialog
        open={quoteDialogOpen}
        onClose={() => setQuoteDialogOpen(false)}
        workOrderId={workOrderId}
        workOrderNumber={workOrderNumber}
        defaultCustomer={{ id: customerId, name: customerName }}
      />
    </div>
  );
}

interface QuoteExpansionProps {
  quote: Quote;
}

/**
 * Read-only inline expansion (§3.4): line items + notes. Unlike invoice
 * expansion, quotes don't carry payments — they're pre-billing documents.
 */
function QuoteExpansion({ quote }: QuoteExpansionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t('workOrders.financialDrawer.quotesTab.lineItemsHeading')}
        </div>
        {quote.lineItems.length === 0 ? (
          <Text className="!text-sm !text-zinc-500">
            {t('workOrders.financialDrawer.quotesTab.noLineItems')}
          </Text>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500 dark:text-zinc-400">
              <tr className="text-left">
                <th className="px-2 pb-1 font-medium">
                  {t('workOrders.financialDrawer.quotesTab.lineColumns.description')}
                </th>
                <th className="px-2 pb-1 text-right font-medium">
                  {t('workOrders.financialDrawer.quotesTab.lineColumns.quantity')}
                </th>
                <th className="px-2 pb-1 text-right font-medium">
                  {t('workOrders.financialDrawer.quotesTab.lineColumns.unitPrice')}
                </th>
                <th className="px-2 pb-1 text-right font-medium">
                  {t('workOrders.financialDrawer.quotesTab.lineColumns.lineTotal')}
                </th>
              </tr>
            </thead>
            <tbody>
              {quote.lineItems.map((li) => (
                <tr
                  key={li.id}
                  className="border-t border-zinc-200 dark:border-white/10"
                >
                  <td className="px-2 py-1">{li.description}</td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {amt(li.quantity)}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {currencyFormatter.format(amt(li.unitPrice))}
                  </td>
                  <td className="px-2 py-1 text-right font-medium tabular-nums">
                    {currencyFormatter.format(amt(li.lineTotal))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {quote.notes && (
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t('workOrders.financialDrawer.quotesTab.notesHeading')}
          </div>
          <Text className="!text-sm whitespace-pre-wrap">{quote.notes}</Text>
        </div>
      )}
    </div>
  );
}
