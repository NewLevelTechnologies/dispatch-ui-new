import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';
import IconButton from '../components/IconButton';
import { userApi, type User, type Role } from '../api';
import { useHasCapability, useCurrentUser } from '../hooks/useCurrentUser';
import { PageHead } from '../components/ui/PageHead';
import { Button } from '../components/catalyst/button';
import { Dropdown, DropdownButton, DropdownItem, DropdownLabel, DropdownMenu } from '../components/catalyst/dropdown';
import { Alert, AlertActions, AlertDescription, AlertTitle } from '../components/catalyst/alert';
import { Avatar } from '../components/ui/Avatar';
import { Pill } from '../components/ui/Pill';
import { RoleChip } from '../components/RoleChip';
import { Card, CardBody } from '../components/ui/Card';
import { DenseTable, DenseTHead, DenseRow } from '../components/ui/DenseTable';
import { ListToolbar, ListSearch } from '../components/ui/ListToolbar';
import { ListFooter } from '../components/ui/ListFooter';
import { FilterChipListbox, ChipListboxOption } from '../components/ui/FilterChipListbox';

// Seniority order — when a user has multiple roles, the higher-rank role
// shows first. Anything not in this map sorts after, alphabetically. Match
// against the role name case-insensitively so this survives backend casing
// drift (e.g. "Field Supervisor" vs "FIELD_SUPERVISOR").
const ROLE_SENIORITY = [
  'admin',
  'dispatcher',
  'field supervisor',
  'csr',
  'technician',
  'installer',
];

function roleRank(name: string): number {
  const key = name.toLowerCase().replace(/[_-]+/g, ' ').trim();
  const idx = ROLE_SENIORITY.indexOf(key);
  return idx === -1 ? ROLE_SENIORITY.length : idx;
}

