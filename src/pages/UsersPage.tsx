import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { EllipsisVerticalIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import apiClient from '../api/client';
import AppLayout from '../components/AppLayout';
import UserFormDialog from '../components/UserFormDialog';
import { Heading } from '../components/catalyst/heading';
import { Button } from '../components/catalyst/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/catalyst/table';
import { Badge } from '../components/catalyst/badge';
import { Dropdown, DropdownButton, DropdownItem, DropdownLabel, DropdownMenu } from '../components/catalyst/dropdown';
import { Input } from '../components/catalyst/input';

interface User {
  id: string;
  tenantId: string;
  cognitoSub: string;
  email: string;
  firstName: string;
  lastName: string;
  enabled: boolean;
  roleId?: string;
  roleName?: string;
  createdAt: string;
  updatedAt: string;
}

interface Role {
  id: string;
  name: string;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiClient.get<User[]>('/users');
      return response.data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await apiClient.get<Role[]>('/roles');
      return response.data;
    },
  });

  const disableMutation = useMutation({
    mutationFn: (id: string) => apiClient.put(`/users/${id}`, { enabled: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const enableMutation = useMutation({
    mutationFn: (id: string) => apiClient.put(`/users/${id}`, { enabled: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const handleAdd = () => {
    setSelectedUser(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsDialogOpen(true);
  };

  const handleDisable = (user: User) => {
    const message = t('users.actions.disableConfirm', { name: `${user.firstName} ${user.lastName}` });
    if (window.confirm(message)) {
      disableMutation.mutate(user.id);
    }
  };

  const handleEnable = (user: User) => {
    const message = t('users.actions.enableConfirm', { name: `${user.firstName} ${user.lastName}` });
    if (window.confirm(message)) {
      enableMutation.mutate(user.id);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedUser(null);
  };

  // Filter users based on search query
  const filteredUsers = users?.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.firstName.toLowerCase().includes(query) ||
      user.lastName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.roleName?.toLowerCase().includes(query)
    );
  });

  // Format date helper
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between">
        <div>
          <Heading>{t('entities.users')}</Heading>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {t('users.description')}
          </p>
        </div>
        <Button onClick={handleAdd}>{t('common.actions.add', { entity: t('entities.user') })}</Button>
      </div>

      {/* Search Bar */}
      {users && users.length > 0 && (
        <div className="mt-6">
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-500" />
            <Input
              type="search"
              placeholder={t('users.search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}

      {isLoading && (
        <div className="mt-8 text-center">
          <p className="text-zinc-600 dark:text-zinc-400">{t('common.actions.loading', { entities: t('entities.users') })}</p>
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-lg bg-red-50 p-4 ring-1 ring-red-200 dark:bg-red-950/10 dark:ring-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-400">
            {t('common.actions.errorLoading', { entities: t('entities.users') })}: {(error as Error).message}
          </p>
        </div>
      )}

      {users && users.length === 0 && (
        <div className="mt-8 text-center">
          <p className="text-zinc-600 dark:text-zinc-400">{t('common.actions.notFound', { entities: t('entities.users') })}</p>
          <Button className="mt-4" onClick={handleAdd}>
            {t('common.actions.addFirst', { entity: t('entities.user') })}
          </Button>
        </div>
      )}

      {filteredUsers && filteredUsers.length > 0 && (
        <div className="mt-8">
          <Table className="[--gutter:theme(spacing.2)] lg:[--gutter:theme(spacing.3)]">
            <TableHead>
              <TableRow>
                <TableHeader>{t('common.form.name')}</TableHeader>
                <TableHeader>{t('common.form.email')}</TableHeader>
                <TableHeader>{t('common.form.role')}</TableHeader>
                <TableHeader>{t('common.form.status')}</TableHeader>
                <TableHeader>{t('users.table.lastUpdated')}</TableHeader>
                <TableHeader></TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.firstName} {user.lastName}
                  </TableCell>
                  <TableCell className="text-zinc-500">{user.email}</TableCell>
                  <TableCell className="text-zinc-500">
                    <Badge color="sky">{user.roleName || '-'}</Badge>
                  </TableCell>
                  <TableCell>
                    {user.enabled ? (
                      <Badge color="lime">{t('common.enabled')}</Badge>
                    ) : (
                      <Badge color="zinc">{t('common.disabled')}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-zinc-500">{formatDate(user.updatedAt)}</TableCell>
                  <TableCell>
                    <div className="-mx-3 -my-1.5 sm:-mx-2.5">
                      <Dropdown>
                        <DropdownButton plain aria-label={t('common.moreOptions')}>
                          <EllipsisVerticalIcon className="size-5" />
                        </DropdownButton>
                        <DropdownMenu anchor="bottom end">
                          <DropdownItem onClick={() => handleEdit(user)}>
                            <DropdownLabel>{t('common.edit')}</DropdownLabel>
                          </DropdownItem>
                          {user.enabled ? (
                            <DropdownItem onClick={() => handleDisable(user)}>
                              <DropdownLabel>{t('users.table.disable')}</DropdownLabel>
                            </DropdownItem>
                          ) : (
                            <DropdownItem onClick={() => handleEnable(user)}>
                              <DropdownLabel>{t('users.table.enable')}</DropdownLabel>
                            </DropdownItem>
                          )}
                        </DropdownMenu>
                      </Dropdown>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredUsers.length === 0 && searchQuery && (
            <div className="mt-8 text-center">
              <p className="text-zinc-600 dark:text-zinc-400">
                {t('users.search.noMatch', { query: searchQuery })}
              </p>
            </div>
          )}
        </div>
      )}

      <UserFormDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        user={selectedUser}
        roles={roles || []}
      />
    </AppLayout>
  );
}
