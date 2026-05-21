import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, userEvent } from '../../test/utils';
import CompanyProfilePanel from './CompanyProfilePanel';
import apiClient from '../../api/client';

vi.mock('../../api/client');

const mockSettings = {
  tenantId: 't-1',
  companyName: 'Acme HVAC',
  companyNameShort: 'Acme',
  companySlogan: 'Comfort First',
  logoOriginalUrl: null,
  logoLargeUrl: null,
  logoMediumUrl: null,
  logoSmallUrl: null,
  logoThumbnailUrl: null,
  primaryColor: '#1976d2',
  secondaryColor: '#dc004e',
  streetAddress: '123 Main',
  city: 'Springfield',
  state: 'IL',
  zipCode: '62701',
  phone: '5551234567',
  email: 'info@acme.com',
  timezone: 'America/Chicago',
  defaultTaxRate: 0.0825,
  invoiceTerms: 'Net 30',
  enableOnlineBooking: true,
  enableSmsNotifications: false,
  enableEmailNotifications: true,
  glossary: {},
  updatedAt: '2026-03-27T10:30:00Z',
};

describe('CompanyProfilePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockSettings });
  });

  it('renders Company Profile heading and identity values in view mode', async () => {
    renderWithProviders(<CompanyProfilePanel />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /company profile/i })).toBeInTheDocument());
    expect(screen.getByText('Acme HVAC')).toBeInTheDocument();
    expect(screen.getByText(/123 Main/)).toBeInTheDocument();
    expect(screen.getByText(/Springfield, IL 62701/)).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Comfort First')).toBeInTheDocument();
  });

  it('renders Logo section in view mode', async () => {
    renderWithProviders(<CompanyProfilePanel />);
    await waitFor(() => expect(screen.getByText('Acme HVAC')).toBeInTheDocument());
    expect(screen.getByText('Logo')).toBeInTheDocument();
  });

  it('does not show non-identity sections (Business Settings, Branding colors, Feature Flags)', async () => {
    renderWithProviders(<CompanyProfilePanel />);
    await waitFor(() => expect(screen.getByText('Acme HVAC')).toBeInTheDocument());
    expect(screen.queryByText(/Business Settings/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Feature Flags/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Primary Color/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Secondary Color/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Timezone/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Default Tax Rate/i)).not.toBeInTheDocument();
  });

  it('switches to edit mode on Edit click and back on Cancel', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanyProfilePanel />);
    await waitFor(() => expect(screen.getByText('Acme HVAC')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByDisplayValue('Acme HVAC')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('submits update with modified company name', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.put).mockResolvedValue({
      data: { ...mockSettings, companyName: 'New Name' },
    });
    renderWithProviders(<CompanyProfilePanel />);
    await waitFor(() => expect(screen.getByText('Acme HVAC')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /edit/i }));

    const nameInput = screen.getByDisplayValue('Acme HVAC');
    await user.clear(nameInput);
    await user.type(nameInput, 'New Name');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        expect.stringContaining('/tenant'),
        expect.objectContaining({ companyName: 'New Name' }),
      );
    });
  });

  it('shows loading state while fetching', () => {
    vi.mocked(apiClient.get).mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<CompanyProfilePanel />);
    expect(screen.getByText(/loading settings/i)).toBeInTheDocument();
  });

  it('shows error state on fetch failure', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));
    renderWithProviders(<CompanyProfilePanel />);
    await waitFor(() => {
      expect(screen.getByText(/error loading tenant settings/i)).toBeInTheDocument();
    });
  });

  it('surfaces API error message on load failure', async () => {
    const error = Object.assign(new Error('fail'), {
      response: { data: { message: 'Token expired' } },
    });
    vi.mocked(apiClient.get).mockRejectedValue(error);
    renderWithProviders(<CompanyProfilePanel />);
    await waitFor(() => {
      expect(screen.getByText('Token expired')).toBeInTheDocument();
    });
  });

  it('rejects logo file larger than 5MB', async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderWithProviders(<CompanyProfilePanel />);
    await waitFor(() => expect(screen.getByText('Acme HVAC')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /edit/i }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const bigFile = new File(['x'.repeat(6 * 1024 * 1024)], 'logo.png', { type: 'image/png' });
    await user.upload(fileInput, bigFile);

    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/file size/i));
    alertSpy.mockRestore();
  });

  it('uploads a valid logo and calls the upload endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { ...mockSettings, logoOriginalUrl: 'https://x/logo.png' },
    });
    const user = userEvent.setup();
    renderWithProviders(<CompanyProfilePanel />);
    await waitFor(() =>
      expect(screen.getByText('Acme HVAC')).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /edit/i }));

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const goodFile = new File(['x'], 'logo.png', { type: 'image/png' });
    await user.upload(fileInput, goodFile);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalled();
    });
  });

  it('updates address fields on edit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanyProfilePanel />);
    await waitFor(() =>
      expect(screen.getByText('Acme HVAC')).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /edit/i }));

    const cityInput = screen.getByDisplayValue('Springfield');
    await user.clear(cityInput);
    await user.type(cityInput, 'Shelbyville');
    expect(cityInput).toHaveValue('Shelbyville');
  });

  it('reverts edits when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanyProfilePanel />);
    await waitFor(() =>
      expect(screen.getByText('Acme HVAC')).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /edit/i }));

    const cityInput = screen.getByDisplayValue('Springfield');
    await user.clear(cityInput);
    await user.type(cityInput, 'Shelbyville');

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    // Back in view mode — old city is shown.
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByDisplayValue('Springfield')).toBeInTheDocument();
  });

  it('shows alert when update API rejects', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(apiClient.put).mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderWithProviders(<CompanyProfilePanel />);
    await waitFor(() =>
      expect(screen.getByText('Acme HVAC')).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /edit/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });
    alertSpy.mockRestore();
  });
});
