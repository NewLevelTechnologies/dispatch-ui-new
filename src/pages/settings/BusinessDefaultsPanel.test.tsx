import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BusinessDefaultsPanel from './BusinessDefaultsPanel';

describe('BusinessDefaultsPanel', () => {
  it('renders the title and description', () => {
    render(<BusinessDefaultsPanel />);
    expect(screen.getByText('Business Defaults')).toBeInTheDocument();
    expect(
      screen.getByText(/How operations and money behave by default/i),
    ).toBeInTheDocument();
  });

  it('renders the Operational and Financial section labels', () => {
    render(<BusinessDefaultsPanel />);
    expect(screen.getByText('Operational')).toBeInTheDocument();
    expect(screen.getByText('Financial')).toBeInTheDocument();
  });

  it('disables every form control (this is a planned/locked panel)', () => {
    const { container } = render(<BusinessDefaultsPanel />);
    const fieldset = container.querySelector('fieldset');
    expect(fieldset).not.toBeNull();
    expect(fieldset).toBeDisabled();
  });

  it('renders the timezone, tax rate, and invoice terms controls', () => {
    const { container } = render(<BusinessDefaultsPanel />);
    expect(container.querySelector('select[name="timezone"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="defaultTaxRate"]')).toBeInTheDocument();
    expect(container.querySelector('select[name="invoiceTerms"]')).toBeInTheDocument();
  });

  it('lists the standard Net invoice term options', () => {
    render(<BusinessDefaultsPanel />);
    expect(screen.getByText('Due on receipt')).toBeInTheDocument();
    expect(screen.getByText('Net 15')).toBeInTheDocument();
    expect(screen.getByText('Net 30')).toBeInTheDocument();
    expect(screen.getByText('Net 45')).toBeInTheDocument();
    expect(screen.getByText('Net 60')).toBeInTheDocument();
  });
});
