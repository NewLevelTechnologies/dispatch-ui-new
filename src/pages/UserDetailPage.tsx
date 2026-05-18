/* eslint-disable i18next/no-literal-string -- dense v1.5 visual page; key i18n is wired via t() for major strings, but inline glyphs/separators/short labels are kept as literals to keep the markup readable */
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeftIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { userApi, dispatchRegionApi, type User, type Role } from '../api';
import { auditApi, type AccountActivityEvent } from '../api/auditApi';
import { formatPhone } from '../utils/formatPhone';
import { useHasCapability } from '../hooks/useCurrentUser';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/catalyst/button';

// Stable per-role accent — same approach the v1.5 design uses to keep
// the Field Supervisor / Dispatcher / Admin chips visually distinct
// without a hand-maintained color table. Hash by role name → one of
// nine well-spaced hues, oklch lightness/chroma chosen to read in both
// themes. The number string is purely for stability across reloads.
const ROLE_HUES = [25, 200, 270, 150, 85, 215, 320, 50, 240];
function roleAccent(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const hue = ROLE_HUES[Math.abs(h) % ROLE_HUES.length];
  // 'Admin' deserves a hotter color so it pops in the chip row.
  if (/admin/i.test(name)) return 'oklch(55% 0.18 25)';
  return `oklch(60% 0.14 ${hue})`;
}

