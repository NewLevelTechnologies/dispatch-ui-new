import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders, userEvent } from '../../../test/utils';
import EquipmentCategoriesPanel from './EquipmentCategoriesPanel';

const mockTypesGetAll = vi.fn();
const mockGetAll = vi.fn();
const mockCreate = vi.fn();
const mockReorder = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../../api/equipmentApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/equipmentApi')>();
  return {
    ...actual,
    equipmentTypesApi: {
      getAll: (...args: unknown[]) => mockTypesGetAll(...args),
    },
    equipmentCategoriesApi: {
      getAll: (...args: unknown[]) => mockGetAll(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: vi.fn(),
      delete: (...args: unknown[]) => mockDelete(...args),
      reorder: (...args: unknown[]) => mockReorder(...args),
    },
  };
});

vi.mock('../../../hooks/useCurrentUser', () => ({
  useHasCapability: () => true,
}));

vi.mock('../../../api/client');

const sampleTypes = [
  { id: 't-hvac', tenantId: 't', name: 'HVAC', sortOrder: 0, archivedAt: null, createdAt: '', updatedAt: '' },
];

describe('EquipmentCategoriesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows guidance when no types exist', async () => {
    mockTypesGetAll.mockResolvedValue([]);
    renderWithProviders(<EquipmentCategoriesPanel />);

    await waitFor(() => {
      expect(
        screen.getByText(/add at least one equipment type before creating categories/i)
      ).toBeInTheDocument();
    });
  });

  it('lists categories for the selected type', async () => {
    mockTypesGetAll.mockResolvedValue(sampleTypes);
    mockGetAll.mockResolvedValue([
      { id: 'c1', tenantId: 't', equipmentTypeId: 't-hvac', name: 'Furnace', sortOrder: 0, archivedAt: null, createdAt: '', updatedAt: '' },
      { id: 'c2', tenantId: 't', equipmentTypeId: 't-hvac', name: 'Condenser', sortOrder: 1, archivedAt: null, createdAt: '', updatedAt: '' },
    ]);
    renderWithProviders(<EquipmentCategoriesPanel />);

    await waitFor(() => {
      expect(screen.getByText('Furnace')).toBeInTheDocument();
      expect(screen.getByText('Condenser')).toBeInTheDocument();
    });
  });

  it('creates a new category against the active type', async () => {
    mockTypesGetAll.mockResolvedValue(sampleTypes);
    mockGetAll.mockResolvedValue([]);
    mockCreate.mockResolvedValue({ id: 'new', name: 'Air Handler' });
    const user = userEvent.setup();
    renderWithProviders(<EquipmentCategoriesPanel />);

    await waitFor(() => expect(screen.getByText(/no categories yet/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /add category/i }));

    const nameInput = await screen.findByLabelText(/^name/i);
    await user.type(nameInput, 'Air Handler');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        equipmentTypeId: 't-hvac',
        name: 'Air Handler',
        sortOrder: 0,
      });
    });
  });

  it('reorders categories via drag-and-drop, posting the new id order', async () => {
    mockTypesGetAll.mockResolvedValue(sampleTypes);
    mockGetAll.mockResolvedValue([
      { id: 'c1', tenantId: 't', equipmentTypeId: 't-hvac', name: 'Furnace', sortOrder: 0, archivedAt: null, createdAt: '', updatedAt: '' },
      { id: 'c2', tenantId: 't', equipmentTypeId: 't-hvac', name: 'Condenser', sortOrder: 1, archivedAt: null, createdAt: '', updatedAt: '' },
    ]);
    mockReorder.mockResolvedValue([]);
    renderWithProviders(<EquipmentCategoriesPanel />);

    await waitFor(() => expect(screen.getByText('Furnace')).toBeInTheDocument());

    const furnaceRow = screen.getByText('Furnace').closest('tr')!;
    const condenserRow = screen.getByText('Condenser').closest('tr')!;

    const dataTransfer = {
      effectAllowed: 'move',
      dropEffect: 'move',
      setData: vi.fn(),
      getData: vi.fn(),
      types: [],
      files: [],
      items: [],
    };

    fireEvent.dragStart(condenserRow, { dataTransfer });
    fireEvent.dragOver(furnaceRow, { dataTransfer });
    fireEvent.drop(furnaceRow, { dataTransfer });

    await waitFor(() => {
      expect(mockReorder).toHaveBeenCalledWith('t-hvac', ['c2', 'c1']);
    });
  });

  it('deletes a category after confirmation', async () => {
    mockTypesGetAll.mockResolvedValue(sampleTypes);
    mockGetAll.mockResolvedValue([
      { id: 'c1', tenantId: 't', equipmentTypeId: 't-hvac', name: 'Furnace', sortOrder: 0, archivedAt: null, createdAt: '', updatedAt: '' },
    ]);
    mockDelete.mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderWithProviders(<EquipmentCategoriesPanel />);

    await waitFor(() => expect(screen.getByText('Furnace')).toBeInTheDocument());
    const moreButtons = screen.getAllByRole('button', { name: /more options/i });
    await user.click(moreButtons[0]);
    const deleteItem = await screen.findByRole('menuitem', { name: /delete/i });
    await user.click(deleteItem);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('c1');
    });
    confirmSpy.mockRestore();
  });

  it('cancel closes the dialog', async () => {
    mockTypesGetAll.mockResolvedValue(sampleTypes);
    mockGetAll.mockResolvedValue([]);
    const user = userEvent.setup();
    renderWithProviders(<EquipmentCategoriesPanel />);

    await waitFor(() => expect(screen.getByText(/no categories yet/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /add category/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
