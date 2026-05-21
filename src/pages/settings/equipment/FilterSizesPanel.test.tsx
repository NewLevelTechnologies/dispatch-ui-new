import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders, userEvent } from '../../../test/utils';
import FilterSizesPanel from './FilterSizesPanel';

const mockGetAll = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockReorder = vi.fn();
const mockSeedCommon = vi.fn();

vi.mock('../../../api/equipmentApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/equipmentApi')>();
  return {
    ...actual,
    tenantFilterSizesApi: {
      getAll: (...args: unknown[]) => mockGetAll(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
      reorder: (...args: unknown[]) => mockReorder(...args),
      seedCommon: (...args: unknown[]) => mockSeedCommon(...args),
    },
  };
});

vi.mock('../../../api/client');

vi.mock('../../../lib/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/toast')>();
  return {
    ...actual,
    showSuccess: vi.fn(),
    showError: vi.fn(),
  };
});

const size = (id: string, l: number, w: number, t: number, sortOrder = 0) => ({
  id,
  tenantId: 't',
  lengthIn: l,
  widthIn: w,
  thicknessIn: t,
  sortOrder,
  archivedAt: null,
  createdAt: '',
});

describe('FilterSizesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders configured sizes formatted as L × W × T', async () => {
    mockGetAll.mockResolvedValue([size('s1', 16, 20, 1, 0), size('s2', 20, 25, 1, 1)]);
    renderWithProviders(<FilterSizesPanel />);

    await waitFor(() => {
      expect(screen.getByText('16×20×1')).toBeInTheDocument();
      expect(screen.getByText('20×25×1')).toBeInTheDocument();
    });
  });

  it('shows the empty state with Add + Seed common when there are no sizes', async () => {
    mockGetAll.mockResolvedValue([]);
    renderWithProviders(<FilterSizesPanel />);

    await waitFor(() =>
      expect(screen.getByText(/no filter sizes yet/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /add size/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /seed common sizes/i }),
    ).toBeInTheDocument();
  });

  it('inline-adds a new size by parsing L×W×T input', async () => {
    mockGetAll.mockResolvedValue([size('s1', 16, 20, 1, 0)]);
    mockCreate.mockResolvedValue(size('new', 14, 20, 1, 1));
    const user = userEvent.setup();
    renderWithProviders(<FilterSizesPanel />);

    await waitFor(() => expect(screen.getByText('16×20×1')).toBeInTheDocument());

    // Click the dashed "+ Add size" affordance at the bottom of the table.
    await user.click(screen.getByRole('button', { name: /add size/i }));

    const input = await screen.findByPlaceholderText(/16×20×1/i);
    await user.type(input, '14x20x1{Enter}');

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        lengthIn: 14,
        widthIn: 20,
        thicknessIn: 1,
        sortOrder: 1,
      });
    });
  });

  it('rejects malformed inline-add input', async () => {
    mockGetAll.mockResolvedValue([size('s1', 16, 20, 1, 0)]);
    const user = userEvent.setup();
    renderWithProviders(<FilterSizesPanel />);

    await waitFor(() => expect(screen.getByText('16×20×1')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /add size/i }));

    const input = await screen.findByPlaceholderText(/16×20×1/i);
    await user.type(input, 'not-a-size{Enter}');

    expect(
      await screen.findByText(/use the form 16×20×1/i),
    ).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects duplicate inline-add (case-insensitive on the same dimensions)', async () => {
    mockGetAll.mockResolvedValue([size('s1', 16, 20, 1, 0)]);
    const user = userEvent.setup();
    renderWithProviders(<FilterSizesPanel />);

    await waitFor(() => expect(screen.getByText('16×20×1')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /add size/i }));

    const input = await screen.findByPlaceholderText(/16×20×1/i);
    await user.type(input, '16X20X1{Enter}');

    expect(
      await screen.findByText(/already in your list/i),
    ).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('opens the edit dialog from the kebab Rename action', async () => {
    mockGetAll.mockResolvedValue([size('s1', 16, 20, 1, 0)]);
    mockUpdate.mockResolvedValue(size('s1', 18, 20, 1, 0));
    const user = userEvent.setup();
    renderWithProviders(<FilterSizesPanel />);

    await waitFor(() => expect(screen.getByText('16×20×1')).toBeInTheDocument());
    const moreButtons = screen.getAllByRole('button', { name: /more options/i });
    // First kebab in the table row (header's kebab is also there for Seed common).
    await user.click(moreButtons[1]);

    const renameItem = await screen.findByRole('menuitem', { name: /rename/i });
    await user.click(renameItem);

    const length = await screen.findByLabelText(/length/i);
    await user.clear(length);
    await user.type(length, '18');
    await user.click(screen.getByRole('button', { name: /^update$/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('s1', {
        lengthIn: 18,
        widthIn: 20,
        thicknessIn: 1,
      });
    });
  });

  it('deletes via ConfirmDialog after confirmation', async () => {
    mockGetAll.mockResolvedValue([size('s1', 16, 20, 1, 0)]);
    mockDelete.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<FilterSizesPanel />);

    await waitFor(() => expect(screen.getByText('16×20×1')).toBeInTheDocument());
    const moreButtons = screen.getAllByRole('button', { name: /more options/i });
    await user.click(moreButtons[1]);

    const deleteItem = await screen.findByRole('menuitem', { name: /^delete$/i });
    await user.click(deleteItem);

    // Confirm dialog appears with the size in the title.
    expect(await screen.findByText(/delete "16×20×1"/i)).toBeInTheDocument();

    // The destructive Delete button in the alert.
    const confirmButtons = screen.getAllByRole('button', { name: /^delete$/i });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('s1'));
  });

  it('reorders rows via drag-and-drop, posting the new id order', async () => {
    mockGetAll.mockResolvedValue([
      size('s1', 16, 20, 1, 0),
      size('s2', 20, 25, 1, 1),
    ]);
    mockReorder.mockResolvedValue([]);
    renderWithProviders(<FilterSizesPanel />);

    await waitFor(() => expect(screen.getByText('16×20×1')).toBeInTheDocument());

    const firstRow = screen.getByText('16×20×1').closest('tr')!;
    const secondRow = screen.getByText('20×25×1').closest('tr')!;

    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      setData: vi.fn(),
      getData: vi.fn(),
      types: [],
      files: [],
      items: [],
    };

    fireEvent.dragStart(secondRow, { dataTransfer });
    fireEvent.dragOver(firstRow, { dataTransfer });
    fireEvent.drop(firstRow, { dataTransfer });

    await waitFor(() => {
      expect(mockReorder).toHaveBeenCalledWith(['s2', 's1']);
    });
  });

  it('seeds common sizes through the header kebab + ConfirmDialog', async () => {
    mockGetAll.mockResolvedValue([size('s1', 16, 20, 1, 0)]);
    mockSeedCommon.mockResolvedValue({ added: 9, skipped: 1 });
    const user = userEvent.setup();
    renderWithProviders(<FilterSizesPanel />);

    await waitFor(() => expect(screen.getByText('16×20×1')).toBeInTheDocument());

    // Header kebab (first More options button — header is rendered before
    // any table rows).
    const moreButtons = screen.getAllByRole('button', { name: /more options/i });
    await user.click(moreButtons[0]);

    const seedItem = await screen.findByRole('menuitem', {
      name: /seed common sizes/i,
    });
    await user.click(seedItem);

    // Confirm dialog.
    expect(
      await screen.findByText(/add common filter sizes\?/i),
    ).toBeInTheDocument();
    const confirmButtons = screen.getAllByRole('button', {
      name: /seed common sizes/i,
    });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(mockSeedCommon).toHaveBeenCalled());
  });

  it('shows the seed-common CTA inside the empty state', async () => {
    mockGetAll.mockResolvedValue([]);
    mockSeedCommon.mockResolvedValue({ added: 10, skipped: 0 });
    const user = userEvent.setup();
    renderWithProviders(<FilterSizesPanel />);

    await waitFor(() =>
      expect(screen.getByText(/no filter sizes yet/i)).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole('button', { name: /seed common sizes/i }),
    );

    // Confirm dialog opens.
    expect(
      await screen.findByText(/add common filter sizes\?/i),
    ).toBeInTheDocument();
  });

  it('filters the list with the search input and shows "no matches" state', async () => {
    mockGetAll.mockResolvedValue([
      size('s1', 16, 20, 1, 0),
      size('s2', 20, 25, 1, 1),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<FilterSizesPanel />);

    await waitFor(() => expect(screen.getByText('16×20×1')).toBeInTheDocument());

    const search = screen.getByPlaceholderText(/search sizes/i);
    await user.type(search, '16');

    expect(screen.queryByText('20×25×1')).not.toBeInTheDocument();
    expect(screen.getByText('16×20×1')).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'zzz');

    expect(
      await screen.findByText(/no sizes match your search/i),
    ).toBeInTheDocument();
  });
});
