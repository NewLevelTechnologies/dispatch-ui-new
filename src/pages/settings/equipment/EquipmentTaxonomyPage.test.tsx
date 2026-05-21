import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders, userEvent } from '../../../test/utils';
import EquipmentTaxonomyPage from './EquipmentTaxonomyPage';

const mockTypesGetAll = vi.fn();
const mockTypesCreate = vi.fn();
const mockTypesUpdate = vi.fn();
const mockTypesDelete = vi.fn();
const mockTypesReorder = vi.fn();
const mockCatsGetAll = vi.fn();
const mockCatsCreate = vi.fn();
const mockCatsUpdate = vi.fn();
const mockCatsDelete = vi.fn();
const mockCatsReorder = vi.fn();

vi.mock('../../../api/equipmentApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/equipmentApi')>();
  return {
    ...actual,
    equipmentTypesApi: {
      getAll: (...args: unknown[]) => mockTypesGetAll(...args),
      create: (...args: unknown[]) => mockTypesCreate(...args),
      update: (...args: unknown[]) => mockTypesUpdate(...args),
      delete: (...args: unknown[]) => mockTypesDelete(...args),
      reorder: (...args: unknown[]) => mockTypesReorder(...args),
    },
    equipmentCategoriesApi: {
      getAll: (...args: unknown[]) => mockCatsGetAll(...args),
      create: (...args: unknown[]) => mockCatsCreate(...args),
      update: (...args: unknown[]) => mockCatsUpdate(...args),
      delete: (...args: unknown[]) => mockCatsDelete(...args),
      reorder: (...args: unknown[]) => mockCatsReorder(...args),
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

const baseType = (id: string, name: string, sortOrder = 0) => ({
  id,
  tenantId: 't',
  name,
  sortOrder,
  archivedAt: null,
  createdAt: '',
  updatedAt: '',
});

const baseCategory = (id: string, name: string, typeId: string, sortOrder = 0) => ({
  id,
  tenantId: 't',
  equipmentTypeId: typeId,
  name,
  sortOrder,
  archivedAt: null,
  createdAt: '',
  updatedAt: '',
});

describe('EquipmentTaxonomyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header with title and Add type CTA', async () => {
    mockTypesGetAll.mockResolvedValue([]);
    mockCatsGetAll.mockResolvedValue([]);
    renderWithProviders(<EquipmentTaxonomyPage />);

    await waitFor(() =>
      expect(screen.getByText(/types & categories/i)).toBeInTheDocument()
    );
    // The "Add type" button in the PageHead (the empty state also shows one).
    expect(screen.getAllByRole('button', { name: /add type/i }).length).toBeGreaterThan(0);
  });

  it('shows the empty state when there are no types', async () => {
    mockTypesGetAll.mockResolvedValue([]);
    mockCatsGetAll.mockResolvedValue([]);
    renderWithProviders(<EquipmentTaxonomyPage />);

    await waitFor(() =>
      expect(screen.getByText(/no equipment types yet/i)).toBeInTheDocument()
    );
  });

  it('renders types with their category counts in collapsed preview', async () => {
    mockTypesGetAll.mockResolvedValue([
      baseType('t1', 'HVAC', 0),
      baseType('t2', 'Refrigeration', 1),
    ]);
    mockCatsGetAll.mockResolvedValue([
      baseCategory('c1', 'Furnace', 't1', 0),
      baseCategory('c2', 'Heat Pump', 't1', 1),
      baseCategory('c3', 'Walk-in', 't2', 0),
    ]);
    renderWithProviders(<EquipmentTaxonomyPage />);

    await waitFor(() => expect(screen.getByText('HVAC')).toBeInTheDocument());
    expect(screen.getByText('Refrigeration')).toBeInTheDocument();
    // Collapsed preview shows category names joined by " · "
    expect(screen.getByText(/Furnace · Heat Pump/)).toBeInTheDocument();
    expect(screen.getByText(/Walk-in/)).toBeInTheDocument();
  });

  it('expands a type when its header is clicked, revealing categories', async () => {
    mockTypesGetAll.mockResolvedValue([baseType('t1', 'HVAC')]);
    mockCatsGetAll.mockResolvedValue([
      baseCategory('c1', 'Furnace', 't1', 0),
      baseCategory('c2', 'Heat Pump', 't1', 1),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<EquipmentTaxonomyPage />);

    await waitFor(() => expect(screen.getByText('HVAC')).toBeInTheDocument());
    await user.click(screen.getByText('HVAC'));

    // The inline "Add category to HVAC" affordance shows when expanded.
    expect(await screen.findByRole('button', { name: /add category to hvac/i })).toBeInTheDocument();
  });

  it('filters by search and auto-expands matching types', async () => {
    mockTypesGetAll.mockResolvedValue([
      baseType('t1', 'HVAC', 0),
      baseType('t2', 'Refrigeration', 1),
    ]);
    mockCatsGetAll.mockResolvedValue([
      baseCategory('c1', 'Furnace', 't1', 0),
      baseCategory('c2', 'Heat Pump', 't1', 1),
      baseCategory('c3', 'Walk-in', 't2', 0),
    ]);
    const user = userEvent.setup();
    renderWithProviders(<EquipmentTaxonomyPage />);

    await waitFor(() => expect(screen.getByText('HVAC')).toBeInTheDocument());

    await user.type(
      screen.getByPlaceholderText(/search types & categories/i),
      'furn'
    );

    // HVAC stays (its category matches); Refrigeration filters out.
    await waitFor(() => {
      expect(screen.getByText('HVAC')).toBeInTheDocument();
      expect(screen.queryByText('Refrigeration')).not.toBeInTheDocument();
    });

    // The expanded panel shows the matching category and its Add affordance,
    // confirming HVAC auto-expanded.
    expect(await screen.findByRole('button', { name: /add category to hvac/i })).toBeInTheDocument();
  });

  it('opens the Add type dialog and creates a new type', async () => {
    mockTypesGetAll.mockResolvedValue([baseType('t1', 'HVAC')]);
    mockCatsGetAll.mockResolvedValue([]);
    mockTypesCreate.mockResolvedValue(baseType('new', 'Plumbing'));
    const user = userEvent.setup();
    renderWithProviders(<EquipmentTaxonomyPage />);

    await waitFor(() => expect(screen.getByText('HVAC')).toBeInTheDocument());

    const addButtons = screen.getAllByRole('button', { name: /add type/i });
    await user.click(addButtons[0]);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    const nameInput = await screen.findByLabelText(/name/i);
    await user.type(nameInput, 'Plumbing');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(mockTypesCreate).toHaveBeenCalledWith({ name: 'Plumbing', sortOrder: 1 });
    });
  });

  it('opens delete confirm and calls delete on the type', async () => {
    mockTypesGetAll.mockResolvedValue([baseType('t1', 'HVAC')]);
    mockCatsGetAll.mockResolvedValue([baseCategory('c1', 'Furnace', 't1', 0)]);
    mockTypesDelete.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<EquipmentTaxonomyPage />);

    await waitFor(() => expect(screen.getByText('HVAC')).toBeInTheDocument());

    // Kebab on the type row → Delete.
    const kebabs = screen.getAllByRole('button', { name: /more options/i });
    await user.click(kebabs[0]);
    const deleteItem = await screen.findByRole('menuitem', { name: /delete/i });
    await user.click(deleteItem);

    // Confirm dialog shows the category count message.
    expect(await screen.findByText(/1 category will be deleted/i)).toBeInTheDocument();

    // Click the destructive Delete in the alert.
    const confirmButtons = screen.getAllByRole('button', { name: /^delete$/i });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(mockTypesDelete).toHaveBeenCalledWith('t1'));
  });

  it('reorders types via drag-and-drop', async () => {
    mockTypesGetAll.mockResolvedValue([
      baseType('t1', 'HVAC', 0),
      baseType('t2', 'Refrigeration', 1),
    ]);
    mockCatsGetAll.mockResolvedValue([]);
    mockTypesReorder.mockResolvedValue([]);
    renderWithProviders(<EquipmentTaxonomyPage />);

    await waitFor(() => expect(screen.getByText('HVAC')).toBeInTheDocument());

    // The draggable Card surrounds each TaxonomyBlock — find by walking up
    // from the type name to the [draggable] ancestor.
    const hvacName = screen.getByText('HVAC');
    const refrigName = screen.getByText('Refrigeration');
    const hvacCard = hvacName.closest('[draggable="true"]') as HTMLElement;
    const refrigCard = refrigName.closest('[draggable="true"]') as HTMLElement;

    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      setData: vi.fn(),
      getData: vi.fn(),
      types: [],
      files: [],
      items: [],
    };

    fireEvent.dragStart(refrigCard, { dataTransfer });
    fireEvent.dragOver(hvacCard, { dataTransfer });
    fireEvent.drop(hvacCard, { dataTransfer });

    await waitFor(() => {
      expect(mockTypesReorder).toHaveBeenCalledWith(['t2', 't1']);
    });
  });

  it('exposes Move up / Move down items on the type kebab and calls reorder', async () => {
    mockTypesGetAll.mockResolvedValue([
      baseType('t1', 'HVAC', 0),
      baseType('t2', 'Refrigeration', 1),
      baseType('t3', 'Plumbing', 2),
    ]);
    mockCatsGetAll.mockResolvedValue([]);
    mockTypesReorder.mockResolvedValue([]);
    const user = userEvent.setup();
    renderWithProviders(<EquipmentTaxonomyPage />);

    await waitFor(() => expect(screen.getByText('Refrigeration')).toBeInTheDocument());

    // Kebab on the middle row (Refrigeration). The first kebab is the type
    // row's; rows render in order, so kebab index 1 = Refrigeration.
    const kebabs = screen.getAllByRole('button', { name: /more options/i });
    await user.click(kebabs[1]);

    const moveUp = await screen.findByRole('menuitem', { name: /move up/i });
    expect(moveUp).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(moveUp);

    await waitFor(() =>
      expect(mockTypesReorder).toHaveBeenCalledWith(['t2', 't1', 't3'])
    );
  });

  it('disables Move up on the first type and Move down on the last', async () => {
    mockTypesGetAll.mockResolvedValue([
      baseType('t1', 'HVAC', 0),
      baseType('t2', 'Refrigeration', 1),
    ]);
    mockCatsGetAll.mockResolvedValue([]);
    const user = userEvent.setup();
    renderWithProviders(<EquipmentTaxonomyPage />);

    await waitFor(() => expect(screen.getByText('HVAC')).toBeInTheDocument());

    const kebabs = screen.getAllByRole('button', { name: /more options/i });
    await user.click(kebabs[0]);

    const moveUp = await screen.findByRole('menuitem', { name: /move up/i });
    expect(moveUp).toHaveAttribute('aria-disabled', 'true');
    const moveDown = screen.getByRole('menuitem', { name: /move down/i });
    expect(moveDown).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('opens the Add category dialog from inside an expanded type', async () => {
    mockTypesGetAll.mockResolvedValue([baseType('t1', 'HVAC')]);
    mockCatsGetAll.mockResolvedValue([baseCategory('c1', 'Furnace', 't1', 0)]);
    mockCatsCreate.mockResolvedValue(baseCategory('c2', 'Heat Pump', 't1', 1));
    const user = userEvent.setup();
    renderWithProviders(<EquipmentTaxonomyPage />);

    await waitFor(() => expect(screen.getByText('HVAC')).toBeInTheDocument());
    await user.click(screen.getByText('HVAC'));

    const addCat = await screen.findByRole('button', { name: /add category to hvac/i });
    await user.click(addCat);

    const nameInput = await screen.findByLabelText(/name/i);
    await user.type(nameInput, 'Heat Pump');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(mockCatsCreate).toHaveBeenCalledWith({
        equipmentTypeId: 't1',
        name: 'Heat Pump',
        sortOrder: 1,
      });
    });
  });
});
