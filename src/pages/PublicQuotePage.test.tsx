import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import PublicQuotePage from './PublicQuotePage';
import publicApiClient from '../api/publicClient';
import type { PublicQuoteResponse } from '../api/publicFinancialApi';

vi.mock('../api/publicClient', () => ({
  __esModule: true,
  default: { get: vi.fn() },
}));

function buildResponse(
  overrides: Partial<PublicQuoteResponse['quote']> = {},
): PublicQuoteResponse {
  return {
    quote: {
      id: 'q-1',
      customerId: 'cust-1',
      quoteNumber: 'Q-0007',
      status: 'SENT',
      quoteDate: '2026-05-10T00:00:00Z',
      expirationDate: '2026-06-09T00:00:00Z',
      subtotal: 1200,
      taxRate: 0,
      taxAmount: 0,
      totalAmount: 1200,
      lineItems: [
        {
          id: 'li-1',
          description: 'Replace compressor',
          quantity: 1,
          unitPrice: 1200,
          lineTotal: 1200,
        },
      ],
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
    },
    customer: { id: 'cust-1', name: 'Jane Smith' },
  };
}

const renderAt = (token: string) =>
  renderWithProviders(<PublicQuotePage />, {
    routes: [
      { path: '/p/quote/:token', element: <PublicQuotePage /> },
      { path: '*', element: <PublicQuotePage /> },
    ],
    initialPath: `/p/quote/${token}`,
  });

describe('PublicQuotePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the quote with tenant branding and the total amount', async () => {
    vi.mocked(publicApiClient.get).mockResolvedValueOnce({
      data: buildResponse(),
    });
    renderAt('tok-1');
    expect(
      await screen.findByRole('heading', { level: 1, name: /Acme HVAC/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Q-0007/)).toBeInTheDocument();
    expect(screen.getAllByText(/\$1,200\.00/).length).toBeGreaterThan(0);
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

  it('shows the cliff page when the token is missing from the URL', () => {
    renderWithProviders(<PublicQuotePage />, {
      routes: [{ path: '*', element: <PublicQuotePage /> }],
      initialPath: '/p/quote/',
    });
    expect(
      screen.getByRole('heading', { name: /this link is no longer available/i }),
    ).toBeInTheDocument();
  });
});
