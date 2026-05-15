import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import {
  publicFinancialApi,
  QuoteStatus,
  type PublicQuoteResponse,
} from '../api';
import TenantBrandingHeader from '../components/TenantBrandingHeader';
import CliffPage from '../components/CliffPage';
import { Badge } from '../components/catalyst/badge';

/**
 * Customer-facing read-only quote view, rendered when a customer clicks
 * the `View Quote` link from a send email. Route: `/p/quote/:token`.
 *
 * Mirrors `PublicInvoicePage` structure with a quote-shaped hero (total
 * amount + expiration date instead of balance + due date) and no payments
 * section. DECLINED / EXPIRED render with muted styling; ACCEPTED gets a
 * lime accent. No customer-side accept/decline affordance in v1 (out of
 * scope — quote responses are a phone call today).
 */

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatMoney = (value: number | string | null | undefined): string =>
  currencyFormatter.format(Number(value ?? 0) || 0);

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

type QuoteBadgeProps = {
  status: PublicQuoteResponse['quote']['status'];
};

const QuoteStatusBadge = ({ status }: QuoteBadgeProps) => {
  const { t } = useTranslation();
  switch (status) {
    case QuoteStatus.ACCEPTED:
      return <Badge color="lime">{t('public.quote.status.accepted')}</Badge>;
    case QuoteStatus.DECLINED:
      return <Badge color="zinc">{t('public.quote.status.declined')}</Badge>;
    case QuoteStatus.EXPIRED:
      return <Badge color="amber">{t('public.quote.status.expired')}</Badge>;
    case QuoteStatus.SENT:
      return <Badge color="sky">{t('public.quote.status.pending')}</Badge>;
    case QuoteStatus.DRAFT:
      return <Badge color="zinc">{t('public.quote.status.draft')}</Badge>;
    default:
      return null;
  }
};

export default function PublicQuotePage() {
  const { t } = useTranslation();
  const { token = '' } = useParams<{ token: string }>();

  const { data, isLoading, isError, error } = useQuery<
    PublicQuoteResponse,
    unknown
  >({
    queryKey: ['publicQuote', token],
    queryFn: () => publicFinancialApi.getQuoteByToken(token),
    enabled: !!token,
    retry: false,
  });

  if (!token) {
    return <CliffPage />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-zinc-500">{t('public.quote.loading')}</div>
      </div>
    );
  }

  if (isError || !data) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    return <CliffPage reason={status === 404 ? 'invalid' : 'error'} />;
  }

  const { quote, tenant, customer } = data;
  const isAccepted = quote.status === QuoteStatus.ACCEPTED;
  const isExpired = quote.status === QuoteStatus.EXPIRED;

  return (
    <div className="min-h-screen bg-zinc-50 print:bg-white">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10 print:max-w-none print:p-0">
        <TenantBrandingHeader tenant={tenant} />

        {/* Hero card — quote number, status, total. Expiration is the
            secondary line (customers care about "is this still good?"). */}
        <section
          className={`mt-6 rounded-lg border bg-white p-6 shadow-sm print:border-zinc-300 print:shadow-none ${
            isAccepted
              ? 'border-lime-200'
              : isExpired
              ? 'border-amber-200'
              : 'border-zinc-200'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                {t('public.quote.label')}
              </p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">
                #{quote.quoteNumber}
              </p>
            </div>
            <QuoteStatusBadge status={quote.status} />
          </div>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              {t('public.quote.total')}
            </p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-zinc-900">
              {formatMoney(quote.totalAmount)}
            </p>
            <p
              className={`mt-1 text-sm ${
                isExpired ? 'text-amber-700' : 'text-zinc-600'
              }`}
            >
              {isExpired
                ? t('public.quote.expiredOn', {
                    date: formatDate(quote.expirationDate),
                  })
                : t('public.quote.validThrough', {
                    date: formatDate(quote.expirationDate),
                  })}
            </p>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-zinc-100 pt-4 text-sm">
            <div>
              <dt className="text-zinc-500">{t('public.quote.quotedTo')}</dt>
              <dd className="mt-0.5 text-zinc-900">{customer.name}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">{t('public.quote.quoteDate')}</dt>
              <dd className="mt-0.5 text-zinc-900">
                {formatDate(quote.quoteDate)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm print:shadow-none">
          <h2 className="border-b border-zinc-100 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {t('public.quote.items')}
          </h2>
          <ul className="divide-y divide-zinc-100">
            {quote.lineItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-1 px-6 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-900">{item.description}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {item.quantity} × {formatMoney(item.unitPrice)}
                  </p>
                </div>
                <div className="text-sm font-medium text-zinc-900 sm:text-right">
                  {formatMoney(item.lineTotal)}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm print:shadow-none">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-600">{t('public.quote.subtotal')}</dt>
              <dd className="text-zinc-900">{formatMoney(quote.subtotal)}</dd>
            </div>
            {Number(quote.taxAmount) > 0 && (
              <div className="flex justify-between">
                <dt className="text-zinc-600">
                  {quote.taxRate
                    ? t('public.quote.taxWithRate', { rate: quote.taxRate })
                    : t('public.quote.tax')}
                </dt>
                <dd className="text-zinc-900">{formatMoney(quote.taxAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-zinc-200 pt-2 text-base">
              <dt className="font-semibold text-zinc-900">
                {t('public.quote.total')}
              </dt>
              <dd className="font-semibold text-zinc-900">
                {formatMoney(quote.totalAmount)}
              </dd>
            </div>
          </dl>
        </section>

        {quote.notes && quote.notes.trim() && (
          <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm print:shadow-none">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t('public.quote.notes')}
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">
              {quote.notes}
            </p>
          </section>
        )}

        <footer className="mt-8 text-center text-sm text-zinc-500 print:mt-4">
          <p>{t('public.quote.questions')}</p>
          <p className="mt-1 text-zinc-700">
            {t('public.quote.contactCta', { tenant: tenant.displayName })}
            {tenant.supportPhone
              ? t('public.common.contactPhone', { phone: tenant.supportPhone })
              : ''}
            {tenant.supportEmail ? (
              <>
                {' · '}
                <a
                  href={`mailto:${tenant.supportEmail}`}
                  rel="noopener noreferrer"
                  className="text-sky-700 underline"
                >
                  {tenant.supportEmail}
                </a>
              </>
            ) : null}
          </p>
        </footer>
      </div>
    </div>
  );
}
