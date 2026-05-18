import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ModulesFeaturesPanel from './ModulesFeaturesPanel';

describe('ModulesFeaturesPanel', () => {
  it('renders the title and description', () => {
    render(<ModulesFeaturesPanel />);
    expect(screen.getByText('Modules & Features')).toBeInTheDocument();
    expect(
      screen.getByText(/Turn product capabilities on or off/i),
    ).toBeInTheDocument();
  });

  it('renders each group section', () => {
    render(<ModulesFeaturesPanel />);
    expect(screen.getByText('Self-service')).toBeInTheDocument();
    expect(screen.getByText('Communications')).toBeInTheDocument();
    expect(screen.getByText('Workflow')).toBeInTheDocument();
  });

  it('renders each feature label', () => {
    render(<ModulesFeaturesPanel />);
    expect(screen.getByText('Online Booking')).toBeInTheDocument();
    expect(screen.getByText('Customer Portal')).toBeInTheDocument();
    expect(screen.getByText('SMS Notifications')).toBeInTheDocument();
    expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    expect(screen.getByText('Approvals')).toBeInTheDocument();
    expect(screen.getByText('Job Costing')).toBeInTheDocument();
  });

  it('renders a disabled ToggleSwitch for every feature', () => {
    render(<ModulesFeaturesPanel />);
    const switches = screen.getAllByRole('switch');
    // 2 + 2 + 2 features total
    expect(switches.length).toBe(6);
    for (const sw of switches) {
      expect(sw).toBeDisabled();
    }
  });

  it('shows defaults: SMS + Email on, the rest off', () => {
    render(<ModulesFeaturesPanel />);
    const onByAria = (label: string) =>
      screen
        .getByRole('switch', { name: label })
        .getAttribute('aria-checked') === 'true';

    expect(onByAria('SMS Notifications')).toBe(true);
    expect(onByAria('Email Notifications')).toBe(true);
    expect(onByAria('Online Booking')).toBe(false);
    // comingSoon features are forced off regardless of defaultOn
    expect(onByAria('Customer Portal')).toBe(false);
    expect(onByAria('Approvals')).toBe(false);
    expect(onByAria('Job Costing')).toBe(false);
  });
});