function sortRolesBySeniority(roles: Role[]): Role[] {
  return [...roles].sort((a, b) => {
    const ra = roleRank(a.name);
    const rb = roleRank(b.name);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
}

export default function UsersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Permission checks
  const canInviteUsers = useHasCapability('INVITE_USERS');
  const canEditUsers = useHasCapability('EDIT_USERS');
  const canDeleteUsers = useHasCapability('DELETE_USERS');
  const { data: currentUser } = useCurrentUser();

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getAll(),
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => userApi.getRoles(),
  });

  const disableMutation = useMutation({
    mutationFn: (id: string) => userApi.disable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const enableMutation = useMutation({
    mutationFn: (id: string) => userApi.enable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsDeleteAlertOpen(false);
      setUserToDelete(null);
    },
  });

  const handleAdd = () => {
    navigate('/settings/access/users/new');
  };

  const handleEdit = (user: User) => {
    navigate(`/settings/access/users/${user.id}/edit`);
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

  const handleDelete = (user: User) => {
    setUserToDelete(user);
    setIsDeleteAlertOpen(true);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete.id);
    }
  };

  // Filter users based on search query, role, and status
  const filteredUsers = useMemo(() => {
    return users?.filter((user) => {
      // Search filter
      const query = searchQuery.toLowerCase();
      const roleNames = user.roles?.map(r => r.name.toLowerCase()).join(' ') || '';
      const matchesSearch = !query || (
        user.firstName.toLowerCase().includes(query) ||
        user.lastName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        roleNames.includes(query)
      );

      // Role filter
      const matchesRole = !roleFilter || user.roles?.some(r => r.id === roleFilter);

      // Status filter
      const matchesStatus = !statusFilter || (
        (statusFilter === 'enabled' && user.enabled) ||
        (statusFilter === 'disabled' && !user.enabled)
      );

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Format date helper
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Subtitle reflects the *displayed* set (matches filtered count) and adds
  // an "X disabled" breakdown when it's non-zero — Users loads all rows on a
  // single GET, so this is cheap.
  const totalUsers = users?.length ?? 0;
  const displayedCount = filteredUsers?.length ?? 0;
  const disabledCount = useMemo(
    () => (filteredUsers ?? []).filter((u) => !u.enabled).length,
    [filteredUsers]
  );
  const userSubtitle = (() => {
    if (totalUsers === 0) return null;
    const parts: string[] = [];
    parts.push(`${displayedCount.toLocaleString()} ${displayedCount === 1 ? t('entities.user').toLowerCase() : t('entities.users').toLowerCase()}`);
    if (disabledCount > 0) {
      parts.push(t('users.breakdown.disabled', { count: disabledCount }));
    }
    return parts.join(' · ');
  })();

  return (
    <>
      <PageHead
        title={t('entities.users')}
        sub={userSubtitle}
        actions={
          canInviteUsers ? (
            <Button color="accent" onClick={handleAdd}>{t('common.actions.add', { entity: t('entities.user') })}</Button>
          ) : null
        }
      />

      {/* Search + filter chips */}
      {users && users.length > 0 && (
        <ListToolbar
          search={
            <ListSearch
              placeholder={t('users.search.placeholder')}
              value={searchQuery}
              onChange={setSearchQuery}
            />
          }
        >
          {roles && roles.length > 0 && (
            <FilterChipListbox
              label={t('users.filter.role')}
              ariaLabel={t('users.filter.role')}
              value={roleFilter || null}
              displayValue={roleFilter ? roles.find((r) => r.id === roleFilter)?.name ?? null : null}
              resetLabel={t('users.filter.allRoles')}
              onChange={(id) => setRoleFilter(id ?? '')}
              onClear={() => setRoleFilter('')}
            >
              {roles.map((role) => (
                <ChipListboxOption key={role.id} value={role.id}>{role.name}</ChipListboxOption>
              ))}
            </FilterChipListbox>
          )}

          <FilterChipListbox
            label={t('users.filter.status')}
            ariaLabel={t('users.filter.status')}
            value={statusFilter || null}
            displayValue={statusFilter ? t(`users.filter.${statusFilter}`) : null}
            resetLabel={t('users.filter.all')}
            onChange={(id) => setStatusFilter(id ?? '')}
            onClear={() => setStatusFilter('')}
          >
            <ChipListboxOption value="enabled">{t('users.filter.enabled')}</ChipListboxOption>
            <ChipListboxOption value="disabled">{t('users.filter.disabled')}</ChipListboxOption>
          </FilterChipListbox>
        </ListToolbar>
      )}

      {isLoading && (
        <div className="mt-4 text-center">
          <p className="text-zinc-600 dark:text-zinc-400">{t('common.actions.loading', { entities: t('entities.users') })}</p>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 ring-1 ring-red-200 dark:bg-red-950/10 dark:ring-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-400">
            {t('common.actions.errorLoading', { entities: t('entities.users') })}: {(error as Error).message}
          </p>
        </div>
      )}

      {users && users.length === 0 && (
        <div className="mt-4 text-center">
          <p className="text-zinc-600 dark:text-zinc-400">{t('common.actions.notFound', { entities: t('entities.users') })}</p>
          {canInviteUsers && (
            <Button className="mt-4" onClick={handleAdd}>
              {t('common.actions.addFirst', { entity: t('entities.user') })}
            </Button>
          )}
        </div>
      )}

      {filteredUsers && filteredUsers.length > 0 && (
        <div className="mt-4">
          <Card>
            <CardBody flush>
              <DenseTable>
                <DenseTHead>
                  <tr>
                    <th>{t('common.form.name')}</th>
                    <th>{t('common.form.role')}</th>
                    <th>{t('users.table.lastActive')}</th>
                    <th>{t('common.form.status')}</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </DenseTHead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const fullName = `${user.firstName} ${user.lastName}`;
                    const isMe = currentUser?.id === user.id;
                    const rowOpacity = !user.enabled ? 'opacity-55' : '';
                    return (
                      <DenseRow
                        key={user.id}
                        onClick={(e: React.MouseEvent) => {
                          const target = e.target as HTMLElement;
                          if (!target.closest('[role="menu"]') && !target.closest('button[aria-label]')) {
                            navigate(`/settings/access/users/${user.id}`);
                          }
                        }}
                        className={`cursor-pointer ${rowOpacity}`}
                      >
                        <td>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={fullName} size="sm" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="strong truncate">{fullName}</span>
                                {isMe && (
                                  <span className="inline-flex items-center rounded bg-bg-active px-1 py-[1px] text-[9px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                                    {t('users.table.you')}
                                  </span>
                                )}
                              </div>
                              <div className="muted truncate">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {user.roles && user.roles.length > 0 ? (
                            (() => {
                              const ordered = sortRolesBySeniority(user.roles);
                              const visible = ordered.slice(0, 2);
                              const overflow = ordered.slice(2);
                              return (
                                <div className="flex flex-wrap gap-1">
                                  {visible.map((role) => (
                                    <RoleChip key={role.id} name={role.name} />
                                  ))}
                                  {overflow.length > 0 && (
                                    <span title={overflow.map((r) => r.name).join(', ')}>
                                      <Pill tone="neutral">+{overflow.length}</Pill>
                                    </span>
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            <span className="text-fg-dim">—</span>
                          )}
                        </td>
                        <td className="muted">{formatDate(user.updatedAt)}</td>
                        <td>
                          {user.enabled ? (
                            <Pill tone="success" dot live>{t('common.active')}</Pill>
                          ) : (
                            <Pill tone="neutral" dot>{t('common.disabled')}</Pill>
                          )}
                        </td>
                        <td className="right">
                          {(canEditUsers || canDeleteUsers) && (
                            <div onClick={(e) => e.stopPropagation()}>
                              <Dropdown>
                                <DropdownButton as={IconButton} aria-label={t('common.moreOptions')}>
                                  <EllipsisVerticalIcon className="size-4" />
                                </DropdownButton>
                                <DropdownMenu anchor="bottom end">
                                  {canEditUsers && (
                                    <>
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
                                    </>
                                  )}
                                  {canDeleteUsers && (
                                    <DropdownItem onClick={() => handleDelete(user)}>
                                      <DropdownLabel>{t('common.delete')}</DropdownLabel>
                                    </DropdownItem>
                                  )}
                                </DropdownMenu>
                              </Dropdown>
                            </div>
                          )}
                        </td>
                      </DenseRow>
                    );
                  })}
                </tbody>
              </DenseTable>
              <ListFooter
                page={1}
                totalPages={1}
                pageHref={() => '#'}
                left={
                  <>
                    {t('settings.showingCount', {
                      count: displayedCount,
                      noun: t('entities.users').toLowerCase(),
                    })}
                    {disabledCount > 0 && (
                      <> · {t('users.breakdown.disabled', { count: disabledCount })}</>
                    )}
                  </>
                }
              />
            </CardBody>
          </Card>

          {filteredUsers.length === 0 && searchQuery && (
            <div className="mt-4 text-center">
              <p className="text-fg-muted">
                {t('users.search.noMatch', { query: searchQuery })}
              </p>
            </div>
          )}
        </div>
      )}

      <Alert open={isDeleteAlertOpen} onClose={() => setIsDeleteAlertOpen(false)}>
        <AlertTitle>{t('common.actions.deleteConfirm', { name: userToDelete ? `${userToDelete.firstName} ${userToDelete.lastName}` : '' })}</AlertTitle>
        <AlertDescription>
          {t('users.actions.deleteWarning')}
        </AlertDescription>
        <AlertActions>
          <Button plain onClick={() => setIsDeleteAlertOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button color="red" onClick={confirmDelete} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? t('common.deleting') : t('common.delete')}
          </Button>
        </AlertActions>
      </Alert>
    </>
  );
}
