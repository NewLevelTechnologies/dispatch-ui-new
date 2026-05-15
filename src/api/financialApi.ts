// Financial API Client
import apiClient from './client';

// ========== INVOICES ==========

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'VOID';

export const InvoiceStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
  VOID: 'VOID',
} as const;

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * Status of a payment record. `RECEIVED` is the default for newly created
 * payments; `VOID` is set by the (pending) void endpoint and excluded from
 * the parent invoice's `amountPaid` server-side. Voided rows still appear
 * in nested `payments` arrays for audit visibility — render them muted.
 */
export type PaymentStatus = 'RECEIVED' | 'VOID';

/**
 * A payment row as it appears nested under an invoice in the response of
 * `GET /financial/work-orders/{id}/invoices`. CRITICAL semantic: `amount`
 * is the slice of the payment applied to *this* invoice, not the payment's
 * gross amount. A single check covering N invoices appears once in each
 * invoice's `payments[]` with its respective slice. `sum(invoice.payments
 * [].amount) === invoice.amountPaid` is a server-side guarantee.
 *
 * To get the full payment amount, call `paymentsApi.getById(id)` directly.
 * Not needed for the per-invoice view — the slice is the meaningful number.
 *
 * No `invoiceId` / `customerId` / `workOrderId` on the nested shape — those
 * are redundant with the parent invoice. The standalone `Payment` interface
 * still carries them for the `getById` / `getByInvoice` endpoints.
 */
