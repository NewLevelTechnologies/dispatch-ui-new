import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders, userEvent } from '../../test/utils';
import TerminologyPanel from './TerminologyPanel';
import apiClient from '../../api/client';

vi.mock('../../api/client');

// Minimal entity catalog — covers all 6 groups so the layout exercises
// every code path, plus the one wire-key mismatch (`equipment_component`
// displays as "Unit").
const mockEntities = [
  { code: 'customer', defaultSingular: 'Customer', defaultPlural: 'Customers', description: 'Person or organization that pays for service' },
  { code: 'service_location', defaultSingular: 'Service Location', defaultPlural: 'Service Locations', description: 'Where work is performed' },
  { code: 'work_order', defaultSingular: 'Work Order', defaultPlural: 'Work Orders', description: 'A unit of work to perform' },
  { code: 'work_item', defaultSingular: 'Work Item', defaultPlural: 'Work Items', description: 'Sub-item of a work order' },
  { code: 'dispatch', defaultSingular: 'Dispatch', defaultPlural: 'Dispatches', description: 'A scheduled visit' },
  { code: 'schedule', defaultSingular: 'Schedule', defaultPlural: 'Schedules', description: 'A planning calendar' },
  { code: 'route', defaultSingular: 'Route', defaultPlural: 'Routes', description: 'A series of stops' },
  { code: 'technician', defaultSingular: 'Technician', defaultPlural: 'Technicians', description: 'Service provider' },
  { code: 'equipment', defaultSingular: 'Equipment', defaultPlural: 'Equipment', description: 'A serviceable asset' },
  { code: 'equipment_component', defaultSingular: 'Unit', defaultPlural: 'Units', description: 'A part within equipment' },
  { code: 'division', defaultSingular: 'Division', defaultPlural: 'Divisions', description: 'An operating unit' },
  { code: 'invoice', defaultSingular: 'Invoice', defaultPlural: 'Invoices', description: 'A bill' },
  { code: 'quote', defaultSingular: 'Quote', defaultPlural: 'Quotes', description: 'A price estimate' },
  { code: 'payment', defaultSingular: 'Payment', defaultPlural: 'Payments', description: 'A received payment' },
];

const baseSettings = {
  tenantId: 't-1',
  companyName: 'Acme',
  primaryColor: '#000',
  secondaryColor: '#fff',
  enableOnlineBooking: false,
  enableSmsNotifications: false,
  enableEmailNotifications: false,
  timezone: 'America/Los_Angeles',
  glossary: {} as Record<string, { singular: string; plural: string }>,
  updatedAt: '2026-05-26T10:30:00Z',
};

function setupApi(glossary: Record<string, { singular: string; plural: string }> = {}) {
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url.includes('/glossary/available')) return Promise.resolve({ data: mockEntities });
    return Promise.resolve({ data: { ...baseSettings, glossary } });
  });
}

// Locate an entity row by its default singular name.
async function getEntityRow(name: string) {
  return await waitFor(() => {
    const header = screen.getByText(name);
    const row = header.closest('div.grid');
    if (!row) throw new Error(`Row for ${name} not present`);
    return row as HTMLElement;
  });
}

