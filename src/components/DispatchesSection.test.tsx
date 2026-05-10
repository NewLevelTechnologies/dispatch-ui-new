import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, userEvent } from '../test/utils';
import DispatchesSection from './DispatchesSection';
import type { Dispatch, DispatchStatus, User } from '../api';

const mockDispatchesGetAll = vi.fn();
const mockDispatchesUpdate = vi.fn();
const mockUserGetAll = vi.fn();

// Mocking the source modules — the barrel re-exports from these, so component
// imports (`from '../api'`) resolve to these mocked versions.
vi.mock('../api/schedulingApi', () => ({
  dispatchesApi: {
    getAll: (...args: unknown[]) => mockDispatchesGetAll(...args),
    update: (...args: unknown[]) => mockDispatchesUpdate(...args),
  },
}));
vi.mock('../api/userApi', () => ({
  userApi: { getAll: (...args: unknown[]) => mockUserGetAll(...args) },
  default: { getAll: (...args: unknown[]) => mockUserGetAll(...args) },
}));

const mockUser = (id: string, first: string, last: string, enabled = true): User => ({
  id,
  tenantId: 't1',
  cognitoSub: `sub-${id}`,
  email: `${first.toLowerCase()}@example.com`,
  firstName: first,
  lastName: last,
  phoneNumber: null,
  enabled,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

const mockDispatch = (overrides: Partial<Dispatch> = {}): Dispatch => ({
  id: 'd1',
  workOrderId: 'wo-1',
  assignedUserId: 'u1',
  arrivalWindowStart: '2026-05-15T14:00:00Z',
  arrivalWindowEnd: '2026-05-15T16:00:00Z',
  estimatedDuration: 90,
  status: 'SCHEDULED' as DispatchStatus,
  arrivedAt: null,
  departedAt: null,
  notes: null,
  createdAt: '2026-05-09T00:00:00Z',
  updatedAt: '2026-05-09T00:00:00Z',
  ...overrides,
});

describe('DispatchesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserGetAll.mockResolvedValue([mockUser('u1', 'Jason', 'Smith')]);
  });

  it('renders empty state with assign button when no dispatches', async () => {
    mockDispatchesGetAll.mockResolvedValue([]);
    const onAssign = vi.fn();

    renderWithProviders(
      <DispatchesSection workOrderId="wo-1" onAssign={onAssign} />
    );

    await waitFor(() => {
      expect(screen.getByText(/no technician assigned yet/i)).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: /assign technician/i })
    ).toBeInTheDocument();
  });

  it('hides the assign button in read-only mode', async () => {
    mockDispatchesGetAll.mockResolvedValue([]);

    renderWithProviders(
      <DispatchesSection workOrderId="wo-1" readOnly onAssign={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText(/no technician assigned yet/i)).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: /assign technician/i })
    ).not.toBeInTheDocument();
  });

  it('invokes onAssign when the assign button is clicked', async () => {
    mockDispatchesGetAll.mockResolvedValue([]);
    const onAssign = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <DispatchesSection workOrderId="wo-1" onAssign={onAssign} />
    );

    const button = await screen.findByRole('button', {
      name: /assign technician/i,
    });
    await user.click(button);

    expect(onAssign).toHaveBeenCalledTimes(1);
  });

  it('renders a populated row with tech name, duration, and status', async () => {
    mockDispatchesGetAll.mockResolvedValue([mockDispatch()]);

    renderWithProviders(
      <DispatchesSection workOrderId="wo-1" onAssign={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText('Jason Smith')).toBeInTheDocument();
    });
    // Duration formatted as "1h 30m" for 90 minutes.
    expect(screen.getByText('1h 30m')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
  });

  it('formats a same-day arrival window as a single date with a time range', async () => {
    mockDispatchesGetAll.mockResolvedValue([
      mockDispatch({
        // Pin to local-noon-ish to avoid TZ flake on either side of midnight.
        arrivalWindowStart: '2026-05-15T16:00:00Z',
        arrivalWindowEnd: '2026-05-15T18:00:00Z',
      }),
    ]);

    renderWithProviders(
      <DispatchesSection workOrderId="wo-1" onAssign={vi.fn()} />
    );

    await waitFor(() => {
      // "Fri, May 15 · 12:00 PM – 2:00 PM" — exact wall time depends on the
      // runner TZ, so just assert the structure: a date prefix joined to a
      // time range with the en-dash separator.
      expect(screen.getByText(/May 15.*·.*–/)).toBeInTheDocument();
    });
  });

  it('renders an em dash in the duration cell when estimatedDuration is null', async () => {
    mockDispatchesGetAll.mockResolvedValue([
      mockDispatch({ estimatedDuration: null }),
    ]);

    renderWithProviders(
      <DispatchesSection workOrderId="wo-1" onAssign={vi.fn()} />
    );

    // Tech name renders, so the row mounted; em-dash sits in the duration cell.
    await waitFor(() => {
      expect(screen.getByText('Jason Smith')).toBeInTheDocument();
    });
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders notes underneath the tech name when present', async () => {
    mockDispatchesGetAll.mockResolvedValue([
      mockDispatch({ notes: 'Customer prefers AM' }),
    ]);

    renderWithProviders(
      <DispatchesSection workOrderId="wo-1" onAssign={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText('Customer prefers AM')).toBeInTheDocument();
    });
  });

  it('renders arrived/departed timestamps for completed dispatches', async () => {
    mockDispatchesGetAll.mockResolvedValue([
      mockDispatch({
        status: 'COMPLETED',
        arrivedAt: '2026-05-15T14:05:00Z',
        departedAt: '2026-05-15T15:30:00Z',
      }),
    ]);

    renderWithProviders(
      <DispatchesSection workOrderId="wo-1" onAssign={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText(/arrived/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/departed/i)).toBeInTheDocument();
  });

  it('falls back to email when tech has no first/last name', async () => {
    mockUserGetAll.mockResolvedValue([
      {
        ...mockUser('u1', '', ''),
        firstName: '',
        lastName: '',
        email: 'fallback@example.com',
      },
    ]);
    mockDispatchesGetAll.mockResolvedValue([mockDispatch()]);

    renderWithProviders(
      <DispatchesSection workOrderId="wo-1" onAssign={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText('fallback@example.com')).toBeInTheDocument();
    });
  });

  it('renders an em dash when the assigned user is not in the user list', async () => {
    mockUserGetAll.mockResolvedValue([]);
    mockDispatchesGetAll.mockResolvedValue([mockDispatch()]);

    renderWithProviders(
      <DispatchesSection workOrderId="wo-1" onAssign={vi.fn()} />
    );

    // The em-dash renders in the Tech cell when the userId resolves to nothing.
    await waitFor(() => {
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  it('advances SCHEDULED → IN_PROGRESS via the Mark arrived button', async () => {
    mockDispatchesGetAll.mockResolvedValue([mockDispatch({ status: 'SCHEDULED' })]);
    mockDispatchesUpdate.mockResolvedValue(mockDispatch({ status: 'IN_PROGRESS' }));
    const user = userEvent.setup();

    renderWithProviders(
      <DispatchesSection workOrderId="wo-1" onAssign={vi.fn()} />
    );

    const arriveBtn = await screen.findByRole('button', { name: /mark arrived/i });
    await user.click(arriveBtn);

    await waitFor(() => {
      expect(mockDispatchesUpdate).toHaveBeenCalledWith('d1', {
        status: 'IN_PROGRESS',
      });
    });
  });

  it('advances IN_PROGRESS → COMPLETED via the Mark completed button', async () => {
    mockDispatchesGetAll.mockResolvedValue([
      mockDispatch({ status: 'IN_PROGRESS', arrivedAt: '2026-05-15T14:05:00Z' }),
    ]);
    mockDispatchesUpdate.mockResolvedValue(mockDispatch({ status: 'COMPLETED' }));
    const user = userEvent.setup();

    renderWithProviders(
      <DispatchesSection workOrderId="wo-1" onAssign={vi.fn()} />
    );

    const completeBtn = await screen.findByRole('button', {
      name: /mark completed/i,
    });
    await user.click(completeBtn);

    await waitFor(() => {
      expect(mockDispatchesUpdate).toHaveBeenCalledWith('d1', {
        status: 'COMPLETED',
      });
    });
  });

  it('does not show advance buttons for terminal statuses', async () => {
    mockDispatchesGetAll.mockResolvedValue([
      mockDispatch({ status: 'COMPLETED' }),
    ]);

    renderWithProviders(
      <DispatchesSection workOrderId="wo-1" onAssign={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /mark arrived/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /mark completed/i })
    ).not.toBeInTheDocument();
  });

  it('hides advance buttons in read-only mode', async () => {
    mockDispatchesGetAll.mockResolvedValue([mockDispatch({ status: 'SCHEDULED' })]);

    renderWithProviders(
      <DispatchesSection workOrderId="wo-1" readOnly onAssign={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText('Jason Smith')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /mark arrived/i })).not.toBeInTheDocument();
  });

  it('alerts on advance error and does not throw', async () => {
    mockDispatchesGetAll.mockResolvedValue([mockDispatch({ status: 'SCHEDULED' })]);
    mockDispatchesUpdate.mockRejectedValue(new Error('boom'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();

    renderWithProviders(
      <DispatchesSection workOrderId="wo-1" onAssign={vi.fn()} />
    );

    const arriveBtn = await screen.findByRole('button', { name: /mark arrived/i });
    await user.click(arriveBtn);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });
    alertSpy.mockRestore();
  });

  it('sorts dispatches by window start ascending', async () => {
    mockUserGetAll.mockResolvedValue([
      mockUser('u1', 'Alice', 'A'),
      mockUser('u2', 'Bob', 'B'),
    ]);
    mockDispatchesGetAll.mockResolvedValue([
      mockDispatch({
        id: 'd-late',
        assignedUserId: 'u2',
        arrivalWindowStart: '2026-05-16T10:00:00Z',
        arrivalWindowEnd: '2026-05-16T12:00:00Z',
      }),
      mockDispatch({
        id: 'd-early',
        assignedUserId: 'u1',
        arrivalWindowStart: '2026-05-15T08:00:00Z',
        arrivalWindowEnd: '2026-05-15T10:00:00Z',
      }),
    ]);

    renderWithProviders(
      <DispatchesSection workOrderId="wo-1" onAssign={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText('Alice A')).toBeInTheDocument();
    });
    const rows = screen.getAllByRole('row');
    // Header is row[0]; first data row should be the earlier-scheduled one.
    expect(rows[1]).toHaveTextContent('Alice A');
    expect(rows[2]).toHaveTextContent('Bob B');
  });
});