export interface NestedInvoicePayment {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  referenceNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  customerId: string;
  workOrderId?: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  notes?: string;
  lineItems: InvoiceLineItem[];
  /**
   * Server-sorted by `paymentDate DESC, createdAt DESC`. Always an array;
   * `[]` when none. Includes VOID rows for audit.
   */
  payments: NestedInvoicePayment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceLineItemRequest {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateInvoiceRequest {
  customerId: string;
  workOrderId?: string;
  invoiceDate: string;
  dueDate: string;
  taxRate: number;
  notes?: string;
  lineItems: CreateInvoiceLineItemRequest[];
}

export interface UpdateInvoiceStatusRequest {
  status: InvoiceStatus;
}

export const invoicesApi = {
  getAll: async (): Promise<Invoice[]> => {
    const response = await apiClient.get<Invoice[]>('/financial/invoices');
    return response.data;
  },

  getById: async (id: string): Promise<Invoice> => {
    const response = await apiClient.get<Invoice>(`/financial/invoices/${id}`);
    return response.data;
  },

  getByCustomer: async (customerId: string): Promise<Invoice[]> => {
    const response = await apiClient.get<Invoice[]>(`/financial/invoices/customer/${customerId}`);
    return response.data;
  },

  /**
   * WO-scoped invoice list (Phase 7 backend ask #2). Server-sorted
   * `invoiceDate DESC, createdAt DESC` — don't re-sort on the client. Returns
   * `[]` when the WO has no invoices, doesn't exist, or belongs to a different
   * tenant (RLS-indistinguishable, security default). Includes VOID and
   * CANCELLED rows — the tab is the audit surface, the summary endpoint is
   * what excludes them from totals.
   */
  getByWorkOrder: async (workOrderId: string): Promise<Invoice[]> => {
    const response = await apiClient.get<Invoice[]>(
      `/financial/work-orders/${workOrderId}/invoices`,
    );
    return response.data;
  },

  create: async (request: CreateInvoiceRequest): Promise<Invoice> => {
    const response = await apiClient.post<Invoice>('/financial/invoices', request);
    return response.data;
  },

  updateStatus: async (id: string, request: UpdateInvoiceStatusRequest): Promise<Invoice> => {
    const response = await apiClient.patch<Invoice>(`/financial/invoices/${id}/status`, request);
    return response.data;
  },
};

// ========== QUOTES ==========

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export const QuoteStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
} as const;

export interface QuoteLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Quote {
  id: string;
  customerId: string;
  quoteNumber: string;
  status: QuoteStatus;
  quoteDate: string;
  expirationDate: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  lineItems: QuoteLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuoteLineItemRequest {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateQuoteRequest {
  customerId: string;
  quoteDate: string;
  expirationDate: string;
  taxRate: number;
  notes?: string;
  lineItems: CreateQuoteLineItemRequest[];
}

export interface UpdateQuoteStatusRequest {
  status: QuoteStatus;
}

export const quotesApi = {
  getAll: async (): Promise<Quote[]> => {
    const response = await apiClient.get<Quote[]>('/financial/quotes');
    return response.data;
  },

  getById: async (id: string): Promise<Quote> => {
    const response = await apiClient.get<Quote>(`/financial/quotes/${id}`);
    return response.data;
  },

  getByCustomer: async (customerId: string): Promise<Quote[]> => {
    const response = await apiClient.get<Quote[]>(`/financial/quotes/customer/${customerId}`);
    return response.data;
  },

  create: async (request: CreateQuoteRequest): Promise<Quote> => {
    const response = await apiClient.post<Quote>('/financial/quotes', request);
    return response.data;
  },

  updateStatus: async (id: string, request: UpdateQuoteStatusRequest): Promise<Quote> => {
    const response = await apiClient.patch<Quote>(`/financial/quotes/${id}/status`, request);
    return response.data;
  },
};

// ========== PAYMENTS ==========

export type PaymentMethod = 'CASH' | 'CHECK' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'ACH' | 'WIRE_TRANSFER' | 'OTHER';

export const PaymentMethod = {
  CASH: 'CASH',
  CHECK: 'CHECK',
  CREDIT_CARD: 'CREDIT_CARD',
  DEBIT_CARD: 'DEBIT_CARD',
  ACH: 'ACH',
  WIRE_TRANSFER: 'WIRE_TRANSFER',
  OTHER: 'OTHER',
} as const;

export interface Payment {
  id: string;
  invoiceId: string;
  customerId: string;
  paymentNumber: string;
  paymentDate: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * One application of a Payment to a single Invoice. Carries the slice that
 * lands on that invoice — same semantic as the nested `payments[].amount`
 * returned on the invoice list (ask #2). Supports split payments (one
 * check across N invoices) without a separate API call shape.
 *
 * For v1 the dialog only constructs single-element arrays — `amountApplied`
 * equals the dialog's Amount field, applied to one chosen invoice. Split-
 * payment UI is out of scope until a real CSR workflow earns it.
 */
export interface CreatePaymentApplication {
  invoiceId: string;
  amountApplied: number;
}

export interface CreatePaymentRequest {
  /**
   * Bill-to customer for this payment. For a payment against a single
   * invoice, source from `invoice.customerId` (which may differ from the
   * WO's primary customer per the third-party billing model — warranty
   * cos, insurance, etc.). When a future split-across-customers UI lands,
   * this stays per-payment (one payment, one paying party).
   */
  customerId: string;
  /** Total payment amount (gross). For single-invoice cases equals the sole `applications[0].amountApplied`. */
  amount: number;
  /** Calendar date (LocalDate "YYYY-MM-DD"), not Instant — different from invoice/dueDate. */
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  /** Required. Each entry applies a slice of the payment to one invoice. */
  applications: CreatePaymentApplication[];
}

export const paymentsApi = {
  getAll: async (): Promise<Payment[]> => {
    const response = await apiClient.get<Payment[]>('/financial/payments');
    return response.data;
  },

  getById: async (id: string): Promise<Payment> => {
    const response = await apiClient.get<Payment>(`/financial/payments/${id}`);
    return response.data;
  },

  getByInvoice: async (invoiceId: string): Promise<Payment[]> => {
    const response = await apiClient.get<Payment[]>(`/financial/payments/invoice/${invoiceId}`);
    return response.data;
  },

  create: async (request: CreatePaymentRequest): Promise<Payment> => {
    const response = await apiClient.post<Payment>('/financial/payments', request);
    return response.data;
  },

  /**
   * Void a payment (Phase 7 backend ask #4).
   *
   *   200 + updated Payment  → success
   *   200 + Payment          → idempotent re-void (already-VOID)
   *   204 No Content         → cross-tenant or not-found
   *                             (RLS-indistinguishable, security default —
   *                             do NOT treat as error; just no-op refresh)
   *
   * Cascade: backend reverts each touched invoice's `amountPaid` /
   * `balanceDue` and demotes PAID → SENT where applicable. A single void
   * may affect multiple invoices if the payment was split across them.
   * Callers should invalidate both the invoice list and the financial
   * summary for the work order.
   */
  void: async (id: string): Promise<Payment | null> => {
    const response = await apiClient.post<Payment | ''>(
      `/financial/payments/${id}/void`,
    );
    if (response.status === 204) return null;
    return response.data as Payment;
  },
};

// ========== WORK-ORDER FINANCIAL SUMMARY ==========

/**
 * Rollup of invoiced / paid / balance for a single WO. Computed live on
 * financial-service (no caching, no denormalization onto work_orders). The
 * three amounts are BigDecimal serialized as strings to preserve precision —
 * keep them as strings for any arithmetic; only `parseFloat` for display.
 *
 * The endpoint returns 200 with all-zero totals when:
 *   - the WO exists but has no invoices
 *   - the WO id doesn't exist anywhere
 *   - the WO id belongs to a different tenant (RLS isolation)
 * These three are intentionally indistinguishable (security default).
 */
export interface WorkOrderFinancialSummary {
  invoiced: string;
  paid: string;
  balance: string;
  currency: string;
}

export const financialSummaryApi = {
  getByWorkOrder: async (workOrderId: string): Promise<WorkOrderFinancialSummary> => {
    const response = await apiClient.get<WorkOrderFinancialSummary>(
      `/financial/work-orders/${workOrderId}/summary`,
    );
    return response.data;
  },
};

// Export combined API
export const financialApi = {
  invoices: invoicesApi,
  quotes: quotesApi,
  payments: paymentsApi,
  summary: financialSummaryApi,
};

export default financialApi;