function formatDateShort(d: string | Date | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function relTime(ts: string): string {
  const then = new Date(ts).getTime();
  const now = Date.now();
  const diffMin = Math.round((now - then) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return 'Yesterday';
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const canEditUsers = useHasCapability('EDIT_USERS');
  // Activate/deactivate moved to a dedicated capability on the backend so
  // it can be granted independently of profile/role edits.
  const canDeactivateUsers = useHasCapability('DEACTIVATE_USERS');
  const canViewAuditLogs = useHasCapability('VIEW_AUDIT_LOGS');

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['users', id],
    queryFn: () => userApi.getById(id!),
  });

  const { data: allRegions } = useQuery({
    queryKey: ['dispatch-regions'],
    queryFn: () => dispatchRegionApi.getAll(true),
  });

  const disableMutation = useMutation({
    mutationFn: () => userApi.disable(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const enableMutation = useMutation({
    mutationFn: () => userApi.enable(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  // Resend Invitation — only meaningful while the user is in INVITED or
  // INVITATION_EXPIRED state. Backend returns 409 if the user is past the
  // invitation state (shouldn't happen given the UI gate, but defend
  // against races with another admin accepting the invite).
  const resendInvitationMutation = useMutation({
    mutationFn: () => userApi.resendInvitation(id!),
    onSuccess: () => {
      // Eventual-consistency tail on the activity feed.
      window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['account-activity', id] });
      }, 2000);
      queryClient.invalidateQueries({ queryKey: ['users', id] });
    },
    onError: (err: unknown) => {
      const status =
        err instanceof Error && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      const message =
        err instanceof Error && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      if (status === 409) {
        window.alert(message || 'This user is no longer in an invitable state.');
        // Refetch so the button drops away on the next render.
        queryClient.invalidateQueries({ queryKey: ['users', id] });
        return;
      }
      window.alert(message || 'Failed to resend invitation.');
    },
  });

  const handleEdit = () => {
    if (user) navigate(`/settings/access/users/${user.id}/edit`);
  };

  const handleResendInvitation = () => resendInvitationMutation.mutate();

  const handleDeactivate = () => {
    if (!user) return;
    const message = t('users.actions.disableConfirm', { name: `${user.firstName} ${user.lastName}` });
    if (window.confirm(message)) disableMutation.mutate();
  };

  const handleActivate = () => {
    if (!user) return;
    const message = t('users.actions.enableConfirm', { name: `${user.firstName} ${user.lastName}` });
    if (window.confirm(message)) enableMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-[12.5px] text-fg-muted">
        {t('common.actions.loading', { entities: t('entities.user') })}
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-danger-500/30 bg-danger-500/5 p-4 text-[12.5px] text-danger-500">
          {t('common.actions.errorLoading', { entities: t('entities.user') })}
          {error && `: ${(error as Error).message}`}
        </div>
        <Button className="mt-4" onClick={() => navigate('/settings/access/users')}>
          <ArrowLeftIcon className="size-4" />
          {t('common.actions.back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[980px]">
      <Link
        to="/settings/access/users"
        className="mb-2.5 inline-flex items-center gap-1 text-[11.5px] text-fg-muted hover:text-fg-strong"
      >
        ← All {t('entities.users').toLowerCase()}
      </Link>

      <Header
        user={user}
        onEdit={canEditUsers ? handleEdit : undefined}
        onResendInvitation={canEditUsers ? handleResendInvitation : undefined}
        resendInvitationPending={resendInvitationMutation.isPending}
      />

      <div className="mt-3">
        <RolesAndRegionsCard user={user} regions={allRegions ?? []} onEditAccess={canEditUsers ? handleEdit : undefined} />
      </div>

      <div className="mt-3">
        <SecurityCard userId={user.id} canEdit={canEditUsers} />
      </div>

      {canViewAuditLogs && (
        <div className="mt-3">
          <AccountActivityCard userId={user.id} />
        </div>
      )}

      {canDeactivateUsers && (
        <div className="mt-3">
          <LifecycleFooter
            user={user}
            onDeactivate={handleDeactivate}
            onActivate={handleActivate}
            pending={disableMutation.isPending || enableMutation.isPending}
          />
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Header — avatar, name, role chips, inline status line, actions
// ──────────────────────────────────────────────────────────────────
function Header({
  user,
  onEdit,
  onResendInvitation,
  resendInvitationPending,
}: {
  user: User;
  onEdit?: () => void;
  onResendInvitation?: () => void;
  resendInvitationPending?: boolean;
}) {
  const fullName = `${user.firstName} ${user.lastName}`;
  // Per the v1.5 spec: "Resend invite" only surfaces while the user is in
  // INVITED or INVITATION_EXPIRED. Don't gate on `enabled` — a disabled
  // user that never accepted is still "invited".
  const canResendInvitation =
    !!onResendInvitation &&
    (user.invitationStatus === 'INVITED' || user.invitationStatus === 'INVITATION_EXPIRED');
  return (
    <div className="flex items-center gap-3.5 rounded-[10px] border border-border bg-bg-elev px-4 py-3.5">
      <Avatar name={fullName} size="xl" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="m-0 text-[18px] leading-tight font-bold tracking-[-0.02em] text-fg-strong">
            {fullName}
          </h1>
          <RoleStack roles={user.roles ?? []} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-fg-muted">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={
                user.enabled
                  ? 'inline-block size-[7px] rounded-full bg-success-500 shadow-[0_0_0_2.5px_color-mix(in_oklch,var(--success-500)_22%,transparent)]'
                  : 'inline-block size-[7px] rounded-full bg-fg-dim'
              }
            />
            <span className="font-medium text-fg-strong">{user.enabled ? 'Active' : 'Disabled'}</span>
          </span>
          <span className="text-fg-dim">·</span>
          <span className="break-all">{user.email}</span>
          {user.phoneNumber && (
            <>
              <span className="text-fg-dim">·</span>
              <a
                href={`tel:${user.phoneNumber.replace(/\D/g, '')}`}
                className="font-mono hover:text-fg-strong hover:underline"
              >
                {formatPhone(user.phoneNumber)}
              </a>
            </>
          )}
          <span className="text-fg-dim">·</span>
          <span>Joined {formatDateShort(user.createdAt)}</span>
        </div>
      </div>
      <div className="flex flex-shrink-0 gap-1.5">
        {canResendInvitation && (
          <button
            onClick={onResendInvitation}
            disabled={resendInvitationPending}
            className="inline-flex h-[30px] items-center rounded-md border border-border bg-bg-elev px-3 text-[12.5px] font-semibold text-fg-strong hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resendInvitationPending ? 'Resending…' : 'Resend invitation'}
          </button>
        )}
        {onEdit && (
          <button
            onClick={onEdit}
            className="inline-flex h-[30px] items-center gap-1.5 rounded-md border border-accent-700/80 bg-gradient-to-b from-accent-500 to-accent-600 px-3 text-[12.5px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.18)] hover:from-accent-400 hover:to-accent-500"
          >
            Edit user
          </button>
        )}
        <button
          aria-label="More options"
          className="inline-flex h-[30px] items-center justify-center rounded-md border border-border bg-bg-elev px-2 text-fg-muted hover:bg-bg-hover hover:text-fg-strong"
        >
          <EllipsisHorizontalIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}

function RoleStack({ roles, max = 3 }: { roles: Role[]; max?: number }) {
  if (!roles.length) {
    return <span className="text-[11.5px] italic text-fg-dim">No roles</span>;
  }
  const inline = roles.slice(0, max);
  const more = roles.length - inline.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {inline.map((r) => (
        <RoleChip key={r.id} name={r.name} />
      ))}
      {more > 0 && (
        <span
          title={roles.slice(max).map((r) => r.name).join(', ')}
          className="inline-flex items-center rounded-full bg-bg-active px-2 py-[2px] text-[11px] font-semibold text-fg-muted"
        >
          +{more} more
        </span>
      )}
    </div>
  );
}

function RoleChip({ name }: { name: string }) {
  const color = roleAccent(name);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-[2px] text-[11px] font-semibold"
      style={{
        background: `color-mix(in oklch, ${color} 14%, var(--bg-elev))`,
        color,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {name}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────
// Roles + Regions — combined card with capabilities expander
// ──────────────────────────────────────────────────────────────────
function RolesAndRegionsCard({
  user,
  regions,
  onEditAccess,
}: {
  user: User;
  regions: { id: string; name: string }[];
  onEditAccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const userRegions = (user.dispatchRegionIds ?? [])
    .map((id) => regions.find((r) => r.id === id))
    .filter((r): r is { id: string; name: string } => !!r);
  const capCount = user.capabilities?.length ?? 0;

  return (
    <div className="rounded-[10px] border border-border bg-bg-elev">
      <div className="px-3.5 py-3">
        {/* Row: Roles */}
        <div className="grid grid-cols-[90px_1fr_auto] items-center gap-3">
          <div className="text-[11px] font-medium text-fg-muted">Roles</div>
          <div className="flex flex-wrap gap-1">
            {(user.roles ?? []).length > 0 ? (
              user.roles!.map((r) => <RoleChip key={r.id} name={r.name} />)
            ) : (
              <span className="text-[11.5px] italic text-fg-dim">No roles assigned</span>
            )}
          </div>
          {onEditAccess && (
            <button
              onClick={onEditAccess}
              className="inline-flex h-[26px] items-center rounded-md border border-border bg-bg-elev px-2.5 text-[11.5px] font-semibold text-fg-strong hover:bg-bg-hover"
            >
              Edit access
            </button>
          )}
        </div>

        {/* Row: Regions */}
        <div className="mt-2.5 grid grid-cols-[90px_1fr] items-center gap-3">
          <div className="text-[11px] font-medium text-fg-muted">Regions</div>
          <div className="flex flex-wrap gap-1">
            {userRegions.length === 0 ? (
              <span className="text-[11.5px] italic text-fg-muted">
                {t('users.detail.noRegionsAssigned')}
              </span>
            ) : (
              userRegions.map((r) => (
                <span
                  key={r.id}
                  className="rounded bg-bg-active px-2 py-[2px] text-[11.5px] text-fg-strong"
                >
                  {r.name}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Capability count + view-detail trigger */}
        {capCount > 0 && (
          <div className="mt-2.5 flex items-center gap-2.5 border-t border-border-soft pt-2.5 text-[11px] text-fg-muted">
            <span>
              <span className="font-mono font-semibold tabular-nums text-fg-strong">
                {capCount}
              </span>{' '}
              capabilities granted
            </span>
            <span className="text-fg-dim">·</span>
            <button
              onClick={() => setOpen(!open)}
              className="font-medium text-accent-700 hover:underline"
            >
              {open ? 'Hide details' : 'View detailed permissions'}
            </button>
          </div>
        )}
      </div>

      {open && capCount > 0 && <CapabilityDetail user={user} />}
    </div>
  );
}

// Expanded capability detail — grouped by feature area
function CapabilityDetail({ user }: { user: User }) {
  const { data } = useQuery({
    queryKey: ['capabilities', 'grouped'],
    queryFn: () => userApi.getGroupedCapabilities(),
  });

  if (!data) {
    return (
      <div className="border-t border-dashed border-border-soft px-3.5 py-3 text-[11.5px] text-fg-muted">
        Loading capabilities…
      </div>
    );
  }

  const userCaps = new Set(user.capabilities ?? []);
  const sourceRoles = (user.roles ?? []).map((r) => ({
    name: r.name,
    caps: new Set(r.capabilities ?? []),
  }));
  const groups = data.groups
    .map((g) => ({
      area: g.displayName,
      total: g.capabilities.length,
      granted: g.capabilities.filter((c) => userCaps.has(c.name)),
    }))
    .filter((g) => g.granted.length > 0);

  return (
    <div className="border-t border-dashed border-border-soft">
      <div className="flex items-center justify-between bg-bg-elev-2 px-3.5 py-2 text-[11px] text-fg-muted">
        <span>
          Capabilities grouped by area · Union of {user.roles?.length ?? 0} role
          {(user.roles?.length ?? 0) !== 1 && 's'}.
        </span>
      </div>
      <div>
        {groups.map((g, i) => (
          <div
            key={g.area}
            className={`grid grid-cols-[180px_1fr_50px] items-start gap-2.5 px-3.5 py-2 ${
              i < groups.length - 1 ? 'border-b border-border-soft' : ''
            }`}
          >
            <div className="text-[11.5px] font-semibold text-fg-strong">{g.area}</div>
            <div className="flex flex-wrap gap-1">
              {g.granted.map((c) => {
                const sources = sourceRoles.filter((sr) => sr.caps.has(c.name));
                return (
                  <span
                    key={c.name}
                    className="inline-flex items-center gap-1 rounded border px-1.5 py-[2px] text-[10.5px] text-fg-strong"
                    style={{
                      background: 'color-mix(in oklch, var(--accent-500) 8%, var(--bg-elev-2))',
                      borderColor: 'color-mix(in oklch, var(--accent-500) 20%, var(--border))',
                    }}
                    title={c.description}
                  >
                    {c.displayName}
                    {sources.length > 0 && sources.length < (user.roles?.length ?? 0) && (
                      <span
                        className="rounded px-1 text-[9px] font-bold uppercase tracking-wider text-white"
                        style={{ background: roleAccent(sources[0].name) }}
                      >
                        {sources[0].name
                          .split(' ')
                          .map((w) => w[0])
                          .join('')}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
            <div className="text-right font-mono text-[10px] font-medium text-fg-dim">
              {g.granted.length}/{g.total}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Security — Password / 2FA / Sign-in rows.
// Each row calls a dedicated POST endpoint on user-service. Backend
// emits matching activity-feed events; we refetch after ~2s to give
// the SNS/SQS pipeline time to land the row.
//
// The 15-min TTL hint is required copy per the v1.5 spec — it sets
// expectations that "sign out everywhere" isn't instantaneous because
// access tokens stay valid until expiry; only refresh is revoked
// immediately. Don't drop it.
// ──────────────────────────────────────────────────────────────────
function SecurityCard({ userId, canEdit }: { userId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();

  // Eventual-consistency tail: backend emits an activity row to SNS,
  // which lands in audit-service via SQS a couple seconds later. One
  // delayed invalidation is enough; React Query handles the refetch.
  const refetchActivitySoon = () => {
    window.setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['account-activity', userId] });
    }, 2000);
  };

  const errorAlert = (action: string) => (err: unknown) => {
    const message =
      err instanceof Error && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
    window.alert(message || `${action} failed. Please try again.`);
  };

  const resetPasswordMutation = useMutation({
    mutationFn: () => userApi.sendPasswordResetLink(userId),
    onSuccess: refetchActivitySoon,
    onError: errorAlert('Send reset link'),
  });

  const resetMfaMutation = useMutation({
    mutationFn: () => userApi.resetMfa(userId),
    onSuccess: refetchActivitySoon,
    onError: errorAlert('Reset 2FA'),
  });

  const signOutMutation = useMutation({
    mutationFn: () => userApi.signOutEverywhere(userId),
    onSuccess: refetchActivitySoon,
    onError: errorAlert('Sign out everywhere'),
  });

  const items: {
    k: string;
    v: string;
    hint?: string;
    actionLabel: string;
    pending: boolean;
    onAction: () => void;
    confirm?: string;
  }[] = [
    {
      k: 'Password',
      v: 'Managed via reset link',
      actionLabel: resetPasswordMutation.isPending ? 'Sending…' : 'Send reset link',
      pending: resetPasswordMutation.isPending,
      onAction: () => resetPasswordMutation.mutate(),
    },
    {
      k: 'Two-factor',
      v: 'Managed in Cognito',
      actionLabel: resetMfaMutation.isPending ? 'Resetting…' : 'Reset 2FA',
      pending: resetMfaMutation.isPending,
      // 2FA reset cascades into GLOBAL_SIGNOUT — flag that in the confirm
      // so admins don't reset MFA expecting sessions to keep working.
      confirm: 'Reset 2FA? This signs the user out of all sessions.',
      onAction: () => resetMfaMutation.mutate(),
    },
    {
      k: 'Sign-in',
      v: 'Email + password',
      hint: 'Existing sessions end within 15 min (access-token TTL). Refresh is revoked immediately.',
      actionLabel: signOutMutation.isPending ? 'Signing out…' : 'Sign out everywhere',
      pending: signOutMutation.isPending,
      confirm: 'Sign this user out of all sessions?',
      onAction: () => signOutMutation.mutate(),
    },
  ];

  const handleClick = (it: typeof items[number]) => {
    if (it.confirm && !window.confirm(it.confirm)) return;
    it.onAction();
  };

  return (
    <div className="rounded-[10px] border border-border bg-bg-elev">
      <div className="border-b border-border-soft px-3.5 py-2.5">
        <div className="text-[13px] font-semibold text-fg-strong">Security</div>
      </div>
      <div>
        {items.map((it, i) => (
          <div
            key={it.k}
            className={`grid grid-cols-[110px_1fr_auto] items-center gap-3.5 px-3.5 py-2.5 ${
              i < items.length - 1 ? 'border-b border-border-soft' : ''
            }`}
          >
            <div className="text-[11.5px] font-medium text-fg-muted">{it.k}</div>
            <div>
              <div className="text-[12.5px] text-fg-strong">{it.v}</div>
              {it.hint && (
                <div className="mt-0.5 text-[10.5px] leading-snug text-fg-dim">{it.hint}</div>
              )}
            </div>
            <button
              onClick={() => handleClick(it)}
              disabled={!canEdit || it.pending}
              className="inline-flex h-[26px] items-center rounded-md border border-border bg-bg-elev px-2.5 text-[11.5px] font-semibold text-fg-strong hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {it.actionLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Account activity — backed by /audit/account-activity/{userId}.
//
// The contract is additive: new actionType values land over time
// (failed sign-ins, success sign-ins, attempt-collapse rows from
// Cognito Lambda triggers). The classifier defaults to a generic
// "Activity" glyph so an unknown enum value renders gracefully instead
// of erroring.
//
// Cascade rows (mfa_reset + global_signout, deactivate + global_signout)
// are intentionally separate facts — render them back-to-back; do not
// de-dupe. Payload may be null; only role events populate it today.
// ──────────────────────────────────────────────────────────────────
type Kind = 'signin' | 'access' | 'security' | 'failed' | 'lifecycle' | 'lifecycle-warn';

function rolePayloadName(payload: AccountActivityEvent['payload']): string {
  if (!payload || typeof payload !== 'object') return '(unknown role)';
  const p = payload as { roleName?: unknown; roleId?: unknown };
  if (typeof p.roleName === 'string' && p.roleName) return p.roleName;
  if (typeof p.roleId === 'string' && p.roleId) return p.roleId;
  return '(unknown role)';
}

// Round a window duration to the largest human-friendly unit. Sign-in
// attempt windows are typically minutes; this rolls up to "Nh" if a
// window ever grows past 60 minutes so the meta line doesn't say "73 min".
function formatWindowSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 60) {
    return `${Math.max(1, Math.round(seconds))}s`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}

function classifyEvent(event: AccountActivityEvent): {
  kind: Kind;
  text: string;
  // Optional per-event sub-line. When set, takes the slot the actor
  // "· By {name}" line would have occupied — sign-in runs render the
  // attempt count + window instead of an actor since the actor IS the
  // user whose detail page this is.
  meta?: string;
} {
  switch (event.actionType) {
    case 'USER_CREATED':
      return { kind: 'lifecycle', text: 'Account created' };
    case 'USER_ACTIVATED':
      return { kind: 'lifecycle', text: 'Account activated' };
    case 'USER_DEACTIVATED':
      // Lifecycle category, but warn tone per the spec — deactivation is
      // a noteworthy event and benefits from the visual cue.
      return { kind: 'lifecycle-warn', text: 'Account deactivated' };
    case 'INVITATION_RESENT':
      return { kind: 'lifecycle', text: 'Invitation resent' };
    case 'ROLE_ADDED':
      return { kind: 'access', text: `Role "${rolePayloadName(event.payload)}" added` };
    case 'ROLE_REMOVED':
      return { kind: 'access', text: `Role "${rolePayloadName(event.payload)}" removed` };
    case 'PASSWORD_RESET_SENT':
      return { kind: 'security', text: 'Password reset link sent' };
    case 'MFA_RESET':
      return { kind: 'security', text: '2FA reset' };
    case 'GLOBAL_SIGNOUT':
      return { kind: 'security', text: 'Signed out of all sessions' };
    case 'SIGN_IN_FAILED_RUN': {
      const p = (event.payload ?? {}) as {
        attemptCount?: unknown;
        windowSeconds?: unknown;
      };
      const count = typeof p.attemptCount === 'number' ? p.attemptCount : 0;
      const windowText =
        typeof p.windowSeconds === 'number'
          ? `within ${formatWindowSeconds(p.windowSeconds)}`
          : null;
      const meta = windowText
        ? `${count} attempts · ${windowText}`
        : `${count} attempts`;
      return { kind: 'failed', text: 'Failed sign-in attempts', meta };
    }
    default:
      // Forward-compat: a brand-new actionType still renders. Use access
      // tone (★) since it reads as "something happened" without claiming
      // a category.
      return { kind: 'access', text: 'Activity' };
  }
}

const KIND_STYLES: Record<Kind, { glyph: string; bg: string; fg: string }> = {
  signin: { glyph: '→', bg: 'var(--bg-active)', fg: 'var(--fg-muted)' },
  access: {
    glyph: '★',
    bg: 'color-mix(in oklch, var(--accent-500) 14%, transparent)',
    fg: 'var(--accent-700)',
  },
  security: {
    glyph: '✓',
    bg: 'color-mix(in oklch, var(--success-500) 14%, transparent)',
    fg: 'var(--success-500)',
  },
  failed: {
    glyph: '!',
    bg: 'color-mix(in oklch, var(--warning-500) 14%, transparent)',
    fg: 'oklch(50% 0.16 78)',
  },
  lifecycle: {
    glyph: '+',
    bg: 'color-mix(in oklch, var(--violet-500) 14%, transparent)',
    fg: 'var(--violet-500)',
  },
  'lifecycle-warn': {
    glyph: '−',
    bg: 'color-mix(in oklch, var(--warning-500) 14%, transparent)',
    fg: 'oklch(50% 0.16 78)',
  },
};

function AccountActivityCard({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['account-activity', userId],
    queryFn: () => auditApi.getAccountActivity(userId),
  });

  // Backend already returns the curated 20-row feed newest-first. No
  // client-side slicing or de-duping — adjacent cascade rows are two
  // separate facts (mfa_reset + global_signout, deactivate + global_signout).
  const entries = data ?? [];

  return (
    <div className="rounded-[10px] border border-border bg-bg-elev">
      <div className="flex items-center justify-between gap-2.5 border-b border-border-soft px-3.5 py-2.5">
        <div>
          <div className="text-[13px] font-semibold text-fg-strong">Account activity</div>
          <div className="mt-0.5 text-[11px] text-fg-muted">
            Account-level events. Record edits appear on each record.
          </div>
        </div>
      </div>
      <div>
        {isLoading && (
          <div className="px-3.5 py-3 text-[11.5px] text-fg-muted">Loading activity…</div>
        )}
        {!isLoading && entries.length === 0 && (
          <div className="px-3.5 py-3 text-[11.5px] text-fg-muted">No activity recorded yet.</div>
        )}
        {entries.map((e, i) => {
          const cls = classifyEvent(e);
          const s = KIND_STYLES[cls.kind];
          // Per-event meta wins over the actor line. For sign-in runs the
          // meaningful sub-line is the attempt count + window; for everyone
          // else it's "By {actor}" when an actor is present.
          const subLine = cls.meta ?? (e.actor?.name ? `By ${e.actor.name}` : null);
          return (
            <div
              key={e.id}
              className={`grid grid-cols-[90px_22px_1fr] items-center gap-2.5 px-3.5 py-1.5 ${
                i < entries.length - 1 ? 'border-b border-border-soft' : ''
              }`}
            >
              <div className="text-[11px] text-fg-dim">{relTime(e.occurredAt)}</div>
              <div
                className="flex size-[18px] items-center justify-center rounded text-[11px] font-bold"
                style={{ background: s.bg, color: s.fg }}
              >
                {s.glyph}
              </div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[12.5px] text-fg-strong">{cls.text}</span>
                {subLine && (
                  <span className="text-[10.5px] text-fg-dim">· {subLine}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Lifecycle footer — Deactivate / Activate
// ──────────────────────────────────────────────────────────────────
function LifecycleFooter({
  user,
  onDeactivate,
  onActivate,
  pending,
}: {
  user: User;
  onDeactivate: () => void;
  onActivate: () => void;
  pending: boolean;
}) {
  const first = user.firstName;
  return (
    <div className="flex items-center gap-3.5 rounded-[10px] border border-border bg-bg-elev px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-fg-strong">
          {user.enabled ? `Deactivate ${first}` : `Reactivate ${first}`}
        </div>
        <div className="mt-0.5 text-[11.5px] leading-snug text-fg-muted">
          {user.enabled
            ? 'Revokes sign-in immediately. Audit history is preserved.'
            : 'Restores sign-in access. Existing roles and regions are kept as-is.'}
        </div>
      </div>
      <div>
        {user.enabled ? (
          <button
            onClick={onDeactivate}
            disabled={pending}
            className="inline-flex h-[26px] items-center rounded-md border bg-bg-elev px-2.5 text-[11.5px] font-semibold text-danger-500 hover:bg-bg-hover disabled:opacity-60"
            style={{
              borderColor: 'color-mix(in oklch, var(--danger-500) 35%, var(--border))',
            }}
          >
            Deactivate
          </button>
        ) : (
          <button
            onClick={onActivate}
            disabled={pending}
            className="inline-flex h-[26px] items-center rounded-md border border-border bg-bg-elev px-2.5 text-[11.5px] font-semibold text-fg-strong hover:bg-bg-hover disabled:opacity-60"
          >
            Reactivate
          </button>
        )}
      </div>
    </div>
  );
}
