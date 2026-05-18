/* eslint-disable i18next/no-literal-string -- dense v1.5 visual form; key strings are wrapped via t() but inline glyphs/separators/labels are kept as literals to keep the form markup readable */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronRightIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { userApi, dispatchRegionApi, type Role } from '../api';

// Above this many roles, the role grid switches on a search field and
// pins selected roles to the top so they don't scroll out of view.
// Below it, every role is visible at once — the grid IS the summary,
// no search needed.
const SEARCH_THRESHOLD = 10;

const ROLE_HUES = [25, 200, 270, 150, 85, 215, 320, 50, 240];
function roleAccent(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const hue = ROLE_HUES[Math.abs(h) % ROLE_HUES.length];
  if (/admin/i.test(name)) return 'oklch(55% 0.18 25)';
  return `oklch(60% 0.14 ${hue})`;
}

interface UserFormPageProps {
  mode: 'invite' | 'edit';
}

export default function UserFormPage({ mode }: UserFormPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const isInvite = mode === 'invite';

  const { data: existingUser, isLoading: loadingUser } = useQuery({
    queryKey: ['users', id],
    queryFn: () => userApi.getById(id!),
    enabled: !isInvite && !!id,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => userApi.getRoles(),
  });

  const { data: activeRegions = [] } = useQuery({
    queryKey: ['dispatch-regions', 'active'],
    queryFn: () => dispatchRegionApi.getAll(false),
  });

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    roleIds: [] as string[],
    dispatchRegionIds: [] as string[],
  });
  const [sendInvite, setSendInvite] = useState(true);

  useEffect(() => {
    if (isInvite) return;
    if (!existingUser) return;
    // Seed the form from the loaded user. This is the recommended
    // pattern for initializing controlled forms — we intentionally set
    // state inside an effect because the source-of-truth (existingUser)
    // is asynchronous.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData({
      firstName: existingUser.firstName,
      lastName: existingUser.lastName,
      email: existingUser.email,
      phoneNumber: existingUser.phoneNumber ?? '',
      roleIds: existingUser.roles?.map((r) => r.id) ?? [],
      dispatchRegionIds: existingUser.dispatchRegionIds ?? [],
    });
  }, [existingUser, isInvite]);

  // Live "effective capabilities" — union of capability lists across
  // every selected role, grouped by feature area. Memoized off the
  // role list so toggling a checkbox doesn't recompute when nothing
  // structural changed. The grid shows ROLE_CAPS per-role; the form
  // computes the union for the live summary line in the footer.
  const effective = useMemo(() => {
    const selected = roles.filter((r) => formData.roleIds.includes(r.id));
    const all = new Set<string>();
    for (const r of selected) {
      for (const c of r.capabilities ?? []) all.add(c);
    }
    return { count: all.size, set: all, roles: selected };
  }, [roles, formData.roleIds]);

  const createMutation = useMutation({
    mutationFn: () =>
      userApi.create({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        roleIds: formData.roleIds,
        dispatchRegionIds: formData.dispatchRegionIds,
        phoneNumber: formData.phoneNumber.trim() || null,
        sendInvite,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      navigate(`/settings/access/users/${created.id}`);
    },
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      alert(errorMessage || t('common.form.errorCreate', { entity: t('entities.user') }));
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: () =>
      userApi.updateProfile(id!, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber.trim() || null,
      }),
    onError: (error: unknown) => {
      const errorMessage =
        error instanceof Error && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      alert(errorMessage || t('common.form.errorUpdate', { entity: t('entities.user') }));
    },
  });

  const updateRolesMutation = useMutation({
    mutationFn: () => userApi.updateRoles(id!, { roleIds: formData.roleIds }),
    onError: () => alert('Failed to update user roles'),
  });

  const updateRegionsMutation = useMutation({
    mutationFn: () =>
      userApi.updateRegions(id!, { dispatchRegionIds: formData.dispatchRegionIds }),
    onError: () => alert('Failed to update user dispatch regions'),
  });

  const submitting =
    createMutation.isPending ||
    updateProfileMutation.isPending ||
    updateRolesMutation.isPending ||
    updateRegionsMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.roleIds.length === 0) {
      alert(t('users.form.roleRequired'));
      return;
    }

    if (isInvite) {
      createMutation.mutate();
      return;
    }

    try {
      await updateProfileMutation.mutateAsync();
      await updateRolesMutation.mutateAsync();
      await updateRegionsMutation.mutateAsync();
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', id] });
      navigate(`/settings/access/users/${id}`);
    } catch {
      // mutation onError handlers already alerted
    }
  };

  const toggleRole = (roleId: string) => {
    setFormData((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter((r) => r !== roleId)
        : [...prev.roleIds, roleId],
    }));
  };

  const toggleRegion = (regionId: string) => {
    setFormData((prev) => ({
      ...prev,
      dispatchRegionIds: prev.dispatchRegionIds.includes(regionId)
        ? prev.dispatchRegionIds.filter((r) => r !== regionId)
        : [...prev.dispatchRegionIds, regionId],
    }));
  };

  const cancelHref = isInvite
    ? '/settings/access/users'
    : `/settings/access/users/${id}`;

  if (!isInvite && loadingUser) {
    return <div className="p-8 text-[12.5px] text-fg-muted">Loading…</div>;
  }

  const headerName = isInvite
    ? 'Invite user'
    : existingUser
      ? `Edit ${existingUser.firstName} ${existingUser.lastName}`
      : 'Edit user';

  return (
    <div className="-mx-6 -my-6 flex h-[calc(100svh-52px)] min-h-0 flex-col max-lg:-mx-4 max-lg:-my-4">
      <form
        id="user-form"
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex-1 overflow-y-auto px-7 pb-6 pt-5">
          <div className="mx-auto max-w-[720px]">
            <Link
              to={cancelHref}
              className="mb-2.5 inline-flex items-center gap-1 text-[11.5px] text-fg-muted hover:text-fg-strong"
            >
              ←{' '}
              {isInvite
                ? `All ${t('entities.users').toLowerCase()}`
                : existingUser
                  ? `${existingUser.firstName} ${existingUser.lastName}`
                  : 'Back'}
            </Link>

            <div className="mb-3.5">
              <h1 className="m-0 text-[20px] font-bold tracking-[-0.022em] text-fg-strong">
                {headerName}
              </h1>
              {isInvite && (
                <div className="mt-0.5 text-[12px] text-fg-muted">
                  An invitation email goes out on save. Link is valid 7 days.
                </div>
              )}
            </div>

            <FormCard title="Identity">
              <div className="grid grid-cols-2 gap-2.5">
                <FieldLabel label="First name" required>
                  <Input
                    value={formData.firstName}
                    onChange={(v) => setFormData((p) => ({ ...p, firstName: v }))}
                    placeholder="Maria"
                    required
                  />
                </FieldLabel>
                <FieldLabel label="Last name" required>
                  <Input
                    value={formData.lastName}
                    onChange={(v) => setFormData((p) => ({ ...p, lastName: v }))}
                    placeholder="Chen"
                    required
                  />
                </FieldLabel>
              </div>
              <div className="mt-2.5">
                <FieldLabel
                  label="Email"
                  required
                  hint={!isInvite ? 'sign-in · cannot change' : undefined}
                >
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(v) => setFormData((p) => ({ ...p, email: v }))}
                    placeholder="maria@yourcompany.com"
                    disabled={!isInvite}
                    required
                  />
                </FieldLabel>
              </div>
              <div className="mt-2.5 grid grid-cols-[1fr_1.4fr] gap-2.5">
                <FieldLabel label="Phone">
                  <Input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(v) => setFormData((p) => ({ ...p, phoneNumber: v }))}
                    placeholder="(555) 123-4567"
                  />
                </FieldLabel>
              </div>
            </FormCard>

            <FormCard
              title="Roles"
              subtitle={
                <>
                  Pick one role for most users. Multiple roles combine their capabilities.{' '}
                  <Link
                    to="/settings/access/roles"
                    className="font-medium text-accent-700 hover:underline"
                  >
                    Manage roles →
                  </Link>
                </>
              }
            >
              <RoleMultiSelect
                roles={roles}
                selected={formData.roleIds}
                onToggle={toggleRole}
                onClear={() =>
                  setFormData((p) => ({ ...p, roleIds: [] }))
                }
              />
              <CapabilityPreview
                effective={effective}
                selectedCount={formData.roleIds.length}
              />
            </FormCard>

            <FormCard
              title="Regions"
              subtitle="Where in the world this user works. Limits which records they see."
            >
              <RegionMultiSelect
                regions={activeRegions}
                selected={formData.dispatchRegionIds}
                onToggle={toggleRegion}
              />
              {formData.dispatchRegionIds.length === 0 && (
                <div
                  className="mt-2.5 rounded-md border px-2.5 py-1.5 text-[11.5px]"
                  style={{
                    background: 'color-mix(in oklch, var(--warning-500) 8%, transparent)',
                    borderColor:
                      'color-mix(in oklch, var(--warning-500) 25%, var(--border))',
                    color: 'oklch(50% 0.16 78)',
                  }}
                >
                  ⚠ No regions selected — this user won't see any records until you assign at
                  least one.
                </div>
              )}
            </FormCard>

            {isInvite && (
              <label className="mt-2 flex items-center gap-2 px-1 text-[11.5px] text-fg-muted">
                <input
                  type="checkbox"
                  checked={sendInvite}
                  onChange={(e) => setSendInvite(e.target.checked)}
                  className="size-3.5 accent-[var(--accent-500)]"
                />
                <span>
                  Send invitation email to{' '}
                  <strong className="text-fg-strong">
                    {formData.email || 'their address'}
                  </strong>{' '}
                  on save
                </span>
              </label>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2 border-t border-border bg-bg-elev px-7 py-3 max-lg:px-4">
          <div className="text-[11.5px] text-fg-muted">
            {isInvite ? (
              <>
                Creates{' '}
                <strong className="text-fg-strong">
                  {formData.roleIds.length} role{formData.roleIds.length !== 1 && 's'}
                </strong>{' '}
                · {formData.dispatchRegionIds.length} region
                {formData.dispatchRegionIds.length !== 1 && 's'} · {effective.count} capabilities
              </>
            ) : (
              <>Role changes take effect on next sign-in.</>
            )}
          </div>
          <span className="flex-1" />
          <Link
            to={cancelHref}
            className="inline-flex h-[30px] items-center rounded-md px-3 text-[12.5px] font-semibold text-fg-muted hover:bg-bg-hover hover:text-fg-strong"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || (isInvite && formData.roleIds.length === 0)}
            className="inline-flex h-[30px] items-center gap-1.5 rounded-md border border-accent-700/80 bg-gradient-to-b from-accent-500 to-accent-600 px-3 text-[12.5px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.18)] hover:from-accent-400 hover:to-accent-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting
              ? t('common.saving')
              : isInvite
                ? 'Send invitation'
                : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Local primitives — kept inline to keep the v1.5 visual exactly as
// the design (compact card headers, thin field labels, dense grid)
// without dragging the rest of the app's Field/Label/Input toward
// these tighter dimensions.
// ──────────────────────────────────────────────────────────────────

function FormCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 rounded-[10px] border border-border bg-bg-elev">
      <div className="flex items-center justify-between gap-2.5 border-b border-border-soft px-3.5 py-2.5">
        <div>
          <div className="text-[12.5px] font-semibold text-fg-strong">{title}</div>
          {subtitle && <div className="mt-0.5 text-[11px] text-fg-muted">{subtitle}</div>}
        </div>
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

function FieldLabel({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-1.5">
        <span className="text-[11px] font-semibold text-fg-strong">{label}</span>
        {required && <span className="text-[11px] text-danger-500">*</span>}
        {hint && <span className="text-[10.5px] text-fg-dim">· {hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className="block h-8 w-full rounded-md border border-border bg-bg-elev px-2.5 text-[12.5px] text-fg-strong outline-none placeholder:text-fg-dim focus:border-accent-500 focus:ring-[3px] focus:ring-accent-500/20 disabled:cursor-not-allowed disabled:bg-bg-elev-2 disabled:text-fg-muted"
    />
  );
}

// ──────────────────────────────────────────────────────────────────
// RoleMultiSelect — 3-col checkbox grid. Search appears only when
// roles.length > 10; below that, the grid is the summary.
// ──────────────────────────────────────────────────────────────────
function RoleMultiSelect({
  roles,
  selected,
  onToggle,
  onClear,
}: {
  roles: Role[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const needsSearch = roles.length > SEARCH_THRESHOLD;
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!needsSearch) return roles;
    const q = query.toLowerCase();
    return roles.filter((r) => r.name.toLowerCase().includes(q));
  }, [roles, query, needsSearch]);

  const displayed = useMemo(() => {
    if (!needsSearch) return filtered;
    // Pin selected roles to the top so they stay visible while searching.
    return [...filtered].sort((a, b) => {
      const aSel = selected.includes(a.id) ? 1 : 0;
      const bSel = selected.includes(b.id) ? 1 : 0;
      return bSel - aSel;
    });
  }, [filtered, selected, needsSearch]);

  return (
    <div>
      {needsSearch && (
        <div className="relative mb-2.5">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-fg-dim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${roles.length} roles…`}
            className="block h-7 w-full rounded-md border border-border bg-bg-elev pl-7 pr-2.5 text-[12px] text-fg-strong outline-none focus:border-accent-500"
          />
        </div>
      )}

      {displayed.length === 0 ? (
        <div className="rounded-md border border-border-soft bg-bg-elev-2 px-3 py-3.5 text-center text-[11.5px] text-fg-muted">
          No roles match "{query}".{' '}
          <Link
            to="/settings/access/roles"
            className="font-medium text-accent-700 hover:underline"
          >
            Create role →
          </Link>
        </div>
      ) : (
        <div
          className={`grid grid-cols-3 gap-1.5 ${
            needsSearch ? 'max-h-[240px] overflow-y-auto p-0.5' : ''
          }`}
        >
          {displayed.map((role) => {
            const on = selected.includes(role.id);
            const capCount = role.capabilities?.length ?? 0;
            const color = roleAccent(role.name);
            return (
              <label
                key={role.id}
                className="grid cursor-pointer grid-cols-[16px_1fr_auto] items-center gap-2 rounded-md border px-2.5 py-1.5"
                style={{
                  background: on
                    ? 'color-mix(in oklch, var(--accent-500) 7%, var(--bg-elev-2))'
                    : 'var(--bg-elev-2)',
                  borderColor: on
                    ? 'color-mix(in oklch, var(--accent-500) 25%, var(--border))'
                    : 'var(--border-soft)',
                }}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggle(role.id)}
                  className="size-3.5 accent-[var(--accent-500)]"
                />
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="size-1.5 flex-shrink-0 rounded-full"
                    style={{ background: color }}
                  />
                  <span
                    className={`truncate text-[12px] text-fg-strong ${on ? 'font-semibold' : 'font-medium'}`}
                  >
                    {role.name}
                  </span>
                </span>
                <span className="font-mono text-[10px] tabular-nums text-fg-dim">
                  {capCount}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {selected.length > 1 && (
        <div className="mt-2 text-right">
          <button
            type="button"
            onClick={onClear}
            className="bg-transparent p-0 text-[11px] text-fg-muted hover:text-fg-strong"
          >
            Clear all {selected.length}
          </button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// CapabilityPreview — live readout, expandable. Lives below the role
// grid so the admin can see what they're granting before they save.
// ──────────────────────────────────────────────────────────────────
function CapabilityPreview({
  effective,
  selectedCount,
}: {
  effective: { count: number; set: Set<string>; roles: Role[] };
  selectedCount: number;
}) {
  const [open, setOpen] = useState(false);
  const { data: groupedData } = useQuery({
    queryKey: ['capabilities', 'grouped'],
    queryFn: () => userApi.getGroupedCapabilities(),
    enabled: open,
  });

  if (selectedCount === 0) {
    return (
      <div
        className="mt-2.5 rounded-md border px-2.5 py-2 text-[11.5px]"
        style={{
          background: 'color-mix(in oklch, var(--danger-500) 7%, transparent)',
          borderColor: 'color-mix(in oklch, var(--danger-500) 25%, var(--border))',
          color: 'var(--danger-500)',
        }}
      >
        Pick at least one role. The user can't sign in with zero roles.
      </div>
    );
  }

  // Group capabilities by area when expanded.
  const byArea =
    open && groupedData
      ? groupedData.groups
          .map((g) => ({
            area: g.displayName,
            caps: g.capabilities.filter((c) => effective.set.has(c.name)),
          }))
          .filter((g) => g.caps.length > 0)
      : [];

  return (
    <div className="mt-2.5 rounded-md border border-border-soft bg-bg-elev-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[11.5px]"
      >
        <ChevronRightIcon
          className={`size-3.5 text-fg-dim transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span className="text-fg-muted">Effective capabilities:</span>
        <span className="font-mono font-semibold tabular-nums text-fg-strong">
          {effective.count}
        </span>
        <span className="text-fg-muted">
          across{' '}
          <span className="font-semibold text-fg-strong">{byArea.length || '—'}</span> areas
        </span>
        <span className="flex-1" />
        <span className="text-[10.5px] font-medium text-accent-700">
          {open ? 'Hide' : 'Show'} details
        </span>
      </button>
      {open && (
        <div className="max-h-[220px] overflow-y-auto border-t border-dashed border-border-soft p-2.5">
          {!groupedData ? (
            <div className="text-[11.5px] text-fg-muted">Loading capabilities…</div>
          ) : (
            byArea.map((g, i) => (
              <div key={g.area} className={i < byArea.length - 1 ? 'mb-2.5' : ''}>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                  {g.area} · {g.caps.length}
                </div>
                <div className="flex flex-wrap gap-1">
                  {g.caps.map((c) => (
                    <span
                      key={c.name}
                      title={c.description}
                      className="rounded border px-1.5 py-[2px] text-[10.5px] text-fg-strong"
                      style={{
                        background: 'color-mix(in oklch, var(--accent-500) 8%, var(--bg-elev))',
                        borderColor:
                          'color-mix(in oklch, var(--accent-500) 20%, var(--border))',
                      }}
                    >
                      {c.displayName}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// RegionMultiSelect — chip-style toggles. Selected chips fill with
// accent; unselected sit on the nested-card surface.
// ──────────────────────────────────────────────────────────────────
function RegionMultiSelect({
  regions,
  selected,
  onToggle,
}: {
  regions: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (regions.length === 0) {
    return (
      <div className="text-[11.5px] text-fg-muted">
        No active dispatch regions configured.{' '}
        <Link
          to="/settings/dispatch-regions"
          className="font-medium text-accent-700 hover:underline"
        >
          Manage regions →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {regions.map((r) => {
        const on = selected.includes(r.id);
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onToggle(r.id)}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium"
            style={{
              background: on
                ? 'color-mix(in oklch, var(--accent-500) 12%, var(--bg-elev))'
                : 'var(--bg-elev-2)',
              color: on ? 'var(--fg-strong)' : 'var(--fg-muted)',
              border: `1px solid ${
                on ? 'color-mix(in oklch, var(--accent-500) 30%, var(--border))' : 'var(--border)'
              }`,
            }}
          >
            <span
              className="inline-flex size-3 items-center justify-center rounded-[3px] text-[9px] font-bold text-white"
              style={{
                background: on ? 'var(--accent-500)' : 'transparent',
                border: `1.2px solid ${on ? 'var(--accent-500)' : 'var(--border-strong)'}`,
              }}
            >
              {on && '✓'}
            </span>
            {r.name}
          </button>
        );
      })}
    </div>
  );
}

// Route wrappers — keep route definitions clean so we don't have to
// thread `mode` through every <Route element={...}> declaration.
export function UserInvitePage() {
  return <UserFormPage mode="invite" />;
}

export function UserEditPage() {
  return <UserFormPage mode="edit" />;
}
