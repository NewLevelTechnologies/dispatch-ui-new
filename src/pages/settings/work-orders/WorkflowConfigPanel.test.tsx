import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, userEvent } from '../../../test/utils';
import WorkflowConfigPanel from './WorkflowConfigPanel';
import apiClient from '../../../api/client';
import type { WorkflowConfig } from '../../../api';

vi.mock('../../../api/client');

const mockTypes = [
  { id: 'type-1', tenantId: 't', name: 'Service Call', code: 'SERVICE_CALL', isActive: true, sortOrder: 0, createdAt: '', updatedAt: '' },
  { id: 'type-2', tenantId: 't', name: 'Installation', code: 'INSTALLATION', isActive: true, sortOrder: 1, createdAt: '', updatedAt: '' },
];

const mockStatuses = [
  { id: 'st-1', tenantId: 't', name: 'New', code: 'NEW', statusCategory: 'NOT_STARTED' as const, isTerminal: false, isActive: true, sortOrder: 0, createdAt: '', updatedAt: '' },
  { id: 'st-2', tenantId: 't', name: 'In Progress', code: 'IN_PROGRESS', statusCategory: 'IN_PROGRESS' as const, isTerminal: false, isActive: true, sortOrder: 1, createdAt: '', updatedAt: '' },
];

const mockConfig: WorkflowConfig = {
  id: 'cfg-1',
  tenantId: 't',
  enforceStatusWorkflow: false,
  defaultWorkOrderTypeId: 'type-1',
  defaultWorkItemStatusId: 'st-1',
  dispatchBoardType: 'STATUS_BASED',
  createdAt: '',
  updatedAt: '',
};

function mockApis(config: WorkflowConfig = mockConfig) {
  vi.mocked(apiClient.get).mockImplementation((url: string) => {
    if (url.endsWith('/workflow')) return Promise.resolve({ data: config });
    if (url.endsWith('/types')) return Promise.resolve({ data: mockTypes });
    if (url.endsWith('/item-statuses')) return Promise.resolve({ data: mockStatuses });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

describe('WorkflowConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form with values selected from the loaded config', async () => {
    mockApis();
    const { container } = renderWithProviders(<WorkflowConfigPanel />);

    await waitFor(() => {
      const typeSelect = container.querySelector('select[name="defaultWorkOrderTypeId"]') as HTMLSelectElement;
      expect(typeSelect.value).toBe('type-1');
    });
    expect((container.querySelector('select[name="defaultWorkItemStatusId"]') as HTMLSelectElement).value).toBe('st-1');
    expect((container.querySelector('select[name="dispatchBoardType"]') as HTMLSelectElement).value).toBe('STATUS_BASED');
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false');
  });

  it('shows "None" option when no defaults are set', async () => {
    mockApis({ ...mockConfig, defaultWorkOrderTypeId: null, defaultWorkItemStatusId: null });
    renderWithProviders(<WorkflowConfigPanel />);

    await waitFor(() => {
      // "None" is the empty-value option text in the dropdowns.
      expect(screen.getAllByText('None').length).toBeGreaterThan(0);
    });
  });

  it('exposes all form fields without a view/edit toggle', async () => {
    mockApis();
    const { container } = renderWithProviders(<WorkflowConfigPanel />);

    await waitFor(() =>
      expect(container.querySelector('select[name="defaultWorkOrderTypeId"]')).toBeInTheDocument(),
    );

    expect(container.querySelector('select[name="defaultWorkItemStatusId"]')).toBeInTheDocument();
    expect(container.querySelector('select[name="dispatchBoardType"]')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    // No "Edit" affordance — the form is always editable in place.
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
  });

  it('submits the update with modified fields when Save changes is clicked', async () => {
    const user = userEvent.setup();
    mockApis();
    vi.mocked(apiClient.patch).mockResolvedValue({ data: mockConfig });

    const { container } = renderWithProviders(<WorkflowConfigPanel />);

    await waitFor(() =>
      expect(container.querySelector('select[name="defaultWorkOrderTypeId"]')).toBeInTheDocument(),
    );

    await user.selectOptions(
      container.querySelector('select[name="defaultWorkOrderTypeId"]') as HTMLSelectElement,
      'type-2',
    );
    // Catalyst Checkbox renders Headless's button with role="checkbox" — not a native input.
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/work-orders/config/workflow',
        expect.objectContaining({
          defaultWorkOrderTypeId: 'type-2',
          enforceStatusWorkflow: true,
        })
      );
    });
  });

  it('cancel reverts unsaved edits back to the loaded values without submitting', async () => {
    const user = userEvent.setup();
    mockApis();
    const { container } = renderWithProviders(<WorkflowConfigPanel />);

    await waitFor(() =>
      expect(container.querySelector('select[name="defaultWorkOrderTypeId"]')).toBeInTheDocument(),
    );

    const typeSelect = container.querySelector('select[name="defaultWorkOrderTypeId"]') as HTMLSelectElement;
    await user.selectOptions(typeSelect, 'type-2');
    expect(typeSelect.value).toBe('type-2');

    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    // After cancel the form snaps back to the loaded config value.
    expect(typeSelect.value).toBe('type-1');
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it('surfaces API error message when load fails', async () => {
    const error = Object.assign(new Error('fail'), {
      response: { data: { message: 'Workflow config not initialized' } },
    });
    vi.mocked(apiClient.get).mockRejectedValue(error);

    renderWithProviders(<WorkflowConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText('Workflow config not initialized')).toBeInTheDocument();
    });
  });
});
