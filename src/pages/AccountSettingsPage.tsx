/* eslint-disable i18next/no-literal-string -- dense v1.5 visual surface; key strings (titles, CTAs, errors) are wrapped via t() while inline labels and glyphs are kept as literals for readability — same convention as UserFormPage */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchMFAPreference, updateMFAPreference } from 'aws-amplify/auth';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import AppLayout from '../components/AppLayout';
import { Button } from '../components/catalyst/button';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useTheme } from '../components/ThemeProvider';
import { userApi, type User } from '../api';
import { roleColor } from '../utils/roleColor';
import ConfirmDialog from '../components/ConfirmDialog';
import ChangePasswordDialog from '../components/account/ChangePasswordDialog';
import TwoFactorSetupDialog from '../components/account/TwoFactorSetupDialog';

// Personal Account Settings — separate from company-wide Settings. The
// sidebar user popup links here. Phase 1 ships the visual redesign and
// keeps 2FA on Amplify-direct TOTP. SMS/email methods + server-issued
// recovery codes + code-gated disable land when backend's /auth/2fa/*
// endpoints are ready.
export default function AccountSettingsPage() {
  const { t } = useTranslation();
  const { data: currentUser, isLoading } = useCurrentUser();

  return (
    <AppLayout>
      <div className="mx-auto max-w-[760px] px-1 pb-16">
        <div className="mb-5">
          <h1 className="text-[22px] font-bold tracking-[-0.025em] text-fg-strong">
            {t('account.settings')}
          </h1>
          <div className="mt-1 text-[12.5px] text-fg-muted">
            {t('account.description')}
          </div>
        </div>

        {isLoading || !currentUser ? (
          <div className="rounded-[10px] border border-border bg-bg-elev p-6 text-[12.5px] text-fg-muted">
            {t('common.loading')}
          </div>
        ) : (
          <>
            <ProfileCard user={currentUser} />
            <div className="mt-3.5">
              <SecurityCard user={currentUser} />
            </div>
            <div className="mt-3.5">
              <PreferencesCard />
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

// ──────────────────────────────────────────────────────────────────
// Card / row primitives — tuned to match the design tokens used by
// the User Detail Security card so the two surfaces feel consistent.
// ──────────────────────────────────────────────────────────────────
function ACard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-border bg-bg-elev">
      <div className="border-b border-border-soft px-4 py-2.5">
        <div className="text-[13px] font-semibold text-fg-strong">{title}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ARow({
  label,
  children,
  right,
  last,
}: {
  label: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[140px_1fr_auto] items-center gap-3.5 py-2.5 ${
        last ? '' : 'border-b border-border-soft'
      }`}
    >
      <div className="text-[11.5px] font-medium text-fg-muted">{label}</div>
      <div className="min-w-0">{children}</div>
      <div>{right}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Profile card
// ──────────────────────────────────────────────────────────────────
function ProfileCard({ user }: { user: User }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phoneNumber ?? '');
  const [saveError, setSaveError] = useState('');

  // Browser-detected timezone — we don't store a per-user timezone yet,
  // so this is informational. Date/time displays already use the
  // browser's locale and zone, so this matches reality.
  const browserTz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown',
    []
  );

  const fullName = `${user.firstName} ${user.lastName}`.trim() || user.email;
  const initials = (() => {
    const f = user.firstName?.[0] ?? '';
    const l = user.lastName?.[0] ?? '';
    return `${f}${l}`.toUpperCase() || user.email.charAt(0).toUpperCase() || 'U';
  })();
  const avatarBg = roleColor(fullName);

  const dirty =
    firstName !== user.firstName ||
    lastName !== user.lastName ||
    (phone || '') !== (user.phoneNumber ?? '');

  const saveMutation = useMutation({
    mutationFn: () =>
      userApi.updateProfile(user.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phone.trim() || null,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['currentUser'], updated);
      setSaveError('');
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setSaveError(msg || t('account.profile.errorGeneric'));
    },
  });

  const handleReset = () => {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setPhone(user.phoneNumber ?? '');
    setSaveError('');
  };

  return (
    <ACard title="Profile">
      <div className="mb-4 flex items-center gap-4">
        <div
          className="grid size-14 shrink-0 place-items-center rounded-full text-[19px] font-semibold text-white"
          style={{
            background: avatarBg,
            border: `1px solid color-mix(in oklch, ${avatarBg} 70%, black)`,
          }}
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-fg-strong">{fullName}</div>
          <div className="mt-0.5 truncate text-[11.5px] text-fg-muted">{user.email}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border-soft pt-3.5">
        <AField label="First name">
          <ACInput value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </AField>
        <AField label="Last name">
          <ACInput value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </AField>
        <AField label="Phone">
          <ACInput
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-5555"
          />
        </AField>
        <AField label="Email" hint="contact your admin to change">
          <ACInput value={user.email} disabled />
        </AField>
        <AField label="Time zone" hint="detected from your browser">
          <ACInput value={browserTz} disabled />
        </AField>
      </div>

      {saveError && (
        <div className="mt-3 rounded-md border border-danger-500/30 bg-danger-500/8 px-3 py-2 text-[12px] text-danger-500">
          {saveError}
        </div>
      )}

      <div className="mt-3.5 flex justify-end gap-2">
        <Button outline size="xs" type="button" disabled={!dirty || saveMutation.isPending} onClick={handleReset}>
          {t('account.profile.reset')}
        </Button>
        <Button size="xs" type="button" disabled={!dirty || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? t('common.saving') : t('account.profile.save')}
        </Button>
      </div>
    </ACard>
  );
}

function AField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-1.5">
        <span className="text-[11px] font-semibold text-fg-strong">{label}</span>
        {hint && <span className="text-[10.5px] text-fg-dim">· {hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ACInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-8 w-full rounded-md border border-border bg-bg-elev px-2.5 text-[12.5px] text-fg-strong outline-none focus:border-accent-500 focus:ring-3 focus:ring-accent-500/20 disabled:bg-bg-elev-2 disabled:text-fg-muted ${props.className ?? ''}`}
    />
  );
}

// ──────────────────────────────────────────────────────────────────
// Security card — Password / 2FA / Sessions
//
// 2FA flows go through Amplify directly for now (TOTP only). When the
// backend ships /auth/2fa/{totp,sms,email} we replace the wizard with
// the method-picker + server-issued recovery codes flow. The Disable
// row uses a plain confirm — the design wants a fresh-code gate, but
// that requires the backend endpoint to validate the code; until then
// we'd be lying about what the check buys us.
// ──────────────────────────────────────────────────────────────────
function SecurityCard({ user }: { user: User }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [pwOpen, setPwOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const { data: mfa, refetch } = useQuery({
    queryKey: ['mfa-preference'],
    queryFn: fetchMFAPreference,
  });

  const isOn = useMemo(() => {
    if (!mfa) return false;
    return mfa.enabled?.includes('TOTP') || mfa.preferred === 'TOTP';
  }, [mfa]);

  const disableMutation = useMutation({
    mutationFn: () => updateMFAPreference({ totp: 'DISABLED' }),
    onSuccess: () => refetch(),
  });

  const signOutMutation = useMutation({
    mutationFn: () => userApi.signOutEverywhere(user.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-activity', user.id] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      window.alert(msg || t('account.security.sessionsSignOutError'));
    },
  });

  return (
    <>
      <ACard title={t('account.security.title')}>
        {/* Password */}
        <ARow
          label={t('account.security.passwordLabel')}
          right={
            <Button outline size="xs" type="button" onClick={() => setPwOpen(true)}>
              {t('account.security.passwordChange')}
            </Button>
          }
        >
          <div className="text-[12.5px] text-fg-strong">{t('account.security.passwordValue')}</div>
          <div className="mt-0.5 text-[11px] text-fg-dim">
            {t('account.security.passwordHint')}
          </div>
        </ARow>

        {/* 2FA */}
        {isOn ? (
          <ARow
            label={t('account.security.twofaRowLabel')}
            right={
              <Button outline size="xs" type="button" onClick={() => setDisableOpen(true)}>
                {t('account.security.disableLabel')}
              </Button>
            }
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-[4px] bg-success-500/14 px-2 py-0.5 text-[11px] font-bold tracking-wider text-success-500">
                <span className="mr-1">●</span>
                {t('account.security.twofaOnPill')}
              </span>
              <span className="text-[12.5px] text-fg-strong">{t('account.security.twofaOnMethod')}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-fg-dim">
              {t('account.security.twofaOnHint')}
            </div>
          </ARow>
        ) : (
          <div className="my-2">
            <div className="grid grid-cols-[36px_1fr_auto] items-center gap-3.5 rounded-lg border border-accent-500/22 bg-accent-500/5 px-4 py-3.5">
              <div className="grid size-9 place-items-center rounded-lg bg-accent-500 text-white">
                <ShieldCheckIcon className="size-[18px]" />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-fg-strong">
                  {t('account.security.twofaCtaTitle')}
                </div>
                <div className="mt-0.5 text-[11.5px] leading-relaxed text-fg-muted">
                  {t('account.security.twofaCtaDescription')}
                </div>
              </div>
              <Button size="xs" type="button" onClick={() => setSetupOpen(true)}>
                {t('account.security.enable')}
              </Button>
            </div>
          </div>
        )}

        {/* Sessions */}
        <ARow
          label={t('account.security.sessionsLabel')}
          last
          right={
            <Button
              outline
              size="xs"
              type="button"
              onClick={() => setSignOutOpen(true)}
              disabled={signOutMutation.isPending}
            >
              {signOutMutation.isPending
                ? t('account.security.sessionsSignOutPending')
                : t('account.security.sessionsSignOutSubmit')}
            </Button>
          }
        >
          <div className="text-[12.5px] text-fg-strong">{t('account.security.sessionsValue')}</div>
          <div className="mt-0.5 text-[11px] text-fg-dim">
            {t('account.security.sessionsHint')}
          </div>
        </ARow>
      </ACard>

      <ChangePasswordDialog isOpen={pwOpen} onClose={() => setPwOpen(false)} />
      <TwoFactorSetupDialog
        isOpen={setupOpen}
        onClose={() => setSetupOpen(false)}
        onEnabled={() => refetch()}
        email={user.email}
      />
      <ConfirmDialog
        isOpen={disableOpen}
        onClose={() => setDisableOpen(false)}
        onConfirm={() => disableMutation.mutate()}
        title={t('account.security.disableConfirmTitle')}
        message={t('account.security.disableConfirmMessage')}
        confirmLabel={t('account.security.disableSubmit')}
        isDestructive
      />
      <ConfirmDialog
        isOpen={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        onConfirm={() => signOutMutation.mutate()}
        title={t('account.security.sessionsSignOutConfirmTitle')}
        message={t('account.security.sessionsSignOutConfirmMessage')}
        confirmLabel={t('account.security.sessionsSignOutSubmit')}
        isDestructive
      />
    </>
  );
}

// ──────────────────────────────────────────────────────────────────
// Preferences card — mirrors the chips already in the sidebar user
// popup. The popup keeps them for fast access; this surface is the
// canonical place if a user goes looking for it.
//
// ThemeProvider exposes 'light' | 'dark' only. The design includes a
// "System" chip; we'll wire it up once the provider gains a follow-system
// mode. Until then, two chips is honest.
// ──────────────────────────────────────────────────────────────────
function PreferencesCard() {
  const { t } = useTranslation();
  const { mode, accent, setMode, setAccent } = useTheme();

  return (
    <ACard title={t('account.preferences.title')}>
      <ARow label={t('account.preferences.theme')}>
        <div className="flex flex-wrap gap-1.5">
          <PrefChip
            active={mode === 'light'}
            onClick={() => setMode('light')}
            label={t('account.preferences.themeLight')}
            glyph="☀"
          />
          <PrefChip
            active={mode === 'dark'}
            onClick={() => setMode('dark')}
            label={t('account.preferences.themeDark')}
            glyph="☾"
          />
        </div>
      </ARow>
      <ARow label={t('account.preferences.accent')} last>
        <div className="flex flex-wrap gap-1.5">
          <PrefChip
            active={accent === 'warm'}
            onClick={() => setAccent('warm')}
            label={t('account.preferences.accentWarm')}
            swatch="oklch(68% 0.185 50)"
          />
          <PrefChip
            active={accent === 'cool'}
            onClick={() => setAccent('cool')}
            label={t('account.preferences.accentCool')}
            swatch="oklch(56% 0.125 215)"
          />
        </div>
      </ARow>
    </ACard>
  );
}

function PrefChip({
  active,
  onClick,
  label,
  glyph,
  swatch,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  glyph?: string;
  swatch?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border-[1.5px] px-3 py-1.5 text-[12px] transition-colors ${
        active
          ? 'border-accent-500 bg-accent-500/10 font-semibold text-fg-strong'
          : 'border-border bg-bg-elev-2 text-fg-muted hover:bg-bg-hover'
      }`}
    >
      {swatch ? (
        <span
          className="inline-block size-2.5 rounded-full ring-1 ring-black/10"
          style={{ background: swatch }}
        />
      ) : (
        glyph && <span aria-hidden="true">{glyph}</span>
      )}
      <span>{label}</span>
    </button>
  );
}
