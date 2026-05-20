import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  EllipsisVerticalIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import {
  userApi,
  type Role,
  type RoleMember,
  type GroupedCapabilitiesResponse,
} from '../api';
import { useHasCapability } from '../hooks/useCurrentUser';
import IconButton from '../components/IconButton';
import { Avatar } from '../components/ui/Avatar';
import { Callout } from '../components/ui/Callout';
import { Pill } from '../components/ui/Pill';
import { LoadingState } from '../components/ui/LoadingState';
import { Button } from '../components/catalyst/button';
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from '../components/catalyst/dropdown';
import ConfirmDialog from '../components/ConfirmDialog';
import { roleColor } from '../utils/roleColor';
import { showError, showSuccess, extractApiError } from '../lib/toast';

function formatDateShort(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function memberFullName(m: RoleMember): string {
  return `${m.firstName} ${m.lastName}`.trim();
}

// Sub-line shown under the member's name on the Members card. We surface
// the member's OTHER role names so the row carries useful context ("this
// person is also a Field Supervisor") rather than just echoing the role
// being viewed. If they only have the current role, fall back to that
// name; if they have no roles at all (shouldn't happen — they're on this
// list because they hold the role), render empty.
function memberSubline(m: RoleMember, currentRoleId: string): string {
  const others = m.roles.filter((r) => r.id !== currentRoleId);
  if (others.length > 0) return others[0].name;
  return m.roles[0]?.name ?? '';
}

export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);

  const canCreateRoles = useHasCapability('CREATE_ROLES');
  const canEditRoles = useHasCapability('EDIT_ROLES');
  const canDeleteRoles = useHasCapability('DELETE_ROLES');
  const canManage = canCreateRoles || canEditRoles || canDeleteRoles;

  const {
    data: role,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['roles', id],
    queryFn: () => userApi.getRoleById(id!),
    enabled: !!id,
  });

  const { data: groupedCaps } = useQuery({
    queryKey: ['capabilities', 'grouped'],
    queryFn: () => userApi.getGroupedCapabilities(),
  });

  const { data: membersResp } = useQuery({
    queryKey: ['roles', id, 'members'],
    queryFn: () => userApi.listRoleMembers(id!),
    enabled: !!id,
  });
  const members: RoleMember[] = membersResp?.users ?? [];

  const deleteMutation = useMutation({
    mutationFn: () => userApi.deleteRole(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      if (role) showSuccess(`${role.name} deleted`);
      navigate('/settings/access/roles');
    },
    onError: (err) =>
      showError("Couldn't delete role", extractApiError(err) ?? (err as Error).message),
  });

  const cloneMutation = useMutation({
    mutationFn: () =>
      userApi.cloneRole(id!, {
        name: `${role?.name ?? 'Role'} (copy)`,
        description: role?.description,
      }),
    onSuccess: (newRole) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      showSuccess(`${newRole.name} created`);
      navigate(`/settings/access/roles/${newRole.id}/edit`);
    },
    onError: (err) =>
      showError("Couldn't clone role", extractApiError(err) ?? (err as Error).message),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[980px]">
        <LoadingState
          label={t('common.actions.loading', { entities: t('entities.role') })}
        />
      </div>
    );
  }

  if (error || !role) {
    return (
      <div className="mx-auto max-w-[980px] p-2">
        <Callout kind="danger">
          {t('common.actions.errorLoading', { entities: t('entities.role') })}
          {error && `: ${(error as Error).message}`}
        </Callout>
        <Button
          className="mt-4"
          onClick={() => navigate('/settings/access/roles')}
        >
          {t('common.actions.back')}
        </Button>
      </div>
    );
  }

  const accent = roleColor(role.name);
  const userCount = members.length;
  const grantedCaps = new Set(role.capabilities ?? []);

  return (
    <div className="mx-auto max-w-[980px]">
      <Link
        to="/settings/access/roles"
        className="mb-2.5 inline-flex items-center gap-1 text-[11.5px] text-fg-muted hover:text-fg-strong"
      >
        {t('roles.detail.backToRoles')}
      </Link>

      <RoleHeader
        role={role}
        accent={accent}
        userCount={userCount}
        groupedCaps={groupedCaps}
        canManage={canManage}
        canCreateRoles={canCreateRoles}
        canEditRoles={canEditRoles}
        canDeleteRoles={canDeleteRoles}
        onClone={() => cloneMutation.mutate()}
        clonePending={cloneMutation.isPending}
        onDelete={() => setIsDeleteAlertOpen(true)}
      />

      <div className="mt-3">
        <DescriptionCard
          role={role}
          canEdit={canEditRoles}
        />
      </div>

      <div className="mt-3">
        <CapabilitiesGrid
          role={role}
          accent={accent}
          granted={grantedCaps}
          groupedCaps={groupedCaps}
        />
      </div>

      <div className="mt-3">
        <MembersCard
          roleId={role.id}
          members={members}
          canManage={canManage}
        />
      </div>

      <div className="mt-3">
        <LifecycleFooter
          role={role}
          userCount={userCount}
          canDelete={canDeleteRoles}
          onClone={() => cloneMutation.mutate()}
          clonePending={cloneMutation.isPending}
          onDelete={() => setIsDeleteAlertOpen(true)}
        />
      </div>

      <ConfirmDialog
        isOpen={isDeleteAlertOpen}
        onClose={() => setIsDeleteAlertOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title={t('common.actions.deleteConfirm', { name: role.name })}
        message={t('roles.actions.deleteWarning')}
        confirmLabel={deleteMutation.isPending ? t('common.deleting') : t('common.delete')}
        isDestructive
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Header — accent tile + name + pill + meta line + actions
// ──────────────────────────────────────────────────────────────────
function RoleHeader({
  role,
  accent,
  userCount,
  groupedCaps,
  canManage,
  canCreateRoles,
  canEditRoles,
  canDeleteRoles,
  onClone,
  clonePending,
  onDelete,
}: {
  role: Role;
  accent: string;
  userCount: number;
  groupedCaps: GroupedCapabilitiesResponse | undefined;
  canManage: boolean;
  canCreateRoles: boolean;
  canEditRoles: boolean;
  canDeleteRoles: boolean;
  onClone: () => void;
  clonePending: boolean;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const total = (groupedCaps?.groups ?? []).reduce(
    (sum, g) => sum + g.capabilities.length,
    0
  );
  const capCount = role.capabilities?.length ?? 0;
  const pct = total > 0 ? Math.round((capCount / total) * 100) : 0;
  const isCustom = !role.isProtected;
  const canDelete = canDeleteRoles && isCustom && userCount === 0;

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-border bg-bg-elev px-4 py-3.5 sm:flex-row sm:items-center sm:gap-3.5">
      {/* Accent tile */}
      <div
        className="flex size-11 shrink-0 items-center justify-center rounded-[10px] border"
        style={{
          background: `color-mix(in oklch, ${accent} 16%, var(--bg-elev-2))`,
          borderColor: `color-mix(in oklch, ${accent} 28%, var(--border))`,
        }}
      >
        <span
          className="size-3.5 rounded-full"
          style={{
            background: accent,
            boxShadow: `0 0 0 3px color-mix(in oklch, ${accent} 20%, transparent)`,
          }}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="m-0 text-[18px] font-bold tracking-[-0.02em] text-fg-strong">
            {role.name}
          </h1>
          {role.isProtected ? (
            <Pill tone="neutral">{t('roles.table.builtIn')}</Pill>
          ) : (
            <Pill tone="accent" dot>
              {t('roles.table.custom')}
            </Pill>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-fg-muted">
          <span>
            <span className="font-semibold text-fg-strong tabular-nums">{userCount}</span>{' '}
            {userCount === 1 ? t('entities.user') : t('entities.users')}
          </span>
          <span className="text-fg-dim">·</span>
          <span>
            <span className="font-semibold text-fg-strong tabular-nums">{capCount}</span>
            {' / '}
            <span className="tabular-nums">{total}</span> {t('roles.table.capabilities').toLowerCase()}{' '}
            <span className="tabular-nums">({pct}%)</span>
          </span>
          <span className="text-fg-dim">·</span>
          <span>
            <span className="text-fg-strong">{formatDateShort(role.updatedAt)}</span>
          </span>
        </div>
      </div>

      {canManage && (
        <div className="flex gap-1.5 max-sm:w-full max-sm:[&>*]:flex-1 sm:flex-shrink-0">
          {canCreateRoles && (
            <Button outline size="xs" onClick={onClone} disabled={clonePending}>
              {clonePending ? t('common.actions.loading', { entities: '' }).trim() : t('roles.actions.clone')}
            </Button>
          )}
          {canEditRoles && (
            <Button color="accent" size="xs" href={`/settings/access/roles/${role.id}/edit`}>
              {t('roles.detail.editCapabilities')}
            </Button>
          )}
          {(canEditRoles || canDelete) && (
            <Dropdown>
              <DropdownButton as={IconButton} aria-label={t('common.moreOptions')}>
                <EllipsisVerticalIcon className="size-4" />
              </DropdownButton>
              <DropdownMenu anchor="bottom end">
                {canEditRoles && (
                  <DropdownItem href={`/settings/access/roles/${role.id}/edit`}>
                    <DropdownLabel>{t('common.edit')}</DropdownLabel>
                  </DropdownItem>
                )}
                {canDelete && (
                  <DropdownItem onClick={onDelete}>
                    <DropdownLabel>{t('common.delete')}</DropdownLabel>
                  </DropdownItem>
                )}
              </DropdownMenu>
            </Dropdown>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Description card — inline label / body / Edit
// ──────────────────────────────────────────────────────────────────
function DescriptionCard({
  role,
  canEdit,
}: {
  role: Role;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  // Admin is the system-defining role — its description is locked.
  const lockEdit = role.isProtected && role.systemRoleCode === 'ADMIN';
  return (
    <div
      className="grid items-start gap-3.5 rounded-[10px] border border-border bg-bg-elev px-4 py-3"
      style={{ gridTemplateColumns: '110px 1fr auto' }}
    >
      <div className="pt-px text-[11px] font-medium text-fg-muted">
        {t('roles.detail.description')}
      </div>
      <div className="text-[12.5px] leading-[1.55] text-fg-strong">
        {role.description || '—'}
      </div>
      {canEdit && (
        <Button
          outline
          size="xs"
          href={lockEdit ? undefined : `/settings/access/roles/${role.id}/edit`}
          disabled={lockEdit}
        >
          {t('common.edit')}
        </Button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Capabilities — by area, granted/all toggle, chip grid
// ──────────────────────────────────────────────────────────────────
function CapabilitiesGrid({
  role,
  accent,
  granted,
  groupedCaps,
}: {
  role: Role;
  accent: string;
  granted: Set<string>;
  groupedCaps: GroupedCapabilitiesResponse | undefined;
}) {
  const { t } = useTranslation();
  const [showOnly, setShowOnly] = useState<'granted' | 'all'>('granted');

  const areas = useMemo(() => {
    if (!groupedCaps) return [];
    return groupedCaps.groups.map((g) => {
      const grantedInArea = g.capabilities.filter((c) => granted.has(c.name));
      return {
        area: g.displayName,
        all: g.capabilities,
        granted: grantedInArea,
        isFull: grantedInArea.length === g.capabilities.length,
      };
    });
  }, [groupedCaps, granted]);

  const visibleAreas =
    showOnly === 'granted' ? areas.filter((a) => a.granted.length > 0) : areas;

  return (
    <div className="rounded-[10px] border border-border bg-bg-elev">
      <div className="flex items-center justify-between gap-2.5 border-b border-border-soft px-3.5 py-2.5">
        <div>
          <div className="text-[13px] font-semibold text-fg-strong">
            {t('roles.table.capabilities')}
          </div>
          <div className="mt-px text-[11px] text-fg-muted">
            {t('roles.detail.capabilitiesGrouped')}
          </div>
        </div>
        <SegmentedToggle
          value={showOnly}
          onChange={setShowOnly}
          options={[
            { id: 'granted', label: t('roles.detail.showGrantedOnly') },
            { id: 'all', label: t('roles.detail.showAll') },
          ]}
        />
      </div>

      <div>
        {visibleAreas.map((a, i) => {
          const visible = showOnly === 'granted' ? a.granted : a.all;
          const isLast = i === visibleAreas.length - 1;
          const status =
            a.granted.length === 0
              ? t('roles.detail.noneLabel')
              : a.isFull
                ? t('roles.detail.fullLabel')
                : t('roles.detail.partialLabel');
          const statusColor = a.isFull
            ? 'text-success-500'
            : 'text-fg-dim';
          return (
            <div
              key={a.area}
              className={
                'grid items-start gap-3.5 px-3.5 py-2.5' +
                (isLast ? '' : ' border-b border-border-soft')
              }
              style={{ gridTemplateColumns: '200px 1fr 80px' }}
            >
              <div>
                <div className="text-[11.5px] font-semibold text-fg-strong">
                  {a.area}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="h-[3px] w-[60px] shrink-0 overflow-hidden rounded-[1.5px] bg-bg-active">
                    <div
                      className="h-full"
                      style={{
                        width: `${(a.granted.length / a.all.length) * 100}%`,
                        background:
                          a.granted.length === 0
                            ? 'transparent'
                            : a.isFull
                              ? 'var(--success-500)'
                              : accent,
                      }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-fg-dim tabular-nums">
                    {a.granted.length}/{a.all.length}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {visible.length === 0 ? (
                  <span className="text-[11px] italic text-fg-dim">
                    {t('roles.detail.capabilitiesNoneInArea')}
                  </span>
                ) : (
                  visible.map((c) => {
                    const has = granted.has(c.name);
                    return (
                      <CapabilityChip
                        key={c.name}
                        label={c.displayName}
                        granted={has}
                        accent={accent}
                      />
                    );
                  })
                )}
              </div>

              <div
                className={`text-right text-[10.5px] font-semibold uppercase tracking-[0.04em] ${statusColor}`}
              >
                {status}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
  // role is unused below but kept for future per-role customization hooks
  void role;
}

function CapabilityChip({
  label,
  granted,
  accent,
}: {
  label: string;
  granted: boolean;
  accent: string;
}) {
  if (granted) {
    return (
      <span
        className="rounded-[4px] border px-1.5 py-0.5 text-[10.5px] text-fg-strong"
        style={{
          background: `color-mix(in oklch, ${accent} 10%, var(--bg-elev-2))`,
          borderColor: `color-mix(in oklch, ${accent} 25%, var(--border))`,
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <span className="rounded-[4px] border border-border-soft bg-transparent px-1.5 py-0.5 text-[10.5px] text-fg-dim line-through">
      {label}
    </span>
  );
}

function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex gap-0 rounded-md border border-border-soft bg-bg-elev-2 p-0.5">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={
              'rounded px-2.5 py-0.5 text-[11px] font-medium transition-colors ' +
              (active
                ? 'bg-bg-elev text-fg-strong shadow-[0_1px_1px_color-mix(in_oklch,var(--fg-strong)_8%,transparent)]'
                : 'bg-transparent text-fg-muted hover:text-fg-strong')
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Members card
// ──────────────────────────────────────────────────────────────────
function MembersCard({
  roleId,
  members,
  canManage,
}: {
  roleId: string;
  members: RoleMember[];
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const initial = members.slice(0, 6);
  const visible = expanded ? members : initial;
  const overflow = members.length - initial.length;

  return (
    <div className="rounded-[10px] border border-border bg-bg-elev">
      <div className="flex items-center justify-between gap-2.5 border-b border-border-soft px-3.5 py-2.5">
        <div>
          <div className="text-[13px] font-semibold text-fg-strong">
            {t('roles.detail.membersHeader')}{' '}
            <span className="font-medium text-fg-dim tabular-nums">
              · {members.length}
            </span>
          </div>
          <div className="mt-px text-[11px] text-fg-muted">
            {t('roles.detail.membersDescription')}
          </div>
        </div>
        <Link
          to={`/settings/access/users?role=${roleId}`}
          className="text-[11.5px] font-medium text-accent-700 hover:underline"
        >
          {t('roles.detail.openInUsers')}
        </Link>
      </div>

      {members.length === 0 ? (
        <div className="px-3.5 py-6 text-center text-[12px] text-fg-muted">
          {t('roles.detail.membersEmpty')}
          {canManage && (
            <div className="mt-1.5">
              <Button
                outline
                size="xs"
                onClick={() => navigate('/settings/access/users')}
              >
                {t('common.actions.add', { entity: t('entities.user') })}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div>
          {visible.map((m, i) => {
            const isLast = i === visible.length - 1;
            const fullName = memberFullName(m);
            return (
              <div
                key={m.id}
                className={
                  'grid items-center gap-2.5 px-3.5 py-2' +
                  (isLast ? '' : ' border-b border-border-soft')
                }
                style={{ gridTemplateColumns: '28px 1fr 1fr auto' }}
              >
                <Avatar
                  name={fullName}
                  src={m.photoUrl ?? undefined}
                  size="sm"
                  className="size-6 text-[10px]"
                />
                <div>
                  <div className="text-[12.5px] font-medium text-fg-strong">
                    {fullName}
                  </div>
                  <div className="mt-px text-[10.5px] text-fg-dim">
                    {memberSubline(m, roleId)}
                  </div>
                </div>
                <div className="text-[11.5px] text-fg-muted">{m.email}</div>
                {canManage && (
                  <Button
                    outline
                    size="xs"
                    onClick={() => navigate(`/settings/access/users/${m.id}`)}
                  >
                    {t('roles.detail.view')}
                  </Button>
                )}
              </div>
            );
          })}
          {overflow > 0 && (
            <div
              className={
                'bg-bg-elev-2 px-3.5 py-2 text-center' +
                (expanded ? '' : ' border-t border-border-soft')
              }
            >
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-[11.5px] font-medium text-accent-700 hover:underline"
              >
                {expanded
                  ? t('roles.detail.showFewer')
                  : t('roles.detail.showAllMembers', { count: members.length })}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Lifecycle footer — three states
// ──────────────────────────────────────────────────────────────────
function LifecycleFooter({
  role,
  userCount,
  canDelete,
  onClone,
  clonePending,
  onDelete,
}: {
  role: Role;
  userCount: number;
  canDelete: boolean;
  onClone: () => void;
  clonePending: boolean;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  // State A — built-in role
  if (role.isProtected) {
    return (
      <div className="flex items-center gap-3.5 rounded-[10px] border border-border bg-bg-elev px-4 py-3">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-bg-active text-fg-muted">
          <LockClosedIcon className="size-3.5" />
        </div>
        <div className="flex-1">
          <div className="text-[12.5px] font-semibold text-fg-strong">
            {t('roles.detail.builtInLockTitle')}
          </div>
          <div className="mt-0.5 text-[11.5px] leading-[1.45] text-fg-muted">
            &ldquo;{role.name}&rdquo;{' '}
            {t('roles.detail.builtInLockBuiltinBody', {
              defaultValue:
                "is part of the default access model and can't be deleted. You can rename it, change its description, and customize its capabilities — or ",
            })}
            <button
              type="button"
              onClick={onClone}
              disabled={clonePending}
              className="font-medium text-accent-700 hover:underline disabled:opacity-60"
            >
              {t('roles.actions.clone').toLowerCase()}
            </button>
            {' '}
            {t('roles.detail.builtInLockBuiltinTail', {
              defaultValue: 'to make a custom variant.',
            })}
          </div>
        </div>
      </div>
    );
  }

  // State B — custom role with users (delete blocked)
  // State C — custom role with no users (delete allowed)
  const hasUsers = userCount > 0;
  return (
    <div className="flex items-center gap-3.5 rounded-[10px] border border-border bg-bg-elev px-4 py-3">
      <div className="flex-1">
        <div className="text-[12.5px] font-semibold text-fg-strong">
          {t('roles.detail.deleteRole')}
        </div>
        <div className="mt-0.5 text-[11.5px] leading-[1.45] text-fg-muted">
          {hasUsers ? (
            <>
              {t('roles.detail.deleteBlocked', { count: userCount })}{' '}
              <Link
                to={`/settings/access/users?role=${role.id}`}
                className="font-medium text-accent-700 hover:underline"
              >
                {t('roles.detail.reassignFirst')}
              </Link>
            </>
          ) : (
            t('roles.detail.deleteEmpty')
          )}
        </div>
      </div>
      {canDelete && (
        <Button
          outline
          size="xs"
          disabled={hasUsers}
          onClick={onDelete}
          className={
            hasUsers
              ? ''
              : '!border-danger-500/35 !text-danger-500 hover:!bg-danger-500/5'
          }
        >
          {t('roles.detail.deleteRole')}
        </Button>
      )}
    </div>
  );
}
