import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils';
import FinancialDrawer from './FinancialDrawer';
import apiClient from '../api/client';

vi.mock('../api/client');

describe('FinancialDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // FinancialInvoicesTab inside the Invoices panel fires a fetch on
    // mount; stub it with an empty list so these shell-level tests don't
    // hit the "unmocked endpoint" path.
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
  });

  const defaults = {
    open: true,
    onClose: vi.fn(),
    workOrderId: 'wo-1',
    workOrderNumber: 'WO-00010',
  };

  it('renders the title with the WO number', () => {
    renderWithProviders(<FinancialDrawer {...defaults} />);
    expect(screen.getByText('Financials · WO #WO-00010')).toBeInTheDocument();
  });

  it('renders all four tab labels in WO-lifecycle (chronological) order', () => {
    renderWithProviders(<FinancialDrawer {...defaults} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    expect(tabs[0]).toHaveTextContent('Quotes');
    expect(tabs[1]).toHaveTextContent('POs');
    expect(tabs[2]).toHaveTextContent('Invoices');
    expect(tabs[3]).toHaveTextContent('Payments');
  });

  it('selects the Invoices tab by default (live billable surface in 7a)', () => {
    renderWithProviders(<FinancialDrawer {...defaults} />);
    const invoicesTab = screen.getByRole('tab', { name: 'Invoices' });
    expect(invoicesTab).toHaveAttribute('aria-selected', 'true');
  });

  it('honors the `initialTab` prop on mount', () => {
    renderWithProviders(<FinancialDrawer {...defaults} initialTab="payments" />);
    const paymentsTab = screen.getByRole('tab', { name: 'Payments' });
    expect(paymentsTab).toHaveAttribute('aria-selected', 'true');
  });

  it('lets the user switch tabs inside the drawer (uncontrolled)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FinancialDrawer {...defaults} />);
    const quotesTab = screen.getByRole('tab', { name: 'Quotes' });
    await user.click(quotesTab);
    expect(quotesTab).toHaveAttribute('aria-selected', 'true');
  });

  it('renders the live Invoices tab on default (no "Coming soon" stub)', async () => {
    renderWithProviders(<FinancialDrawer {...defaults} />);
    // Invoices is live (FinancialInvoicesTab renders its own empty/loading
    // states from the WO-scoped list endpoint).
    expect(
      await screen.findByText(/No invoices on this work order yet/i),
    ).toBeInTheDocument();
  });

  it('renders the "Coming soon" stub on the still-stubbed tabs with matching blocker copy', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FinancialDrawer {...defaults} />);
    // Switch to Payments tab — still stubbed (waits on asks #3, #4)
    await user.click(screen.getByRole('tab', { name: 'Payments' }));
    expect(screen.getByText(/backend asks #3/i)).toBeInTheDocument();
    // Quotes tab — 7b
    await user.click(screen.getByRole('tab', { name: 'Quotes' }));
    expect(screen.getByText(/phase 7b/i)).toBeInTheDocument();
    // POs tab — 7c
    await user.click(screen.getByRole('tab', { name: 'POs' }));
    expect(screen.getByText(/Deferred to phase 7c/i)).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<FinancialDrawer {...defaults} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
