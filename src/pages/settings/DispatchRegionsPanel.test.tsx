import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { renderWithProviders, userEvent } from '../../test/utils';
import DispatchRegionsPanel from './DispatchRegionsPanel';
import apiClient from '../../api/client';

vi.mock('../../api/client');

const mockRegions = [
  {
    id: 'r-1',
    name: 'Georgia',
    abbreviation: 'GA',
    description: undefined,
    state: 'GA',
    tabDisplayName: undefined,
    sortOrder: 0,
    isActive: true,
    createdAt: '',
    updatedAt: '',
    version: 0,
  },
  {
    id: 'r-2',
    name: 'South Carolina',
    abbreviation: 'SC',
    description: undefined,
    state: 'SC',
    tabDisplayName: undefined,
    sortOrder: 1,
    isActive: true,
    createdAt: '',
    updatedAt: '',
    version: 0,
  },
  {
    id: 'r-3',
    name: 'Old Florida',
    abbreviation: 'FL',
    description: undefined,
    state: 'FL',
    tabDisplayName: undefined,
    sortOrder: 2,
    isActive: false,
    createdAt: '',
    updatedAt: '',
    version: 0,
  },
];

describe('DispatchRegionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockRegions });
  });

  it('renders regions with active dot and inactive Pill', async () => {
    renderWithProviders(<DispatchRegionsPanel />);

    await waitFor(() => expect(screen.getByText('Georgia')).toBeInTheDocument());
    expect(screen.getByText('South Carolina')).toBeInTheDocument();
    expect(screen.getByText('Old Florida')).toBeInTheDocument();
    // Two active rows, one inactive row.
    expect(screen.getAllByText('Active').length).toBe(2);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('only active rows are draggable (inactive rows have no drag handle)', async () => {
    renderWithProviders(<DispatchRegionsPanel />);

    await waitFor(() => expect(screen.getByText('Old Florida')).toBeInTheDocument());

    const inactiveRow = screen.getByText('Old Florida').closest('tr')!;
    expect(within(inactiveRow).queryByRole('img', { name: /drag to reorder/i })).not.toBeInTheDocument();
    expect(inactiveRow).not.toHaveAttribute('draggable', 'true');

    const activeRow = screen.getByText('Georgia').closest('tr')!;
    expect(within(activeRow).getByRole('img', { name: /drag to reorder/i })).toBeInTheDocument();
  });

  it('reorders only active regions via drag-and-drop', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockRegions });

    renderWithProviders(<DispatchRegionsPanel />);

    await waitFor(() => expect(screen.getByText('South Carolina')).toBeInTheDocument());

    // Drag South Carolina (active index 1) onto Georgia (active index 0) → [r-2, r-1].
    // Inactive r-3 must not be in the payload.
    const gaRow = screen.getByText('Georgia').closest('tr')!;
    const scRow = screen.getByText('South Carolina').closest('tr')!;

    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      setData: vi.fn(),
      getData: vi.fn(),
      types: [],
      files: [],
      items: [],
    };

    fireEvent.dragStart(scRow, { dataTransfer });
    fireEvent.dragOver(gaRow, { dataTransfer });
    fireEvent.drop(gaRow, { dataTransfer });

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/tenant/dispatch-regions/reorder',
        { orderedIds: ['r-2', 'r-1'] }
      );
    });
  });

  it('opens add dialog when Add is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DispatchRegionsPanel />);

    await waitFor(() => expect(screen.getByText('Georgia')).toBeInTheDocument());

    const addButton = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase().includes('add') && b.textContent?.toLowerCase().includes('region')
    );
    expect(addButton).toBeDefined();
    await user.click(addButton!);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('deactivates an active region after confirmation', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.delete).mockResolvedValue({ data: undefined });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderWithProviders(<DispatchRegionsPanel />);

    await waitFor(() => expect(screen.getByText('Georgia')).toBeInTheDocument());

    const row = screen.getByText('Georgia').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /more options/i }));
    await user.click(await screen.findByRole('menuitem', { name: /deactivate/i }));

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith('/tenant/dispatch-regions/r-1');
    });
    confirmSpy.mockRestore();
  });

  it('reactivates an inactive region', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockRegions[2] });

    renderWithProviders(<DispatchRegionsPanel />);

    await waitFor(() => expect(screen.getByText('Old Florida')).toBeInTheDocument());

    const row = screen.getByText('Old Florida').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /more options/i }));
    await user.click(await screen.findByRole('menuitem', { name: /reactivate/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/tenant/dispatch-regions/r-3/reactivate');
    });
  });

  it('opens edit dialog populated with region data', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DispatchRegionsPanel />);

    await waitFor(() => expect(screen.getByText('Georgia')).toBeInTheDocument());

    const row = screen.getByText('Georgia').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /more options/i }));
    await user.click(await screen.findByRole('menuitem', { name: /^edit$/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/name/i)).toHaveValue('Georgia');
    expect(within(dialog).getByLabelText(/abbreviation/i)).toHaveValue('GA');
  });

  it('does not deactivate if confirmation cancelled', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderWithProviders(<DispatchRegionsPanel />);

    await waitFor(() => expect(screen.getByText('Georgia')).toBeInTheDocument());

    const row = screen.getByText('Georgia').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: /more options/i }));
    await user.click(await screen.findByRole('menuitem', { name: /deactivate/i }));

    expect(apiClient.delete).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('reorder mutation is keyed by active sort position', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockRegions });

    renderWithProviders(<DispatchRegionsPanel />);

    await waitFor(() => expect(screen.getByText('Georgia')).toBeInTheDocument());

    // Drag Georgia onto South Carolina — same net swap, different starting side.
    const gaRow = screen.getByText('Georgia').closest('tr')!;
    const scRow = screen.getByText('South Carolina').closest('tr')!;

    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      setData: vi.fn(),
      getData: vi.fn(),
      types: [],
      files: [],
      items: [],
    };

    fireEvent.dragStart(gaRow, { dataTransfer });
    fireEvent.dragOver(scRow, { dataTransfer });
    fireEvent.drop(scRow, { dataTransfer });

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/tenant/dispatch-regions/reorder',
        { orderedIds: ['r-2', 'r-1'] }
      );
    });
  });

  it('surfaces API error message on load failure', async () => {
    const error = Object.assign(new Error('fail'), {
      response: { data: { message: 'Region service down' } },
    });
    vi.mocked(apiClient.get).mockRejectedValue(error);

    renderWithProviders(<DispatchRegionsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Region service down')).toBeInTheDocument();
    });
  });
});
