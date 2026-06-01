import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders, userEvent } from '../test/utils';
import ServiceLocationDetailPage from './ServiceLocationDetailPage';
import apiClient from '../api/client';
import type { RouteObject } from 'react-router-dom';
import type { ServiceLocationDetailDto } from '../api';

vi.mock('../api/client');

const mockLocation: ServiceLocationDetailDto = {
  id: 'location-1',
  customerId: 'customer-1',
  customerName: 'Test Customer',
  premiseType: 'BUSINESS' as const,
  dispatchRegionId: 'region-1',
  locationName: 'Main Office',
  address: {
    streetAddress: '123 Main St',
    streetAddressLine2: 'Suite 100',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701',
    validated: true,
    isBusiness: true,
  },
  status: 'ACTIVE' as const,
  siteContactName: 'John Doe',
  siteContactPhone: '5551234567',
  siteContactEmail: 'john@example.com',
  additionalContacts: [],
  accessInstructions: 'Use side entrance',
  notes: 'Important client',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T10:30:00Z',
  version: 1,
  region: { abbreviation: 'AZ-Central', name: 'Arizona Central' },
  customerStatus: 'ACTIVE' as const,
  customerType: 'STANDARD' as const,
  customerPaymentTermsDays: 30,
  tags: [],
  techOnSite: false,
  hasOpenJobs: false,
  lastServiceAt: null,
};

