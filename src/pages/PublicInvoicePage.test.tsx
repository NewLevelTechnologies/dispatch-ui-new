import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import PublicInvoicePage from './PublicInvoicePage';
import publicApiClient from '../api/publicClient';
import type { PublicInvoiceResponse } from '../api/publicFinancialApi';

vi.mock('../api/publicClient', () => ({
  __esModule: true,
  default: { get: vi.fn() },
}));

function buildResponse(
  overrides: Partial<PublicInvoiceResponse['invoice']> = {},
  tenantOverrides: Partial<PublicInvoiceResponse['tenant']> = {},
): PublicInvoiceResponse {
  return {
    invoice: {
      id: 'inv-1',
      customerId: 'cust-1',
      invoiceNumber: 'INV-0042',
      status: 'SENT',
      invoiceDate: '2026-05-10T00:00:00Z',
      dueDate: '2026-06-09T00:00:00Z',
      subtotal: 500,
      taxRate: 0,
      taxAmount: 0,
      totalAmount: 500,
      amountPaid: 0,
      balanceDue: 500,
      lineItems: [
        {
          id: 'li-1',
          description: 'HVAC tune-up',
          quantity: 1,
          unitPrice: 500,
          lineTotal: 500,
        },
      ],
      payments: [],
      createdAt: '2026-05-10T00:00:00Z',
      updatedAt: '2026-05-10T00:00:00Z',
      ...overrides,
    },
    tenant: {
      displayName: 'Acme HVAC',
      logoUrl: null,
      streetAddress: '123 Main',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62701',
      supportEmail: 'support@acmehvac.example',
      supportPhone: '(555) 123-4567',
      ...tenantOverrides,
    },
    customer: { id: 'cust-1', name: 'Jane Smith' },
  };
}

const renderAt = (token: string) =>
  renderWithProviders(<PublicInvoicePage />, {
    routes: [
      { path: '/p/invoice/:token', element: <PublicInvoicePage /> },
      { path: '*', element: <PublicInvoicePage /> },
    ],
    initialPath: `/p/invoice/${token}`,
  });

describe('PublicInvoicePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the invoice with tenant branding and the amount due hero', async () => {
    vi.mocked(publicApiClient.get).mockResolvedValueOnce({
      data: buildResponse(),
    });
    renderAt('tok-1');
    expect(
      await screen.findByRole('heading', { level: 1, name: /Acme HVAC/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/INV-0042/)).toBeInTheDocument();
    // Amount appears in the hero + the totals breakdown — assert at least
    // one renders (anti-flake against the multiple-match query).
    expect(screen.getAllByText(/\$500\.00/).length).toBeGreaterThan(0);
  });

  it('renders the voided banner when the invoice status is VOID', async () => {
    vi.mocked(publicApiClient.get).mockResolvedValueOnce({
      data: buildResponse({ status: 'VOID' }),
    });
    renderAt('tok-1');
    expect(
      await screen.findByText(/this invoice has been voided/i),
    ).toBeInTheDocument();
  });

  it('shows the cliff page when the token is missing from the URL', () => {
    renderWithProviders(<PublicInvoicePage />, {
      routes: [{ path: '*', element: <PublicInvoicePage /> }],
      initialPath: '/p/invoice/',
    });
    expect(
      screen.getByRole('heading', { name: /this link is no longer available/i }),
    ).toBeInTheDocument();
  });

  it('shows the cliff page when the token endpoint returns 404', async () => {
    vi.mocked(publicApiClient.get).mockRejectedValueOnce(
      Object.assign(new Error('Not Found'), {
        isAxiosError: true,
        response: { status: 404, data: {} },
      }),
    );
    renderAt('tok-bad');
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /this link is no longer available/i }),
      ).toBeInTheDocument();
    });
  });

  it('hides the logo gracefully when tenant has no logo URL', async () => {
    vi.mocked(publicApiClient.get).mockResolvedValueOnce({
      data: buildResponse({}, { logoUrl: null }),
    });
    renderAt('tok-1');
    await screen.findByRole('heading', { level: 1, name: /Acme HVAC/ });
    expect(screen.queryByRole('img', { name: /acme hvac logo/i })).toBeNull();
  });
});
