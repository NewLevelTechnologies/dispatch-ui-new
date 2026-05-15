// Local dev-only fixtures for the customer-facing public invoice / quote
// pages. The backend `/public/*` endpoints aren't built yet, but the
// frontend is — these mocks let us preview the page in the browser by
// navigating to `/p/invoice/preview-<variant>` or `/p/quote/preview-<variant>`.
//
// `publicFinancialApi` short-circuits to these fixtures when
// `import.meta.env.DEV` AND the token starts with `preview-`. The entire
// module gets dead-code-eliminated in production builds (Vite resolves
// `import.meta.env.DEV` to a literal `false`), so it's safe to keep in
// `main` and delete once the backend lands.

import type {
  PublicInvoiceResponse,
  PublicQuoteResponse,
} from '../api/publicFinancialApi';

const TENANT = {
  displayName: 'Acme HVAC',
  logoUrl: null,
  streetAddress: '123 Main Street',
  city: 'Springfield',
  state: 'IL',
  zipCode: '62701',
  supportEmail: 'support@acmehvac.example',
  supportPhone: '(555) 123-4567',
} satisfies PublicInvoiceResponse['tenant'];

const CUSTOMER = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Jane Smith',
} satisfies PublicInvoiceResponse['customer'];

const BASE_INVOICE_LINE_ITEMS: PublicInvoiceResponse['invoice']['lineItems'] = [
  {
    id: 'li-1',
    description: 'Semi-annual HVAC system tune-up',
    quantity: 1,
    unitPrice: 189,
    lineTotal: 189,
  },
  {
    id: 'li-2',
    description: 'Air filter replacement (16x25x1)',
    quantity: 2,
    unitPrice: 24.5,
    lineTotal: 49,
  },
  {
    id: 'li-3',
    description: 'Condenser coil cleaning',
    quantity: 1,
    unitPrice: 85,
    lineTotal: 85,
  },
];

const BASE_INVOICE: PublicInvoiceResponse['invoice'] = {
  id: 'inv-preview',
  customerId: CUSTOMER.id,
  workOrderId: 'wo-preview',
  invoiceNumber: 'INV-2026-0042',
  status: 'SENT',
  invoiceDate: '2026-05-01T00:00:00Z',
  dueDate: '2026-05-31T00:00:00Z',
  subtotal: 323,
  taxRate: 8,
  taxAmount: 25.84,
  totalAmount: 348.84,
  amountPaid: 0,
  balanceDue: 348.84,
  notes:
    'Thanks for choosing Acme HVAC. Please reach out with any questions before paying.',
  lineItems: BASE_INVOICE_LINE_ITEMS,
  payments: [],
  createdAt: '2026-05-01T14:22:00Z',
  updatedAt: '2026-05-01T14:22:00Z',
};

const invoiceVariants: Record<string, PublicInvoiceResponse> = {
  outstanding: { invoice: BASE_INVOICE, tenant: TENANT, customer: CUSTOMER },
  overdue: {
    invoice: {
      ...BASE_INVOICE,
      status: 'OVERDUE',
      // Backdate so the "Due" text reads naturally as past
      invoiceDate: '2026-03-15T00:00:00Z',
      dueDate: '2026-04-14T00:00:00Z',
    },
    tenant: TENANT,
    customer: CUSTOMER,
  },
  paid: {
    invoice: {
      ...BASE_INVOICE,
      status: 'PAID',
      amountPaid: 348.84,
      balanceDue: 0,
      payments: [
        {
          id: 'pmt-1',
          paymentNumber: 'PMT-2026-0099',
          paymentDate: '2026-05-08T00:00:00Z',
          amount: 348.84,
          paymentMethod: 'CHECK',
          status: 'RECEIVED',
          referenceNumber: 'check #4821',
          createdAt: '2026-05-08T10:00:00Z',
          updatedAt: '2026-05-08T10:00:00Z',
        },
      ],
    },
    tenant: TENANT,
    customer: CUSTOMER,
  },
  void: {
    invoice: { ...BASE_INVOICE, status: 'VOID' },
    tenant: TENANT,
    customer: CUSTOMER,
  },
  // Same data with no tenant address — sanity-check the conditional render
  // when streetAddress / city / state / zipCode are null.
  'no-address': {
    invoice: BASE_INVOICE,
    tenant: {
      ...TENANT,
      streetAddress: null,
      city: null,
      state: null,
      zipCode: null,
    },
    customer: CUSTOMER,
  },
};

const BASE_QUOTE_LINE_ITEMS: PublicQuoteResponse['quote']['lineItems'] = [
  {
    id: 'ql-1',
    description: 'Replace 3-ton outdoor condenser unit',
    quantity: 1,
    unitPrice: 4250,
    lineTotal: 4250,
  },
  {
    id: 'ql-2',
    description: 'Refrigerant line set + insulation',
    quantity: 1,
    unitPrice: 380,
    lineTotal: 380,
  },
  {
    id: 'ql-3',
    description: 'Disposal of old unit',
    quantity: 1,
    unitPrice: 75,
    lineTotal: 75,
  },
];

const BASE_QUOTE: PublicQuoteResponse['quote'] = {
  id: 'qte-preview',
  customerId: CUSTOMER.id,
  workOrderId: 'wo-preview',
  quoteNumber: 'QTE-2026-0017',
  status: 'SENT',
  quoteDate: '2026-05-01T00:00:00Z',
  expirationDate: '2026-06-01T00:00:00Z',
  subtotal: 4705,
  taxRate: 8,
  taxAmount: 376.4,
  totalAmount: 5081.4,
  notes:
    'Estimate valid for 30 days. Includes parts, labor, and disposal. Call us if you have any questions.',
  lineItems: BASE_QUOTE_LINE_ITEMS,
  createdAt: '2026-05-01T14:22:00Z',
  updatedAt: '2026-05-01T14:22:00Z',
};

const quoteVariants: Record<string, PublicQuoteResponse> = {
  pending: { quote: BASE_QUOTE, tenant: TENANT, customer: CUSTOMER },
  accepted: {
    quote: { ...BASE_QUOTE, status: 'ACCEPTED' },
    tenant: TENANT,
    customer: CUSTOMER,
  },
  declined: {
    quote: { ...BASE_QUOTE, status: 'DECLINED' },
    tenant: TENANT,
    customer: CUSTOMER,
  },
  expired: {
    quote: {
      ...BASE_QUOTE,
      status: 'EXPIRED',
      quoteDate: '2026-02-15T00:00:00Z',
      expirationDate: '2026-03-15T00:00:00Z',
    },
    tenant: TENANT,
    customer: CUSTOMER,
  },
};

/**
 * Token format: `preview-<variant>`. Examples:
 *   /p/invoice/preview-outstanding
 *   /p/invoice/preview-overdue
 *   /p/invoice/preview-paid
 *   /p/invoice/preview-void
 *   /p/invoice/preview-no-address
 *
 * Returns `null` (not a 404 throw) when the variant is unknown — caller
 * falls through to the real API path, which will 404 against the
 * not-yet-built backend and the cliff page renders. Useful for testing
 * the cliff page too.
 */
export const previewInvoice = (token: string): PublicInvoiceResponse | null => {
  const variant = token.slice('preview-'.length);
  return invoiceVariants[variant] ?? null;
};

export const previewQuote = (token: string): PublicQuoteResponse | null => {
  const variant = token.slice('preview-'.length);
  return quoteVariants[variant] ?? null;
};