describe('TerminologyPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApi({});
  });

  it('renders the page head and the industry preset card', async () => {
    renderWithProviders(<TerminologyPanel />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Terminology' })).toBeInTheDocument();
    });
    expect(screen.getByText(/Apply a preset any time/i)).toBeInTheDocument();
    // 9 preset chips, each rendered as a button.
    expect(screen.getByRole('button', { name: /^HVAC/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Plumbing/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^IT Services/i })).toBeInTheDocument();
  });

  it('shows defaults as input placeholders (not values)', async () => {
    renderWithProviders(<TerminologyPanel />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Customer')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Customers')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Work Order')).toBeInTheDocument();

    // The footer dirty hint shows "No changes" on a clean load.
    expect(screen.getByText(/no changes/i)).toBeInTheDocument();

    // Save button is disabled when clean.
    const save = screen.getByRole('button', { name: /save changes/i });
    expect(save).toBeDisabled();
  });

  it('typing in a singular field marks the form dirty and enables Save', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TerminologyPanel />);

    await waitFor(() => expect(screen.getByPlaceholderText('Work Order')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Work Order'), 'Job');

    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeEnabled();
  });

  it('plural placeholder updates to a pluralized hint as the user types the singular', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TerminologyPanel />);

    await waitFor(() => expect(screen.getByPlaceholderText('Service Location')).toBeInTheDocument());

    // The plural input for Service Location starts with placeholder "Service Locations".
    expect(screen.getByPlaceholderText('Service Locations')).toBeInTheDocument();

    // Type "Property" into the singular field — plural placeholder should
    // flip to "Properties" (consonant + y → ies).
    await user.type(screen.getByPlaceholderText('Service Location'), 'Property');
    expect(screen.getByPlaceholderText('Properties')).toBeInTheDocument();
  });

  it('per-row reset clears the singular and plural for that row only', async () => {
    const user = userEvent.setup();
    setupApi({
      customer: { singular: 'Client', plural: 'Clients' },
      work_order: { singular: 'Job', plural: 'Jobs' },
    });
    renderWithProviders(<TerminologyPanel />);

    await waitFor(() => {
      const input = screen.getByDisplayValue('Client');
      expect(input).toBeInTheDocument();
    });

    // Both customizations show ↺ buttons. Click the customer row's reset.
    const customerRow = await getEntityRow('Customer');
    const resetBtn = within(customerRow).getAllByRole('button', { name: /reset to default/i })[0];
    await user.click(resetBtn);

    // Customer cleared.
    expect(screen.queryByDisplayValue('Client')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Clients')).not.toBeInTheDocument();

    // Work order still customized.
    expect(screen.getByDisplayValue('Job')).toBeInTheDocument();
  });

  it('save sends the customized glossary as a partial update', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.put).mockResolvedValue({ data: { ...baseSettings, glossary: { work_order: { singular: 'Job', plural: 'Jobs' } } } });

    renderWithProviders(<TerminologyPanel />);

    await waitFor(() => expect(screen.getByPlaceholderText('Work Order')).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText('Work Order'), 'Job');
    // After typing the singular, the plural input's placeholder auto-
    // suggests "Jobs" — query by aria-label to stay stable across the
    // placeholder flip.
    await user.type(screen.getByLabelText('Work Order plural'), 'Jobs');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        expect.stringContaining('/tenant-settings'),
        expect.objectContaining({
          glossary: { work_order: { singular: 'Job', plural: 'Jobs' } },
        })
      );
    });
  });

  it('Reset all to defaults sends an empty glossary map (not null)', async () => {
    const user = userEvent.setup();
    setupApi({ customer: { singular: 'Client', plural: 'Clients' } });
    vi.mocked(apiClient.put).mockResolvedValue({ data: { ...baseSettings, glossary: {} } });

    renderWithProviders(<TerminologyPanel />);

    await waitFor(() => expect(screen.getByDisplayValue('Client')).toBeInTheDocument());

    // Footer's Reset opens the destructive confirm Alert.
    await user.click(screen.getByRole('button', { name: /reset to defaults/i }));
    // After the Alert opens, two buttons match — pick the one inside the
    // Alert (last in document order) to actually fire the confirm.
    const buttons = await screen.findAllByRole('button', { name: /reset to defaults/i });
    await user.click(buttons[buttons.length - 1]);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      const callArg = vi.mocked(apiClient.put).mock.calls[0][1] as { glossary: unknown };
      // Critically: empty MAP, not null — null is silently ignored by
      // the partial-update model and would be a footgun.
      expect(callArg.glossary).toEqual({});
      expect(callArg.glossary).not.toBeNull();
    });
  });

  it('cancel reverts unsaved edits without submitting', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TerminologyPanel />);

    await waitFor(() => expect(screen.getByPlaceholderText('Work Order')).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText('Work Order'), 'Job');

    expect(screen.getByDisplayValue('Job')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.queryByDisplayValue('Job')).not.toBeInTheDocument();
    expect(apiClient.put).not.toHaveBeenCalled();
    expect(screen.getByText(/no changes/i)).toBeInTheDocument();
  });

  it('applying a preset from a clean form shows the no-overwrite note then fills fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TerminologyPanel />);

    await waitFor(() => expect(screen.getByRole('button', { name: /^Plumbing/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^Plumbing/i }));

    // Confirm dialog appears with the preset name and the clean note.
    await screen.findByText(/Apply Plumbing preset\?/i);
    expect(screen.getByText(/Currently on defaults/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^apply preset$/i }));

    // Fields are filled to plumbing values.
    await waitFor(() => {
      expect(screen.getByDisplayValue('Job')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Plumber')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Property')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Fixture')).toBeInTheDocument();
    });

    // Footer flips to unsaved.
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
  });

  it('applying a preset with existing customizations shows a warning with the overwrite count', async () => {
    const user = userEvent.setup();
    // Pre-customize two entities that Plumbing also covers.
    setupApi({
      work_order: { singular: 'Service Call', plural: 'Service Calls' },
      technician: { singular: 'Tech', plural: 'Techs' },
    });

    renderWithProviders(<TerminologyPanel />);

    await waitFor(() => expect(screen.getByDisplayValue('Service Call')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^Plumbing/i }));

    // Warning callout: "2 customized names will be replaced"
    await screen.findByText(/2 customized names will be replaced/i);

    // Cancel leaves prior customizations alone.
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.getByDisplayValue('Service Call')).toBeInTheDocument();
  });

  it('renders an inline danger callout when the server rejects unknown entity keys', async () => {
    const user = userEvent.setup();
    // Simulate the 400 { error, unknownKeys: [...] } shape on save.
    vi.mocked(apiClient.put).mockRejectedValue(
      Object.assign(new Error('Unknown glossary entity keys'), {
        response: { data: { error: 'Unknown glossary entity keys', unknownKeys: ['wokr_order', 'vehicle'] } },
      })
    );

    renderWithProviders(<TerminologyPanel />);
    await waitFor(() => expect(screen.getByPlaceholderText('Work Order')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText('Work Order'), 'Job');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      // Keys sorted alphabetically per the locked rejection shape.
      expect(screen.getByText(/Unknown entity in saved terminology: vehicle, wokr_order/i)).toBeInTheDocument();
    });
  });

  it('renders the footer note about renames not affecting existing records', async () => {
    renderWithProviders(<TerminologyPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Renaming entities does not affect existing records/i)).toBeInTheDocument();
    });
  });
});
