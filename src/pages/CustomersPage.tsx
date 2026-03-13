import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import AppLayout from '../components/AppLayout';
import { Heading } from '../components/catalyst/heading';
import { Button } from '../components/catalyst/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/catalyst/table';
import { Badge } from '../components/catalyst/badge';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export default function CustomersPage() {
  const { data: customers, isLoading, error } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await apiClient.get<Customer[]>('/customers');
      return response.data;
    },
  });

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between">
          <div>
            <Heading>Customers</Heading>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Manage your customer database
            </p>
          </div>
          <Button>Add Customer</Button>
        </div>

        {isLoading && (
          <div className="mt-8 text-center">
            <p className="text-zinc-600 dark:text-zinc-400">Loading customers...</p>
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-lg bg-red-50 p-4 ring-1 ring-red-200 dark:bg-red-950/10 dark:ring-red-900/20">
            <p className="text-sm text-red-800 dark:text-red-400">
              Error loading customers: {(error as Error).message}
            </p>
          </div>
        )}

        {customers && customers.length === 0 && (
          <div className="mt-8 text-center">
            <p className="text-zinc-600 dark:text-zinc-400">No customers found</p>
          </div>
        )}

        {customers && customers.length > 0 && (
          <div className="mt-8">
            <Table className="[--gutter:theme(spacing.6)] lg:[--gutter:theme(spacing.10)]">
              <TableHead>
                <TableRow>
                  <TableHeader>Name</TableHeader>
                  <TableHeader>Email</TableHeader>
                  <TableHeader>Phone</TableHeader>
                  <TableHeader>Location</TableHeader>
                  <TableHeader>Status</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="text-zinc-500">{customer.email}</TableCell>
                    <TableCell className="text-zinc-500">{customer.phone || '-'}</TableCell>
                    <TableCell className="text-zinc-500">
                      {customer.city && customer.state
                        ? `${customer.city}, ${customer.state}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge color="lime">Active</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