describe('ServiceLocationDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockApiResponses = (
    location: ServiceLocationDetailDto | null = mockLocation,
    regions: unknown[] = [],
    equipment: unknown[] = []
  ) => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      // Site contact card reads the full contact collection (primary-first).
      // Project the location's primary site-contact fields into a primary
      // contact, then append any additional contacts.
      if (url.includes('/service-locations/') && url.includes('/contacts')) {
        const contacts = [];
        if (location?.siteContactName || location?.siteContactPhone || location?.siteContactEmail) {
          contacts.push({
            id: 'primary-contact',
            name: location.siteContactName ?? '',
            phone: location.siteContactPhone ?? null,
            email: location.siteContactEmail ?? null,
            displayOrder: 0,
            isPrimary: true,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          });
        }
        contacts.push(...(location?.additionalContacts ?? []).map((c) => ({ ...c, isPrimary: false })));
        return Promise.resolve({ data: contacts });
      }
      if (url.includes('/notification-preferences')) {
        // Contacts tab fetches per-contact prefs for the Notifications column.
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/service-locations/')) {
        return location ? Promise.resolve({ data: location }) : Promise.reject(new Error('Not found'));
      }
      if (url.includes('/dispatch-regions')) {
        return Promise.resolve({ data: regions });
      }
      if (url.startsWith('/work-orders/config/')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/work-orders')) {
        return Promise.resolve({
          data: { content: [], totalElements: 0, totalPages: 0, number: 0, size: 25 },
        });
      }
      if (url === '/equipment' || url.startsWith('/equipment?')) {
        return Promise.resolve({
          data: {
            content: equipment,
            totalElements: equipment.length,
            totalPages: 1,
            number: 0,
            size: 100,
          },
        });
      }
      if (url === '/equipment/config/types') {
        return Promise.resolve({ data: [] });
      }
      if (url.startsWith('/equipment/config/categories')) {
        return Promise.resolve({ data: [] });
      }
      if (url.startsWith('/equipment/')) {
        // Equipment getById — used when opening the edit dialog.
        return Promise.resolve({ data: equipment[0] ?? null });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  };

  const renderDetailPage = (locationId = 'location-1') => {
    const routes: RouteObject[] = [
      {
        path: '/service-locations/:id',
        element: <ServiceLocationDetailPage />,
      },
    ];

    return renderWithProviders(<ServiceLocationDetailPage />, {
      routes,
      initialPath: `/service-locations/${locationId}`,
    });
  };

  // ── States ────────────────────────────────────────────────────────────
  it('displays loading state', () => {
    vi.mocked(apiClient.get).mockImplementation(() => new Promise(() => {}));
    renderDetailPage();
    expect(screen.getByText(/loading location/i)).toBeInTheDocument();
  });

  it('displays error state when fetch fails', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));
    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByText(/error loading location/i)).toBeInTheDocument();
    });
  });

  it('displays a back action in the error state', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));
    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByText(/error loading location/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /back to location/i })).toBeInTheDocument();
  });

  // ── Header ────────────────────────────────────────────────────────────
  it('displays location headline and status', async () => {
    mockApiResponses();
    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByText('Main Office')).toBeInTheDocument();
    });
    // "Active" appears on both the location status pill and the Billed-to
    // customer-status pill.
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
  });

  it('falls back to the customer name as headline for an unnamed location', async () => {
    mockApiResponses({ ...mockLocation, locationName: '' });
    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Customer' })).toBeInTheDocument();
    });
  });

  it('displays an inactive status', async () => {
    mockApiResponses({ ...mockLocation, status: 'INACTIVE' as const });
    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByText('Main Office')).toBeInTheDocument();
    });
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('displays the full address in the header', async () => {
    mockApiResponses();
    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByText(/123 Main St Suite 100/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Springfield, IL 62701/i)).toBeInTheDocument();
  });

  // ── Back-link + customer link ───────────────────────────────────────────
  it('back-link defaults to the parent customer', async () => {
    mockApiResponses();
    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByText('Main Office')).toBeInTheDocument();
    });
    const backLink = screen.getByRole('link', { name: /test customer/i });
    expect(backLink).toHaveAttribute('href', '/customers/customer-1');
  });

  it('links to the parent customer from the Billed-to card', async () => {
    mockApiResponses();
    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByText('Main Office')).toBeInTheDocument();
    });
    const customerLink = screen.getByRole('link', { name: /open customer/i });
    expect(customerLink).toHaveAttribute('href', '/customers/customer-1');
  });

  // ── Overview content ──────────────────────────────────────────────────
  it('displays site contact information', async () => {
    mockApiResponses();
    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    expect(screen.getByText('(555) 123-4567')).toHaveAttribute('href', 'tel:5551234567');
    expect(screen.getByText('john@example.com')).toHaveAttribute('href', 'mailto:john@example.com');
  });

  it('displays access instructions', async () => {
    mockApiResponses();
    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByText('Use side entrance')).toBeInTheDocument();
    });
  });

  it('displays notes', async () => {
    mockApiResponses();
    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByText('Important client')).toBeInTheDocument();
    });
  });

  it('displays the region label from the payload', async () => {
    mockApiResponses();
    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByText('AZ-Central')).toBeInTheDocument();
    });
  });

  it('renders without crashing for a minimal location', async () => {
    mockApiResponses({
      ...mockLocation,
      siteContactName: '',
      siteContactPhone: '',
      siteContactEmail: '',
      accessInstructions: '',
      notes: '',
    });
    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByText('Main Office')).toBeInTheDocument();
    });
    // Empty-state copy stands in for the missing site contact + notes.
    expect(screen.getByText(/no site contact on file/i)).toBeInTheDocument();
    expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
  });

  // ── Tabs ──────────────────────────────────────────────────────────────
  it('displays all tabs', async () => {
    mockApiResponses();
    renderDetailPage();
    await waitFor(() => {
      expect(screen.getByText('Main Office')).toBeInTheDocument();
    });
    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /equipment/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /work order/i })).toBeInTheDocument();
    // "Visits" tab is glossary-driven from the `dispatch` entity → "Dispatches".
    expect(screen.getByRole('tab', { name: /dispatch/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /contacts/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /activity/i })).toBeInTheDocument();
  });

  it('switches to the equipment tab', async () => {
    mockApiResponses();
    const user = userEvent.setup();
    renderDetailPage();
    await waitFor(() => expect(screen.getByText('Main Office')).toBeInTheDocument());

    const equipmentTab = screen.getByRole('tab', { name: /equipment/i });
    await user.click(equipmentTab);
    await waitFor(() => expect(equipmentTab).toHaveAttribute('aria-selected', 'true'));
  });

  it('switches to the work orders tab', async () => {
    mockApiResponses();
    const user = userEvent.setup();
    renderDetailPage();
    await waitFor(() => expect(screen.getByText('Main Office')).toBeInTheDocument());

    const workOrdersTab = screen.getByRole('tab', { name: /work order/i });
    await user.click(workOrdersTab);
    await waitFor(() => expect(workOrdersTab).toHaveAttribute('aria-selected', 'true'));
  });

  it('switches to the activity tab', async () => {
    mockApiResponses();
    const user = userEvent.setup();
    renderDetailPage();
    await waitFor(() => expect(screen.getByText('Main Office')).toBeInTheDocument());

    const activityTab = screen.getByRole('tab', { name: /activity/i });
    await user.click(activityTab);
    await waitFor(() => expect(activityTab).toHaveAttribute('aria-selected', 'true'));
  });

  it('renders the contacts directory table on the Contacts tab', async () => {
    mockApiResponses();
    const user = userEvent.setup();
    renderDetailPage();
    await waitFor(() => expect(screen.getByText('Main Office')).toBeInTheDocument());

    const contactsTab = screen.getByRole('tab', { name: /contacts/i });
    await user.click(contactsTab);
    await waitFor(() => expect(contactsTab).toHaveAttribute('aria-selected', 'true'));

    // The primary site contact shows in the directory, badged + with its phone.
    await waitFor(() => {
      const table = screen.getByRole('table');
      expect(within(table).getByText('John Doe')).toBeInTheDocument();
      expect(within(table).getByText('Primary')).toBeInTheDocument();
      expect(within(table).getByText('(555) 123-4567')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /add contact/i })).toBeInTheDocument();
  });

  it('shows the coming-soon stub for the Visits (Dispatches) tab', async () => {
    mockApiResponses();
    const user = userEvent.setup();
    renderDetailPage();
    await waitFor(() => expect(screen.getByText('Main Office')).toBeInTheDocument());

    await user.click(screen.getByRole('tab', { name: /dispatch/i }));
    await waitFor(() => expect(screen.getByText(/coming soon/i)).toBeInTheDocument());
  });

  it('scopes the work-orders fetch to serviceLocationId only (not customerId)', async () => {
    // Regression: passing both customerId and serviceLocationId caused the backend to
    // return all of the customer's work orders, leaking sibling locations' WOs.
    mockApiResponses();
    renderDetailPage();
    await waitFor(() => expect(screen.getByText('Main Office')).toBeInTheDocument());

    const calls = vi.mocked(apiClient.get).mock.calls;
    const workOrdersCall = calls.find(([url]) => typeof url === 'string' && url === '/work-orders');
    expect(workOrdersCall).toBeDefined();
    const params = (workOrdersCall![1] as { params?: Record<string, unknown> })?.params ?? {};
    expect(params).toHaveProperty('serviceLocationId', 'location-1');
    expect(params).not.toHaveProperty('customerId');
  });

  // ── Header actions / dialogs ────────────────────────────────────────────
  it('opens the edit dialog from the header', async () => {
    mockApiResponses();
    const user = userEvent.setup();
    renderDetailPage();
    await waitFor(() => expect(screen.getByText('Main Office')).toBeInTheDocument());

    // Header "Edit" is the first Edit-labelled button (before the right-rail card links).
    const editButtons = screen.getAllByRole('button', { name: /^edit$/i });
    await user.click(editButtons[0]);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  });

  it('closes the edit dialog on cancel', async () => {
    mockApiResponses();
    const user = userEvent.setup();
    renderDetailPage();
    await waitFor(() => expect(screen.getByText('Main Office')).toBeInTheDocument());

    await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0]);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('opens the new-work-order dialog with the service location pre-selected', async () => {
    mockApiResponses();
    const user = userEvent.setup();
    renderDetailPage();
    await waitFor(() => expect(screen.getByText('Main Office')).toBeInTheDocument());

    // Header + Jobs-in-flight card both expose a "New Work Order" button; either opens
    // the same dialog. Click the first.
    await user.click(screen.getAllByRole('button', { name: /new work order/i })[0]);

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByDisplayValue(/Main Office.*123 Main St.*Springfield/i)).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /existing customer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /new customer/i })).not.toBeInTheDocument();
  });

  // ── Lifecycle footer ────────────────────────────────────────────────────
  it('confirms before closing the location', async () => {
    mockApiResponses();
    const closeSpy = vi.mocked(apiClient.post).mockResolvedValue({ data: mockLocation });
    const user = userEvent.setup();
    renderDetailPage();
    await waitFor(() => expect(screen.getByText('Main Office')).toBeInTheDocument());

    // Footer "Close location" → confirmation dialog → confirm.
    await user.click(screen.getByRole('button', { name: /^close location$/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /close location/i }));

    await waitFor(() => {
      expect(closeSpy).toHaveBeenCalledWith('/service-locations/location-1/close');
    });
  });

  // ── Equipment tab ────────────────────────────────────────────────────────
  describe('equipment tab', () => {
    const equipmentList = [
      {
        id: 'eq-1',
        name: 'Upstairs Furnace',
        equipmentTypeName: 'HVAC',
        equipmentCategoryName: 'Furnace',
        make: 'Carrier',
        model: 'C-100',
        serialNumber: 'SN1',
        locationOnSite: 'Basement',
      },
      {
        id: 'eq-2',
        name: 'Walk-in Cooler',
        equipmentTypeName: null,
        equipmentCategoryName: null,
        make: null,
        model: null,
        serialNumber: 'SN2',
        locationOnSite: null,
      },
    ];

    it('renders equipment grouped by type', async () => {
      mockApiResponses(mockLocation, [], equipmentList);
      const user = userEvent.setup();
      renderDetailPage();
      await waitFor(() => expect(screen.getByText('Main Office')).toBeInTheDocument());
      await user.click(screen.getByRole('tab', { name: /equipment/i }));

      await waitFor(() => expect(screen.getByText('Upstairs Furnace')).toBeInTheDocument());
      expect(screen.getByText('Carrier')).toBeInTheDocument();
      expect(screen.getByText('C-100')).toBeInTheDocument();
      expect(screen.getByText('Basement')).toBeInTheDocument();
      expect(screen.getByText('Walk-in Cooler')).toBeInTheDocument();
    });

    it('shows the empty state when there is no equipment', async () => {
      mockApiResponses();
      const user = userEvent.setup();
      renderDetailPage();
      await waitFor(() => expect(screen.getByText('Main Office')).toBeInTheDocument());
      await user.click(screen.getByRole('tab', { name: /equipment/i }));

      await waitFor(() => expect(screen.getByText(/no.*equipment.*yet/i)).toBeInTheDocument());
    });

    it('opens the equipment form dialog in create mode when Add is clicked', async () => {
      mockApiResponses();
      const user = userEvent.setup();
      renderDetailPage();
      await waitFor(() => expect(screen.getByText('Main Office')).toBeInTheDocument());
      await user.click(screen.getByRole('tab', { name: /equipment/i }));
      await user.click(await screen.findByRole('button', { name: /add equipment/i }));

      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
      expect(screen.queryByLabelText(/customer/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^Location \*$/)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
    });

    it('opens the edit dialog with the full record when Edit is selected', async () => {
      const fullRecord = { ...equipmentList[0], serviceLocationId: 'location-1', status: 'ACTIVE', attributes: '{}' };
      mockApiResponses(mockLocation, [], [fullRecord]);
      const user = userEvent.setup();
      renderDetailPage();
      await waitFor(() => expect(screen.getByText('Main Office')).toBeInTheDocument());
      await user.click(screen.getByRole('tab', { name: /equipment/i }));
      await waitFor(() => expect(screen.getByText('Upstairs Furnace')).toBeInTheDocument());

      // Scope to the equipment row — the header also has a "More options" kebab.
      const row = screen.getByText('Upstairs Furnace').closest('tr')!;
      await user.click(within(row).getByRole('button', { name: /more options/i }));
      await user.click(await screen.findByRole('menuitem', { name: /edit/i }));

      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    });

    it('confirms before deleting and calls the delete endpoint', async () => {
      mockApiResponses(mockLocation, [], equipmentList);
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const deleteSpy = vi.mocked(apiClient.delete).mockResolvedValue({ data: undefined });
      const user = userEvent.setup();
      renderDetailPage();
      await waitFor(() => expect(screen.getByText('Main Office')).toBeInTheDocument());
      await user.click(screen.getByRole('tab', { name: /equipment/i }));
      await waitFor(() => expect(screen.getByText('Upstairs Furnace')).toBeInTheDocument());

      // Scope to the equipment row — the header also has a "More options" kebab.
      const row = screen.getByText('Upstairs Furnace').closest('tr')!;
      await user.click(within(row).getByRole('button', { name: /more options/i }));
      await user.click(await screen.findByRole('menuitem', { name: /delete/i }));

      await waitFor(() => {
        expect(confirmSpy).toHaveBeenCalled();
        expect(deleteSpy).toHaveBeenCalledWith('/equipment/eq-1');
      });
      confirmSpy.mockRestore();
    });
  });
});
