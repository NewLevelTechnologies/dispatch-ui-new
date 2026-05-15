import { useTranslation } from 'react-i18next';
import type { PublicTenantBranding } from '../api';

interface Props {
  tenant: PublicTenantBranding;
}

/**
 * Sender-block header for the customer-facing public invoice / quote
 * pages. Logo (if present) + company name on top, mailing address below.
 * All address fields are individually nullable — render only what we have.
 *
 * Intentionally narrow: no support email/phone here (that lives in the
 * page footer to keep the "questions" affordance below the document body,
 * matching customer expectations from utility / Stripe / Square invoices).
 */
export default function TenantBrandingHeader({ tenant }: Props) {
  const { t } = useTranslation();
  const addressLine1 = tenant.streetAddress?.trim() || null;
  const cityStateZip = [tenant.city, tenant.state, tenant.zipCode]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')
    .replace(/, (\w{2}), (\d{5})/, ', $1 $2'); // collapse "City, ST, 12345" → "City, ST 12345"
  const hasAddress = !!(addressLine1 || cityStateZip);

  return (
    <header className="flex flex-col items-center text-center print:items-start print:text-left">
      {tenant.logoUrl && (
        <img
          src={tenant.logoUrl}
          alt={t('public.common.logoAlt', { name: tenant.displayName })}
          className="mb-3 max-h-16 w-auto object-contain"
        />
      )}
      <h1 className="text-xl font-semibold text-zinc-900">
        {tenant.displayName}
      </h1>
      {hasAddress && (
        <address className="mt-1 not-italic text-sm text-zinc-600">
          {addressLine1 && <div>{addressLine1}</div>}
          {cityStateZip && <div>{cityStateZip}</div>}
        </address>
      )}
    </header>
  );
}
