import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils';
import FinancialQuotesTab from './FinancialQuotesTab';
import apiClient from '../api/client';
import type { Quote } from '../api';

vi.mock('../api/client');

const makeQuote = (overrides: Partial<Quote> = {}): Quote => ({
  id: 'q-1',
  customerId: 'cust-1',
  workOrderId: 'wo-1',
  quoteNumber: 'QUO-0001',
  status: 'SENT',
  quoteDate: '2026-05-10T00:00:00Z',
  expirationDate: '2026-06-09T00:00:00Z',
  subtotal: '5000.00' as unknown as number,
  taxRate: '0.00' as unknown as number,
  taxAmount: '0.00' as unknown as number,
  totalAmount: '5000.00' as unknown as number,
  notes: undefined,
  lineItems: [
    {
      id: 'qli-1',
      description: 'Replace condenser',
      quantity: '1.00' as unknown as number,
      unitPrice: '5000.00' as unknown as number,
      lineTotal: '5000.00' as unknown as number,
    },
  ],
  createdAt: '2026-05-10T14:23:11Z',
  updatedAt: '2026-05-10T14:23:11Z',
  ...overrides,
});

const renderTab = () =>
  renderWithProviders(
    <FinancialQuotesTab
      workOrderId="wo-1"
      workOrderNumber="WO-00010"
      customerId="cust-1"
      customerName="Tenant 2 Inc."
    />,
  );

describe('FinancialQuotesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the empty state with a + New Quote button when the WO has no quotes', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    renderTab();
    expect(
      await screen.findByText(/No quotes on this work order yet/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /new quote/i }),
    ).toBeInTheDocument();
  });

  it('uses the WO-scoped endpoint', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    renderTab();
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/financial/work-orders/wo-1/quotes',
      );
    });
  });

  it('renders a quote row with formatted money and date columns', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [makeQuote()] });
    renderTab();
    expect(await screen.findByText('QUO-0001')).toBeInTheDocument();
    expect(screen.getByText('$5,000.00')).toBeInTheDocument();
    expect(screen.getByText('May 10, 2026')).toBeInTheDocument();
    expect(screen.getByText('Jun 9, 2026')).toBeInTheDocument();
  });

  it('expands a row to show line items', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue({ data: [makeQuote()] });
    renderTab();
    const expandBtn = await screen.findByRole('button', {
      name: /show line items/i,
    });
    await user.click(expandBtn);
    expect(screen.getByText('Line items')).toBeInTheDocument();
    expect(screen.getByText('Replace condenser')).toBeInTheDocument();
  });

  it('changes status via the inline status pill (DRAFT → SENT)', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [makeQuote({ status: 'DRAFT' })],
    });
    vi.mocked(apiClient.patch).mockResolvedValue({
      data: makeQuote({ status: 'SENT' }),
    });
    renderTab();
    const pillBtn = await screen.findByRole('button', { name: /change status/i });
    await user.click(pillBtn);
    await user.click(await screen.findByRole('menuitem', { name: /^sent$/i }));
    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/financial/quotes/q-1/status',
        { status: 'SENT' },
      );
    });
  });

  it('marks a SENT quote accepted via the ⋯ menu', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [makeQuote({ status: 'SENT' })],
    });
    vi.mocked(apiClient.patch).mockResolvedValue({
      data: makeQuote({ status: 'ACCEPTED' }),
    });
    renderTab();
    await screen.findByText('QUO-0001');
    const overflow = screen
      .getAllByRole('button', { name: /more options/i })
      .at(-1)!;
    await user.click(overflow);
    await user.click(await screen.findByRole('menuitem', { name: /mark accepted/i }));
    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/financial/quotes/q-1/status',
        { status: 'ACCEPTED' },
      );
    });
  });

  it('renders DECLINED rows muted with no ⋯ menu (terminal)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [makeQuote({ status: 'DECLINED' })],
    });
    renderTab();
    await screen.findByText('QUO-0001');
    expect(
      screen.queryByRole('button', { name: /more options/i }),
    ).not.toBeInTheDocument();
  });

  it('auto-opens the create dialog when openQuoteCreateSignal is non-zero', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    renderWithProviders(
      <FinancialQuotesTab
        workOrderId="wo-1"
        workOrderNumber="WO-00010"
        customerId="cust-1"
        customerName="Tenant 2 Inc."
        openQuoteCreateSignal={1}
      />,
    );
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
