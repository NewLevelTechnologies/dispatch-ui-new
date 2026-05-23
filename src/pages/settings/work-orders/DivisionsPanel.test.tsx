import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/utils';
import DivisionsPanel from './DivisionsPanel';
import apiClient from '../../../api/client';

vi.mock('../../../api/client');

describe('DivisionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
  });

  it('renders the Divisions title', async () => {
    renderWithProviders(<DivisionsPanel />);
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /divisions/i })
      ).toBeInTheDocument();
    });
  });

  it('hits the divisions endpoint via the underlying api', async () => {
    renderWithProviders(<DivisionsPanel />);
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/work-orders/config/divisions'
      );
    });
  });

  it('renders the empty state when there are no divisions', async () => {
    renderWithProviders(<DivisionsPanel />);
    await waitFor(() => {
      expect(screen.getByText(/no divisions yet/i)).toBeInTheDocument();
    });
  });

  it('renders rows with name + code when divisions exist', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [
        {
          id: 'd1',
          tenantId: 'tn',
          name: 'HVAC',
          code: 'HVAC_CODE',
          isActive: true,
          sortOrder: 0,
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
    renderWithProviders(<DivisionsPanel />);
    await waitFor(() => {
      expect(screen.getByText('HVAC')).toBeInTheDocument();
      expect(screen.getByText('HVAC_CODE')).toBeInTheDocument();
    });
  });
});
