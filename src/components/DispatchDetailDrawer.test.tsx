import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, userEvent } from '../test/utils';
import DispatchDetailDrawer from './DispatchDetailDrawer';
import type { Dispatch, DispatchStatus, User } from '../api';
import type { NotificationLogDto } from '../api/notificationApi';

const mockUserGetAll = vi.fn();
const mockGetNotificationLogs = vi.fn();

vi.mock('../api/userApi', () => ({
  userApi: { getAll: (...args: unknown[]) => mockUserGetAll(...args) },
  default: { getAll: (...args: unknown[]) => mockUserGetAll(...args) },
}));

vi.mock('../api/notificationApi', async () => {
  // Keep the type exports + constants flowing through; only mock the API.
  const actual = await vi.importActual<typeof import('../api/notificationApi')>(
    '../api/notificationApi'
  );
  return {
    ...actual,
    notificationApi: {
      getNotificationLogs: (...args: unknown[]) =>
        mockGetNotificationLogs(...args),
    },
  };
});

const mockUser = (id: string, first: string, last: string): User => ({
  id,
  tenantId: 't1',
  cognitoSub: `sub-${id}`,
  email: `${first.toLowerCase()}@example.com`,
  firstName: first,
  lastName: last,
  phoneNumber: '555-1234',
  enabled: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

const mockDispatch = (overrides: Partial<Dispatch> = {}): Dispatch => ({
  id: 'd1',
  workOrderId: 'wo-1',
  assignedUserId: 'u1',
  arrivalWindowStart: '2099-05-15T14:00:00Z',
  arrivalWindowEnd: '2099-05-15T16:00:00Z',
  estimatedDuration: 90,
  status: 'SCHEDULED' as DispatchStatus,
  arrivedAt: null,
  departedAt: null,
  notes: null,
  createdAt: '2026-05-09T00:00:00Z',
  updatedAt: '2026-05-09T00:00:00Z',
  ...overrides,
});

const emptyLogsPage = {
  content: [] as NotificationLogDto[],
  pageable: {
    pageNumber: 0,
    pageSize: 25,
    sort: { sorted: true, unsorted: false, empty: false },
    offset: 0,
    paged: true,
    unpaged: false,
  },
  totalElements: 0,
  totalPages: 0,
  last: true,
  size: 25,
  number: 0,
  sort: { sorted: true, unsorted: false, empty: false },
  numberOfElements: 0,
  first: true,
  empty: true,
};

describe('DispatchDetailDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserGetAll.mockResolvedValue([mockUser('u1', 'Jason', 'Smith')]);
    mockGetNotificationLogs.mockResolvedValue(emptyLogsPage);
  });

  it('renders nothing when dispatch is null', () => {
    renderWithProviders(
      <DispatchDetailDrawer
        dispatch={null}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.queryByText('Jason Smith')).not.toBeInTheDocument();
    expect(screen.queryByText(/lifecycle/i)).not.toBeInTheDocument();
  });

  it('renders the tech name and status badge when a dispatch is open', async () => {
    renderWithProviders(
      <DispatchDetailDrawer
        dispatch={mockDispatch()}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Jason Smith')).toBeInTheDocument();
    });
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
  });

  it('renders the lifecycle audit fields', async () => {
    renderWithProviders(
      <DispatchDetailDrawer
        dispatch={mockDispatch({
          status: 'COMPLETED',
          arrivedAt: '2099-05-15T14:05:00Z',
          departedAt: '2099-05-15T15:30:00Z',
        })}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/arrival window/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/^arrived$/i)).toBeInTheDocument();
    expect(screen.getByText(/^departed$/i)).toBeInTheDocument();
    expect(screen.getByText(/^created$/i)).toBeInTheDocument();
  });

  it('renders em-dash for missing arrival / departure timestamps', async () => {
    renderWithProviders(
      <DispatchDetailDrawer
        dispatch={mockDispatch({ status: 'SCHEDULED' })}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/^arrived$/i)).toBeInTheDocument();
    });
    // Arrived + Departed should both render em-dashes for an un-departed
    // SCHEDULED dispatch.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('shows the contact section with phone when tech has one', async () => {
    renderWithProviders(
      <DispatchDetailDrawer
        dispatch={mockDispatch()}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('555-1234')).toBeInTheDocument();
    });
  });

  it('renders the notifications empty state when no logs', async () => {
    renderWithProviders(
      <DispatchDetailDrawer
        dispatch={mockDispatch()}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/no notifications sent yet/i)
      ).toBeInTheDocument();
    });
  });

  it('renders notification log rows when logs are present', async () => {
    mockGetNotificationLogs.mockResolvedValue({
      ...emptyLogsPage,
      empty: false,
      numberOfElements: 1,
      totalElements: 1,
      content: [
        {
          id: 'n1',
          notificationId: 'nid1',
          notificationTypeId: 'nt1',
          notificationTypeName: 'Dispatch Assigned',
          channel: 'SMS',
          recipientName: 'Jason Smith',
          recipientPhone: '555-1234',
          status: 'DELIVERED',
          entityType: 'DISPATCH',
          entityId: 'd1',
          createdAt: '2099-05-15T13:55:00Z',
          sentAt: '2099-05-15T13:55:01Z',
          retryCount: 0,
        } satisfies NotificationLogDto,
      ],
    });

    renderWithProviders(
      <DispatchDetailDrawer
        dispatch={mockDispatch()}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('SMS')).toBeInTheDocument();
    });
    expect(screen.getByText('DELIVERED')).toBeInTheDocument();
    // Recipient phone is shown when present.
    expect(screen.getAllByText('555-1234').length).toBeGreaterThanOrEqual(1);
  });

  it('queries notification logs scoped to this dispatch', async () => {
    renderWithProviders(
      <DispatchDetailDrawer
        dispatch={mockDispatch()}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(mockGetNotificationLogs).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'DISPATCH', entityId: 'd1' })
      );
    });
  });

  it('renders the notes section when dispatch.notes is present', async () => {
    renderWithProviders(
      <DispatchDetailDrawer
        dispatch={mockDispatch({ notes: 'Customer prefers AM' })}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Customer prefers AM')).toBeInTheDocument();
    });
  });

  it('omits the notes section when dispatch.notes is null', async () => {
    renderWithProviders(
      <DispatchDetailDrawer
        dispatch={mockDispatch({ notes: null })}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Jason Smith')).toBeInTheDocument();
    });
    // No "Notes" section heading should render.
    expect(screen.queryByText(/^notes$/i)).not.toBeInTheDocument();
  });

  it('invokes onEdit with the dispatch when the Edit footer button is clicked', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <DispatchDetailDrawer
        dispatch={mockDispatch()}
        onClose={vi.fn()}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />
    );

    const editBtn = await screen.findByRole('button', { name: /^edit$/i });
    await user.click(editBtn);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit.mock.calls[0][0].id).toBe('d1');
  });

  it('invokes onDelete with the dispatch when the Delete footer button is clicked', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <DispatchDetailDrawer
        dispatch={mockDispatch()}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />
    );

    const deleteBtn = await screen.findByRole('button', { name: /^delete$/i });
    await user.click(deleteBtn);

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete.mock.calls[0][0].id).toBe('d1');
  });

  it('hides the footer Edit/Delete actions in read-only mode', async () => {
    renderWithProviders(
      <DispatchDetailDrawer
        dispatch={mockDispatch()}
        readOnly
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Jason Smith')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^delete$/i })
    ).not.toBeInTheDocument();
  });

  it('invokes onClose when the X button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <DispatchDetailDrawer
        dispatch={mockDispatch()}
        onClose={onClose}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const closeBtn = await screen.findByRole('button', { name: /close/i });
    await user.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
