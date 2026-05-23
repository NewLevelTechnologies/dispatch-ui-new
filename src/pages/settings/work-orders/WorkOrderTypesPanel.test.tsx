import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/utils';
import WorkOrderTypesPanel from './WorkOrderTypesPanel';
import apiClient from '../../../api/client';

vi.mock('../../../api/client');

const EMPTY_ENVELOPE = { types: [], colorsInUse: {} };

describe('WorkOrderTypesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: EMPTY_ENVELOPE });
  });

  it('renders the Work Order Types title', async () => {
    renderWithProviders(<WorkOrderTypesPanel />);
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /work order types/i })
      ).toBeInTheDocument();
    });
  });

  it('hits the work-order-types endpoint via the underlying api', async () => {
    renderWithProviders(<WorkOrderTypesPanel />);
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/work-orders/config/types');
    });
  });

  it('renders the empty state when there are no types', async () => {
    renderWithProviders(<WorkOrderTypesPanel />);
    await waitFor(() => {
      expect(screen.getByText(/no work order types yet/i)).toBeInTheDocument();
    });
  });

  it('renders rows with swatch + code when types exist', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        types: [
          {
            id: 't1',
            tenantId: 'tn',
            name: 'Service Call',
            code: 'SERVICE_CALL',
            accentId: 'blue',
            isActive: true,
            sortOrder: 0,
            createdAt: '',
            updatedAt: '',
          },
        ],
        colorsInUse: { blue: { typeId: 't1', typeName: 'Service Call' } },
      },
    });
    renderWithProviders(<WorkOrderTypesPanel />);
    await waitFor(() => {
      expect(screen.getByText('Service Call')).toBeInTheDocument();
      expect(screen.getByText('SERVICE_CALL')).toBeInTheDocument();
    });
  });
});
