import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { mockAnimationsApi } from 'jsdom-testing-mocks';

// Mock animations API for Headless UI
mockAnimationsApi();

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock AWS Amplify
vi.mock('aws-amplify', () => ({
  Amplify: {
    configure: vi.fn(),
  },
}));

// Mock Amplify UI React
vi.mock('@aws-amplify/ui-react', () => ({
  useAuthenticator: vi.fn(() => ({
    authStatus: 'authenticated',
    user: { username: 'test-user' },
    signOut: vi.fn(),
  })),
  Authenticator: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver for Headless UI dropdowns
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock react-i18next with actual translations
vi.mock('react-i18next', () => {
  const translations = {
    'app.name': 'Dispatch',
    'app.loading': 'Loading...',
    'nav.dashboard': 'Dashboard',
    'nav.customers': 'Customers',
    'nav.workOrders': 'Work Orders',
    'nav.equipment': 'Equipment',
    'nav.financial': 'Financial',
    'nav.scheduling': 'Scheduling',
    'common.signOut': 'Sign out',
    'common.cancel': 'Cancel',
    'common.create': 'Create',
    'common.update': 'Update',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.saving': 'Saving...',
    'common.add': 'Add',
    'common.moreOptions': 'More options',
    'common.active': 'Active',
    'customers.title': 'Customers',
    'customers.description': 'Manage your customer database',
    'customers.addButton': 'Add Customer',
    'customers.addFirst': 'Add your first customer',
    'customers.noCustomers': 'No customers found',
    'customers.loading': 'Loading customers...',
    'customers.errorLoading': 'Error loading customers',
    'customers.deleteConfirm': 'Are you sure you want to delete {{name}}?',
    'customers.form.titleCreate': 'Add Customer',
    'customers.form.titleEdit': 'Edit Customer',
    'customers.form.descriptionCreate': 'Create a new customer record.',
    'customers.form.descriptionEdit': 'Update customer information.',
    'customers.form.name': 'Name',
    'customers.form.email': 'Email',
    'customers.form.phone': 'Phone',
    'customers.form.address': 'Address',
    'customers.form.city': 'City',
    'customers.form.state': 'State',
    'customers.form.stateHelper': 'CA',
    'customers.form.zipCode': 'Zip Code',
    'customers.table.name': 'Name',
    'customers.table.email': 'Email',
    'customers.table.phone': 'Phone',
    'customers.table.location': 'Location',
    'customers.table.status': 'Status',
    'workOrders.title': 'Work Orders',
    'workOrders.description': 'Manage work orders and service requests',
    'workOrders.createButton': 'Create Work Order',
    'workOrders.createFirst': 'Create your first work order',
    'workOrders.noWorkOrders': 'No work orders found',
    'workOrders.loading': 'Loading work orders...',
    'workOrders.errorLoading': 'Error loading work orders',
    'workOrders.deleteConfirm': 'Are you sure you want to delete this work order?',
    'workOrders.form.titleCreate': 'Create Work Order',
    'workOrders.form.titleEdit': 'Edit Work Order',
    'workOrders.form.descriptionCreate': 'Create a new work order for a customer.',
    'workOrders.form.descriptionEdit': 'Update work order information.',
    'workOrders.form.customer': 'Customer',
    'workOrders.form.customerPlaceholder': 'Select a customer...',
    'workOrders.form.customerRequired': 'Please select a customer',
    'workOrders.form.status': 'Status',
    'workOrders.form.scheduledDate': 'Scheduled Date',
    'workOrders.form.description': 'Description',
    'workOrders.form.notes': 'Notes',
    'workOrders.form.errorCreate': 'Failed to create work order',
    'workOrders.form.errorUpdate': 'Failed to update work order',
    'workOrders.status.pending': 'Pending',
    'workOrders.status.scheduled': 'Scheduled',
    'workOrders.status.inProgress': 'In Progress',
    'workOrders.status.completed': 'Completed',
    'workOrders.status.cancelled': 'Cancelled',
    'workOrders.table.id': 'ID',
    'workOrders.table.customer': 'Customer',
    'workOrders.table.status': 'Status',
    'workOrders.table.scheduled': 'Scheduled',
    'workOrders.table.amount': 'Amount',
    'workOrders.table.description': 'Description',
  };

  return {
    useTranslation: () => ({
      t: (key: string, params?: Record<string, unknown>) => {
        let translation = translations[key as keyof typeof translations] || key;
        if (params) {
          Object.keys(params).forEach((param) => {
            translation = translation.replace(`{{${param}}}`, String(params[param]));
          });
        }
        return translation;
      },
      i18n: {
        changeLanguage: () => new Promise(() => {}),
      },
    }),
    initReactI18next: {
      type: '3rdParty',
      init: () => {},
    },
  };
});
