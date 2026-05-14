import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils';
import FinancialInvoicesTab from './FinancialInvoicesTab';
import apiClient from '../api/client';
import type { Invoice } from '../api';

vi.mock('../api/client');

// Backend ships monetary fields as BigDecimal strings even though the
// existing Invoice type declares them as `number`. Cast through unknown so
// the fixture matches runtime reality.
const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'inv-1',
  customerId: 'cust-1',
  workOrderId: 'wo-1',
  invoiceNumber: 'INV-0042',
  status: 'SENT',
  invoiceDate: '2026-05-10T00:00:00Z',
  dueDate: '2026-06-09T00:00:00Z',
  subtotal: '1500.00' as unknown as number,
  taxRate: '0.00' as unknown as number,
  taxAmount: '0.00' as unknown as number,
  totalAmount: '1500.00' as unknown as number,
  amountPaid: '500.00' as unknown as number,
  balanceDue: '1000.00' as unknown as number,
  notes: undefined,
  lineItems: [
    {
      id: 'li-1',
      description: 'Diagnostic',
      quantity: '1.00' as unknown as number,
      unitPrice: '1500.00' as unknown as number,
      lineTotal: '1500.00' as unknown as number,
    },
  ],
  createdAt: '2026-05-10T14:23:11Z',
  updatedAt: '2026-05-10T14:23:11Z',
  ...overrides,
});

describe('FinancialInvoicesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the empty state when the WO has no invoices', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    renderWithProviders(<FinancialInvoicesTab workOrderId="wo-1" />);
    expect(
      await screen.findByText(/No invoices on this work order yet/i),
    ).toBeInTheDocument();
  });

  it('renders an invoice row with formatted money and date columns', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [makeInvoice()] });
    renderWithProviders(<FinancialInvoicesTab workOrderId="wo-1" />);
    expect(await screen.findByText('INV-0042')).toBeInTheDocument();
    expect(screen.getByText('$1,500.00')).toBeInTheDocument();
    expect(screen.getByText('$500.00')).toBeInTheDocument();
    expect(screen.getByText('$1,000.00')).toBeInTheDocument();
    expect(screen.getByText('May 10, 2026')).toBeInTheDocument();
    expect(screen.getByText('Jun 9, 2026')).toBeInTheDocument();
  });

  it('uses the WO-scoped endpoint, not the customer endpoint', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    renderWithProviders(<FinancialInvoicesTab workOrderId="wo-1" />);
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/financial/work-orders/wo-1/invoices',
      );
    });
  });

  it('expands a row to show line items when the chevron is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue({ data: [makeInvoice()] });
    renderWithProviders(<FinancialInvoicesTab workOrderId="wo-1" />);
    const expandBtn = await screen.findByRole('button', { name: /show line items/i });
    await user.click(expandBtn);
    expect(screen.getByText('Line items')).toBeInTheDocument();
    expect(screen.getByText('Diagnostic')).toBeInTheDocument();
  });

  it('lets the user change status via the inline status pill (DRAFT → SENT)', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [makeInvoice({ status: 'DRAFT' })],
    });
    vi.mocked(apiClient.patch).mockResolvedValue({
      data: makeInvoice({ status: 'SENT' }),
    });
    renderWithProviders(<FinancialInvoicesTab workOrderId="wo-1" />);
    const pillButton = await screen.findByRole('button', { name: /change status/i });
    await user.click(pillButton);
    await user.click(await screen.findByRole('menuitem', { name: /^sent$/i }));
    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/financial/invoices/inv-1/status',
        { status: 'SENT' },
      );
    });
  });

  it('marks an invoice paid via the ⋯ menu', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [makeInvoice({ status: 'SENT' })],
    });
    vi.mocked(apiClient.patch).mockResolvedValue({
      data: makeInvoice({ status: 'PAID' }),
    });
    renderWithProviders(<FinancialInvoicesTab workOrderId="wo-1" />);
    await screen.findByText('INV-0042');
    const overflow = screen
      .getAllByRole('button', { name: /more options/i })
      .at(-1)!;
    await user.click(overflow);
    await user.click(await screen.findByRole('menuitem', { name: /mark paid/i }));
    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/financial/invoices/inv-1/status',
        { status: 'PAID' },
      );
    });
  });

  it('voids an invoice via the ⋯ menu with confirmation', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(apiClient.get).mockResolvedValue({ data: [makeInvoice()] });
    vi.mocked(apiClient.patch).mockResolvedValue({
      data: makeInvoice({ status: 'VOID' }),
    });
    renderWithProviders(<FinancialInvoicesTab workOrderId="wo-1" />);
    await screen.findByText('INV-0042');
    const overflow = screen
      .getAllByRole('button', { name: /more options/i })
      .at(-1)!;
    await user.click(overflow);
    await user.click(await screen.findByRole('menuitem', { name: /void/i }));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/financial/invoices/inv-1/status',
        { status: 'VOID' },
      );
    });
    confirmSpy.mockRestore();
  });

  it('hides the status pill dropdown and ⋯ menu for terminal statuses', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [makeInvoice({ status: 'VOID' })],
    });
    renderWithProviders(<FinancialInvoicesTab workOrderId="wo-1" />);
    await screen.findByText('INV-0042');
    expect(
      screen.queryByRole('button', { name: /change status/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /more options/i }),
    ).not.toBeInTheDocument();
  });

  it('renders voided rows in the audit list (per ask #2 contract)', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [
        makeInvoice({ id: 'inv-1', invoiceNumber: 'INV-A', status: 'SENT' }),
        makeInvoice({ id: 'inv-2', invoiceNumber: 'INV-VOID', status: 'VOID' }),
      ],
    });
    renderWithProviders(<FinancialInvoicesTab workOrderId="wo-1" />);
    expect(await screen.findByText('INV-A')).toBeInTheDocument();
    expect(screen.getByText('INV-VOID')).toBeInTheDocument();
  });
});
