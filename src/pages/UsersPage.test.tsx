import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, userEvent } from '../test/utils';
import UsersPage from './UsersPage';
import apiClient from '../api/client';

// Mock the API client
vi.mock('../api/client');

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockRoles = [
  {
    id: 'role-1',
    name: 'Admin',
    description: 'Administrator role',
  },
  {
    id: 'role-2',
    name: 'Technician',
    description: 'Field technician role',
  },
];

const mockUsers = [
  {
    id: 'user-1',
    tenantId: 'tenant-1',
    cognitoSub: 'cognito-123',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    enabled: true,
    roles: [mockRoles[0]],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
  },
  {
    id: 'user-2',
    tenantId: 'tenant-1',
    cognitoSub: 'cognito-456',
    email: 'jane.smith@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    enabled: false,
    roles: [mockRoles[1]],
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-20T14:20:00Z',
  },
  {
    id: 'user-3',
    tenantId: 'tenant-1',
    cognitoSub: 'cognito-789',
    email: 'bob.johnson@example.com',
    firstName: 'Bob',
    lastName: 'Johnson',
    enabled: true,
    roles: [],
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-25T09:15:00Z',
  },
];

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('renders the page title and add button', () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

    renderWithProviders(<UsersPage />);

    expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add user/i })).toBeInTheDocument();
  });

  it('displays page heading', () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

    renderWithProviders(<UsersPage />);

    expect(screen.getByRole('heading', { name: /users/i })).toBeInTheDocument();
  });

  it('displays loading state while fetching users', () => {
    vi.mocked(apiClient.get).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithProviders(<UsersPage />);

    expect(screen.getByText('Loading users...')).toBeInTheDocument();
  });

  it('displays users in a table', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === '/users') {
        return Promise.resolve({ data: mockUsers });
      }
      if (url === '/users/roles') {
        return Promise.resolve({ data: mockRoles });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument();
  });

  it('displays role badges for users', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === '/users') {
        return Promise.resolve({ data: mockUsers });
      }
      if (url === '/users/roles') {
        return Promise.resolve({ data: mockRoles });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Technician')).toBeInTheDocument();
  });

  it('displays enabled/disabled status indicators', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === '/users') {
        return Promise.resolve({ data: mockUsers });
      }
      if (url === '/users/roles') {
        return Promise.resolve({ data: mockRoles });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Active rows use the success dot + "Active" text; disabled rows use "Disabled".
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0);
  });

  it('displays an em-dash for users with no roles', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === '/users') {
        return Promise.resolve({ data: [mockUsers[2]] });
      }
      if (url === '/users/roles') {
        return Promise.resolve({ data: mockRoles });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });

    const dashElements = screen.getAllByText('—');
    expect(dashElements.length).toBeGreaterThan(0);
  });

  it('formats dates correctly', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === '/users') {
        return Promise.resolve({ data: mockUsers });
      }
      if (url === '/users/roles') {
        return Promise.resolve({ data: mockRoles });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument();
      expect(screen.getByText('Jan 20, 2024')).toBeInTheDocument();
    });
  });

  it('displays error message when fetch fails', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText(/error loading users/i)).toBeInTheDocument();
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it('displays empty state when no users exist', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /add your first user/i })).toBeInTheDocument();
  });

  it('navigates to detail page when row is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === '/users') {
        return Promise.resolve({ data: mockUsers });
      }
      if (url === '/users/roles') {
        return Promise.resolve({ data: mockRoles });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const nameCell = screen.getByText('John Doe');
    await user.click(nameCell);

    expect(mockNavigate).toHaveBeenCalledWith('/settings/access/users/user-1');
  });

  it('navigates to edit page when edit menu item is clicked', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === '/users') {
        return Promise.resolve({ data: mockUsers });
      }
      if (url === '/users/roles') {
        return Promise.resolve({ data: mockRoles });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
    const user = userEvent.setup();

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const dropdownButtons = screen.getAllByRole('button', { name: /more options/i });
    await user.click(dropdownButtons[0]);

    const editButton = screen.getByRole('menuitem', { name: /edit/i });
    await user.click(editButton);

    // Edit now navigates to the dedicated edit page instead of opening a dialog.
    // mockUsers[0] is the first user — assert the route uses its id.
    expect(mockNavigate).toHaveBeenCalledWith(`/settings/access/users/${mockUsers[0].id}/edit`);
  });

  it('does not navigate when dropdown is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === '/users') {
        return Promise.resolve({ data: mockUsers });
      }
      if (url === '/users/roles') {
        return Promise.resolve({ data: mockRoles });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    const { router } = renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click the dropdown button
    const dropdownButtons = screen.getAllByRole('button', { name: /more options/i });
    await user.click(dropdownButtons[0]);

    // Should not navigate
    expect(router.state.location.pathname).toBe('/');
  });

  it('opens disable confirmation for enabled users', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === '/users') {
        return Promise.resolve({ data: mockUsers });
      }
      if (url === '/users/roles') {
        return Promise.resolve({ data: mockRoles });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
    const user = userEvent.setup();

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click the dropdown button for enabled user
    const dropdownButtons = screen.getAllByRole('button', { name: /more options/i });
    await user.click(dropdownButtons[0]);

    // Click disable option in the dropdown
    const disableMenuItem = screen.getByRole('menuitem', { name: /disable/i });
    await user.click(disableMenuItem);

    // ConfirmDialog (Alert) renders with the user's name in the title
    await waitFor(() => {
      expect(screen.getByText(/disable john doe/i)).toBeInTheDocument();
    });
  });

  it('opens enable confirmation for disabled users', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === '/users') {
        return Promise.resolve({ data: mockUsers });
      }
      if (url === '/users/roles') {
        return Promise.resolve({ data: mockRoles });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
    const user = userEvent.setup();

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    // Click the dropdown button for disabled user
    const dropdownButtons = screen.getAllByRole('button', { name: /more options/i });
    await user.click(dropdownButtons[1]);

    // Click enable option in the dropdown
    const enableMenuItem = screen.getByRole('menuitem', { name: /enable/i });
    await user.click(enableMenuItem);

    await waitFor(() => {
      expect(screen.getByText(/enable jane smith/i)).toBeInTheDocument();
    });
  });

  it('calls disable mutation when confirmed', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === '/users') {
        return Promise.resolve({ data: mockUsers });
      }
      if (url === '/users/roles') {
        return Promise.resolve({ data: mockRoles });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
    vi.mocked(apiClient.post).mockResolvedValue({ data: { ...mockUsers[0], enabled: false } });
    const user = userEvent.setup();

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Open dropdown → click Disable in the menu
    const dropdownButtons = screen.getAllByRole('button', { name: /more options/i });
    await user.click(dropdownButtons[0]);
    const disableMenuItem = screen.getByRole('menuitem', { name: /disable/i });
    await user.click(disableMenuItem);

    // Confirm in the dialog
    const confirmButton = await screen.findByRole('button', { name: /^disable$/i });
    await user.click(confirmButton);

    await waitFor(() => {
      // PUT /users/{id} no longer takes an `enabled` field; activation
      // moved to a dedicated POST endpoint that also emits the matching
      // activity-feed event server-side.
      expect(apiClient.post).toHaveBeenCalledWith('/users/user-1/deactivate');
    });
  });

  it('opens delete alert when delete button is clicked', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === '/users') {
        return Promise.resolve({ data: mockUsers });
      }
      if (url === '/users/roles') {
        return Promise.resolve({ data: mockRoles });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
    const user = userEvent.setup();

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click the dropdown button
    const dropdownButtons = screen.getAllByRole('button', { name: /more options/i });
    await user.click(dropdownButtons[0]);

    // Click delete option
    const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
    await user.click(deleteButton);

    // Delete alert should open
    await waitFor(() => {
      expect(screen.getByText(/delete john doe/i)).toBeInTheDocument();
      expect(screen.getByText(/all user data and history will be permanently removed/i)).toBeInTheDocument();
    });
  });

  it('calls delete mutation when delete is confirmed', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === '/users') {
        return Promise.resolve({ data: mockUsers });
      }
      if (url === '/users/roles') {
        return Promise.resolve({ data: mockRoles });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });
    const user = userEvent.setup();

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click the dropdown button
    const dropdownButtons = screen.getAllByRole('button', { name: /more options/i });
    await user.click(dropdownButtons[0]);

    // Click delete option
    const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
    await user.click(deleteButton);

    // Confirm delete
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /^delete$/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith('/users/user-1');
    });
  });

  it('cancels delete when cancel button is clicked', async () => {
    vi.mocked(apiClient.get).mockImplementation((url) => {
      if (url === '/users') {
        return Promise.resolve({ data: mockUsers });
      }
      if (url === '/users/roles') {
        return Promise.resolve({ data: mockRoles });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
    const user = userEvent.setup();

    renderWithProviders(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click the dropdown button
    const dropdownButtons = screen.getAllByRole('button', { name: /more options/i });
    await user.click(dropdownButtons[0]);

    // Click delete option
    const deleteButton = screen.getByRole('menuitem', { name: /delete/i });
    await user.click(deleteButton);

    // Cancel delete
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  describe('Search and Filters', () => {
    it('displays search bar when users exist', async () => {
      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/users') {
          return Promise.resolve({ data: mockUsers });
        }
        if (url === '/users/roles') {
          return Promise.resolve({ data: mockRoles });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      renderWithProviders(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      expect(screen.getByPlaceholderText(/search by name, email, or role/i)).toBeInTheDocument();
    });

    it('filters users by search query', async () => {
      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/users') {
          return Promise.resolve({ data: mockUsers });
        }
        if (url === '/users/roles') {
          return Promise.resolve({ data: mockRoles });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      const user = userEvent.setup();

      renderWithProviders(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search by name, email, or role/i);
      await user.type(searchInput, 'jane');

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      });
    });

    it('displays role filter dropdown', async () => {
      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/users') {
          return Promise.resolve({ data: mockUsers });
        }
        if (url === '/users/roles') {
          return Promise.resolve({ data: mockRoles });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      renderWithProviders(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /^Role$/i })).toBeInTheDocument();
    });

    it('displays status filter dropdown', async () => {
      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/users') {
          return Promise.resolve({ data: mockUsers });
        }
        if (url === '/users/roles') {
          return Promise.resolve({ data: mockRoles });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      renderWithProviders(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /^Status$/i })).toBeInTheDocument();
    });
  });

  describe('Row navigation', () => {
    it('navigates to user detail page when user name is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/users') {
          return Promise.resolve({ data: mockUsers });
        }
        if (url === '/users/roles') {
          return Promise.resolve({ data: [] });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      renderWithProviders(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const nameCell = screen.getByText('John Doe');
      await user.click(nameCell);

      expect(mockNavigate).toHaveBeenCalledWith('/settings/access/users/user-1');
    });

    it('does not navigate when clicking dropdown button', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/users') {
          return Promise.resolve({ data: mockUsers });
        }
        if (url === '/users/roles') {
          return Promise.resolve({ data: [] });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      renderWithProviders(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const dropdownButtons = screen.queryAllByRole('button', { name: '' });
      if (dropdownButtons.length > 0) {
        await user.click(dropdownButtons[0]);
        // Should not navigate
        expect(mockNavigate).not.toHaveBeenCalled();
      }
    });
  });

  describe('Invite navigation', () => {
    it('navigates to the invite page when "Add User" is clicked', async () => {
      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/users') {
          return Promise.resolve({ data: mockUsers });
        }
        if (url === '/users/roles') {
          return Promise.resolve({ data: mockRoles });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      const user = userEvent.setup();

      renderWithProviders(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add user/i });
      await user.click(addButton);

      expect(mockNavigate).toHaveBeenCalledWith('/settings/access/users/new');
    });

    it('navigates to the invite page when "Add your first user" is clicked', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
      const user = userEvent.setup();

      renderWithProviders(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('No users found')).toBeInTheDocument();
      });

      const addFirstButton = screen.getByRole('button', { name: /add your first user/i });
      await user.click(addFirstButton);

      expect(mockNavigate).toHaveBeenCalledWith('/settings/access/users/new');
    });
  });

  describe('Role Filter', () => {
    it('filters users by selected role', async () => {
      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/users') {
          return Promise.resolve({ data: mockUsers });
        }
        if (url === '/users/roles') {
          return Promise.resolve({ data: mockRoles });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      const user = userEvent.setup();

      renderWithProviders(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      // Open role filter chip
      const roleFilterButton = screen.getByRole('button', { name: /^Role$/i });
      await user.click(roleFilterButton);

      // FilterChipListbox renders options as role="option" via Headless.Listbox.
      const adminOption = screen.getByRole('option', { name: /^admin$/i });
      await user.click(adminOption);

      // Should only show John Doe (Admin)
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });
    });

    it('resets role filter when "All Roles" is selected', async () => {
      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/users') {
          return Promise.resolve({ data: mockUsers });
        }
        if (url === '/users/roles') {
          return Promise.resolve({ data: mockRoles });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      const user = userEvent.setup();

      renderWithProviders(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Filter by Admin
      const roleFilterButton = screen.getByRole('button', { name: /^Role$/i });
      await user.click(roleFilterButton);
      const adminOption = screen.getByRole('option', { name: /^admin$/i });
      await user.click(adminOption);

      await waitFor(() => {
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });

      // Reset filter via the chip's × clear button (no "All Roles" reset row
      // in multi-state filter chips — the × is the canonical clear).
      const clearRole = screen.getByRole('button', { name: /role.*clear/i });
      await user.click(clearRole);

      // Both users should be visible again
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });
  });

  describe('Status Filter', () => {
    it('filters users by enabled status', async () => {
      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/users') {
          return Promise.resolve({ data: mockUsers });
        }
        if (url === '/users/roles') {
          return Promise.resolve({ data: mockRoles });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      const user = userEvent.setup();

      renderWithProviders(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      // Open status filter chip
      const statusFilterButton = screen.getByRole('button', { name: /^Status$/i });
      await user.click(statusFilterButton);

      const enabledOption = screen.getByRole('option', { name: /^enabled$/i });
      await user.click(enabledOption);

      // Should only show enabled users (John and Bob)
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });
    });

    it('filters users by disabled status', async () => {
      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/users') {
          return Promise.resolve({ data: mockUsers });
        }
        if (url === '/users/roles') {
          return Promise.resolve({ data: mockRoles });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      const user = userEvent.setup();

      renderWithProviders(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      // Open status filter chip
      const statusFilterButton = screen.getByRole('button', { name: /^Status$/i });
      await user.click(statusFilterButton);

      const disabledOption = screen.getByRole('option', { name: /^disabled$/i });
      await user.click(disabledOption);

      // Should only show Jane Smith (disabled)
      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      });
    });

    it('resets status filter when "All" is selected', async () => {
      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/users') {
          return Promise.resolve({ data: mockUsers });
        }
        if (url === '/users/roles') {
          return Promise.resolve({ data: mockRoles });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      const user = userEvent.setup();

      renderWithProviders(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Filter by enabled
      const statusFilterButton = screen.getByRole('button', { name: /^Status$/i });
      await user.click(statusFilterButton);
      const enabledOption = screen.getByRole('option', { name: /^enabled$/i });
      await user.click(enabledOption);

      await waitFor(() => {
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });

      // Reset via the chip's × clear button.
      const clearStatus = screen.getByRole('button', { name: /status.*clear/i });
      await user.click(clearStatus);

      // All users should be visible again
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });
    });
  });

  describe('Per-chip clear', () => {
    it('shows clear (×) on chips when set, hides on chips when empty', async () => {
      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/users') {
          return Promise.resolve({ data: mockUsers });
        }
        if (url === '/users/roles') {
          return Promise.resolve({ data: mockRoles });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      const user = userEvent.setup();

      renderWithProviders(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // No per-chip clear button initially (chips are in their empty state)
      expect(screen.queryByRole('button', { name: /status.*clear/i })).not.toBeInTheDocument();

      // Apply a filter
      const statusFilterButton = screen.getByRole('button', { name: /^Status$/i });
      await user.click(statusFilterButton);
      const enabledOption = screen.getByRole('option', { name: /^enabled$/i });
      await user.click(enabledOption);

      // The chip now exposes its × clear button.
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /status.*clear/i })).toBeInTheDocument();
      });
    });

    it('clears each filter independently via its × button', async () => {
      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/users') {
          return Promise.resolve({ data: mockUsers });
        }
        if (url === '/users/roles') {
          return Promise.resolve({ data: mockRoles });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      const user = userEvent.setup();

      renderWithProviders(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Apply role filter
      const roleFilterButton = screen.getByRole('button', { name: /^Role$/i });
      await user.click(roleFilterButton);
      const adminOption = screen.getByRole('option', { name: /^admin$/i });
      await user.click(adminOption);

      // Apply status filter
      await waitFor(() => {
        const statusFilterButton = screen.getByRole('button', { name: /^Status$/i });
        return user.click(statusFilterButton);
      });
      const enabledOption = screen.getByRole('option', { name: /^enabled$/i });
      await user.click(enabledOption);

      // Only John should be visible (Admin + Enabled)
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      });

      // Clear each filter via its × button
      await user.click(screen.getByRole('button', { name: /role.*clear/i }));
      await user.click(screen.getByRole('button', { name: /status.*clear/i }));

      // All users should be visible again
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });
    });
  });

  describe('Search by role name', () => {
    it('filters users by searching role name', async () => {
      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/users') {
          return Promise.resolve({ data: mockUsers });
        }
        if (url === '/users/roles') {
          return Promise.resolve({ data: mockRoles });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      const user = userEvent.setup();

      renderWithProviders(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Search by role name "technician"
      const searchInput = screen.getByPlaceholderText(/search by name, email, or role/i);
      await user.type(searchInput, 'technician');

      // Should only show Jane (Technician role)
      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      });
    });
  });

  describe('No search results', () => {
    it('hides all users when search has no matches', async () => {
      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/users') {
          return Promise.resolve({ data: mockUsers });
        }
        if (url === '/users/roles') {
          return Promise.resolve({ data: mockRoles });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      const user = userEvent.setup();

      renderWithProviders(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Search for something that doesn't exist
      const searchInput = screen.getByPlaceholderText(/search by name, email, or role/i);
      await user.type(searchInput, 'nonexistentuser');

      // All users should be hidden (no results)
      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      });
    });
  });

  describe('Enable user', () => {
    it('calls enable mutation when confirmed', async () => {
      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/users') {
          return Promise.resolve({ data: mockUsers });
        }
        if (url === '/users/roles') {
          return Promise.resolve({ data: mockRoles });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
      vi.mocked(apiClient.post).mockResolvedValue({ data: { ...mockUsers[1], enabled: true } });
      const user = userEvent.setup();

      renderWithProviders(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      // Open dropdown for disabled user, click Enable menu item
      const dropdownButtons = screen.getAllByRole('button', { name: /more options/i });
      await user.click(dropdownButtons[1]);
      const enableMenuItem = screen.getByRole('menuitem', { name: /enable/i });
      await user.click(enableMenuItem);

      // Confirm in the dialog
      const confirmButton = await screen.findByRole('button', { name: /^enable$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        // Same migration as deactivate — see the disable test above.
        expect(apiClient.post).toHaveBeenCalledWith('/users/user-2/activate');
      });
    });
  });

  describe('Multiple roles display', () => {
    it('displays user with multiple roles', async () => {
      const userWithMultipleRoles = {
        ...mockUsers[0],
        roles: [mockRoles[0], mockRoles[1]],
      };

      vi.mocked(apiClient.get).mockImplementation((url) => {
        if (url === '/users') {
          return Promise.resolve({ data: [userWithMultipleRoles] });
        }
        if (url === '/users/roles') {
          return Promise.resolve({ data: mockRoles });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      renderWithProviders(<UsersPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Both role badges should be visible
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('Technician')).toBeInTheDocument();
    });
  });

  // Previously tested a "Deleting…" button label flip inside the open Alert
  // while the mutation was in flight. The unified ConfirmDialog auto-closes
  // on confirm — pending state is no longer user-visible inside the dialog
  // (we surface success via a toast instead). The flip is therefore
  // unobservable; the test would be asserting on a behavior that no longer
  // exists by design.
});
