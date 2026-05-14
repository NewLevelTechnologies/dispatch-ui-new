import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils';
import FinancialDrawer from './FinancialDrawer';

describe('FinancialDrawer', () => {
  const defaults = {
    open: true,
    onClose: vi.fn(),
    workOrderNumber: 'WO-00010',
  };

  it('renders the title with the WO number', () => {
    renderWithProviders(<FinancialDrawer {...defaults} />);
    expect(screen.getByText('Financials · WO #WO-00010')).toBeInTheDocument();
  });

  it('renders all four tab labels in click-frequency order', () => {
    renderWithProviders(<FinancialDrawer {...defaults} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    expect(tabs[0]).toHaveTextContent('Invoices');
    expect(tabs[1]).toHaveTextContent('Payments');
    expect(tabs[2]).toHaveTextContent('Quotes');
    expect(tabs[3]).toHaveTextContent('POs');
  });

  it('selects the Invoices tab by default', () => {
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

  it('renders the "Coming soon" stub on each tab with the matching blocker copy', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FinancialDrawer {...defaults} />);
    // Invoices tab — default
    expect(screen.getByText(/Coming soon/i)).toBeInTheDocument();
    expect(screen.getByText(/backend ask #2/i)).toBeInTheDocument();
    // Switch to Payments tab
    await user.click(screen.getByRole('tab', { name: 'Payments' }));
    expect(screen.getByText(/backend asks #3/i)).toBeInTheDocument();
    // Quotes tab
    await user.click(screen.getByRole('tab', { name: 'Quotes' }));
    expect(screen.getByText(/phase 7b/i)).toBeInTheDocument();
    // POs tab
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
