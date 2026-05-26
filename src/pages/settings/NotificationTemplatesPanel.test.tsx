import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, userEvent } from '../../test/utils';
import NotificationTemplatesPanel from './NotificationTemplatesPanel';
import apiClient from '../../api/client';

vi.mock('../../api/client');

const navigateSpy = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

const mockTemplates = [
  {
    id: 'tpl-1',
    notificationTypeKey: 'invoice_sent',
    displayName: 'Invoice Sent',
    channel: 'EMAIL',
    audience: 'CUSTOMER',
    subject: 'Your invoice is ready',
    isSystemTemplate: true,
    hasHtmlBody: false,
    tenantId: null,
    version: 1,
    isActive: true,
  },
  {
    id: 'tpl-2',
    notificationTypeKey: 'work_order_completed',
    displayName: 'Work Order Completed',
    channel: 'SMS',
    audience: 'INTERNAL',
    subject: null,
    isSystemTemplate: false,
    hasHtmlBody: false,
    tenantId: 'tenant-1',
    version: 3,
    isActive: true,
  },
  // PUSH should be filtered out client-side — the stubbed FAILED channel.
  {
    id: 'tpl-3',
    notificationTypeKey: 'never_shown',
    displayName: 'Push Notification',
    channel: 'PUSH',
    audience: 'CUSTOMER',
    subject: null,
    isSystemTemplate: true,
    hasHtmlBody: false,
    tenantId: null,
    version: 1,
    isActive: true,
  },
];

describe('NotificationTemplatesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateSpy.mockReset();
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { templates: mockTemplates },
    });
  });

  it('renders templates with channel and status', async () => {
    renderWithProviders(<NotificationTemplatesPanel />);

    await waitFor(() => {
      expect(screen.getByText('Invoice Sent')).toBeInTheDocument();
    });
    expect(screen.getByText('Work Order Completed')).toBeInTheDocument();
    expect(screen.getByText('System default')).toBeInTheDocument();
    expect(screen.getByText('Customized')).toBeInTheDocument();
    expect(screen.getByText(/your invoice is ready/i)).toBeInTheDocument();
    // Audience surfaces per row: tpl-1 CUSTOMER, tpl-2 INTERNAL.
    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.getByText('Internal')).toBeInTheDocument();
  });

  it('filters PUSH templates out of the list', async () => {
    renderWithProviders(<NotificationTemplatesPanel />);

    await waitFor(() => {
      expect(screen.getByText('Invoice Sent')).toBeInTheDocument();
    });
    expect(screen.queryByText('Push Notification')).not.toBeInTheDocument();
  });

  it('navigates to the edit page when a row is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NotificationTemplatesPanel />);

    await waitFor(() =>
      expect(screen.getByText('Invoice Sent')).toBeInTheDocument()
    );

    await user.click(screen.getByText('Invoice Sent'));

    expect(navigateSpy).toHaveBeenCalledWith('/settings/notifications/tpl-1');
  });

  it('shows the empty state when the catalog is empty', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { templates: [] } });
    renderWithProviders(<NotificationTemplatesPanel />);

    await waitFor(() => {
      expect(screen.getByText(/no templates yet/i)).toBeInTheDocument();
    });
  });

  it('surfaces an error state on load failure with a retry action', async () => {
    const error = Object.assign(new Error('fail'), {
      response: { data: { message: 'Templates service down' } },
    });
    vi.mocked(apiClient.get).mockRejectedValue(error);

    renderWithProviders(<NotificationTemplatesPanel />);

    await waitFor(() => {
      expect(screen.getByText('Templates service down')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('surfaces the customized summary on the toolbar when overrides exist', async () => {
    renderWithProviders(<NotificationTemplatesPanel />);

    await waitFor(() => {
      // 1 customized + 1 system default after PUSH filter
      expect(
        screen.getByText(/1 on system defaults/i)
      ).toBeInTheDocument();
    });
  });
});
