// Public Financial API — share-link-authed endpoints
//
// Customer-facing read-only access to a single invoice or quote via an
// opaque share token. The token is the auth; no JWT, no tenant header.
// See `docs/PHASE_7_INVOICE_SEND.md` §4.4 for the contract.
//
// On the wire, the token rides in the `X-Share-Token` request header
// rather than the URL path so it doesn't land in ALB / CloudFront /
// financial-service access logs (§4.4 rationale + §8 security checklist).
// The URL path that the customer actually clicks (`/p/invoice/:token`)
// is an SPA route — the token is read from `useParams()` and forwarded
// to this API call as a header.

import publicApiClient from './publicClient';
import type { Invoice, Quote } from './financialApi';

/**
 * Minimal tenant branding fields the public page needs to render a
 * sender block. Sourced from `tenant_settings`; all address fields
 * are nullable because the column itself is nullable — render the
 * address conditionally on the page.
 */
export interface PublicTenantBranding {
  displayName: string;
  logoUrl?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
}

/**
 * Bill-to / quote-recipient customer fields exposed publicly. Intentionally
 * narrow — the public page shows "Billed to: {name}" and nothing else
 * about the customer record. No email / phone / address leakage.
 */
export interface PublicCustomerSummary {
  id: string;
  name: string;
}

export interface PublicInvoiceResponse {
  invoice: Invoice;
  tenant: PublicTenantBranding;
  customer: PublicCustomerSummary;
}

export interface PublicQuoteResponse {
  quote: Quote;
  tenant: PublicTenantBranding;
  customer: PublicCustomerSummary;
}

const tokenHeaders = (token: string) => ({
  headers: { 'X-Share-Token': token },
});

const PREVIEW_TOKEN_PREFIX = 'preview-';

export const publicFinancialApi = {
  getInvoiceByToken: async (token: string): Promise<PublicInvoiceResponse> => {
    // Dev-only short-circuit so the page can be previewed in the browser
    // before the backend `/public/*` endpoints ship. `import.meta.env.DEV`
    // is replaced with a literal `false` at production build time, so this
    // branch and the entire dev mocks module get dead-code-eliminated.
    if (import.meta.env.DEV && token.startsWith(PREVIEW_TOKEN_PREFIX)) {
      const { previewInvoice } = await import('../dev/publicFinancialMocks');
      const mock = previewInvoice(token);
      if (mock) return mock;
      // Unknown preview variant → fall through to the real API call, which
      // 404s and surfaces the cliff page. Lets us preview the cliff too.
    }
    const response = await publicApiClient.get<PublicInvoiceResponse>(
      '/public/invoices',
      tokenHeaders(token),
    );
    return response.data;
  },

  getQuoteByToken: async (token: string): Promise<PublicQuoteResponse> => {
    if (import.meta.env.DEV && token.startsWith(PREVIEW_TOKEN_PREFIX)) {
      const { previewQuote } = await import('../dev/publicFinancialMocks');
      const mock = previewQuote(token);
      if (mock) return mock;
    }
    const response = await publicApiClient.get<PublicQuoteResponse>(
      '/public/quotes',
      tokenHeaders(token),
    );
    return response.data;
  },
};

export default publicFinancialApi;
