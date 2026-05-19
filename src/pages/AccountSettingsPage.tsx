/* eslint-disable i18next/no-literal-string -- dense v1.5 visual surface; key strings (titles, CTAs, errors) are wrapped via t() while inline labels and glyphs are kept as literals — same convention as UserFormPage */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchMFAPreference, updateMFAPreference } from 'aws-amplify/auth';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import AppLayout from '../components/AppLayout';
import { Button } from '../components/catalyst/button';
import { Card } from '../components/catalyst/card';
import { DataRow } from '../components/catalyst/data-row';
import { ErrorMessage, Field, Label } from '../components/catalyst/fieldset';
import { Heading } from '../components/catalyst/heading';
import { Input } from '../components/catalyst/input';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useTheme } from '../components/ThemeProvider';
import { userApi, type User } from '../api';
import { roleColor } from '../utils/roleColor';
import { showError, showSuccess, extractApiError } from '../lib/toast';
import { Callout } from '../components/ui/Callout';
import { ToggleGroup, ToggleGroupOption } from '../components/ui/ToggleGroup';
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
          <Heading>{t('account.settings')}</Heading>
        </div>

        {isLoading || !currentUser ? (
          <Card>{t('common.loading')}</Card>
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
      showSuccess('Profile updated');
    },
    onError: (err: unknown) => {
      setSaveError(extractApiError(err) || t('account.profile.errorGeneric'));
    },
  });

  const handleReset = () => {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setPhone(user.phoneNumber ?? '');
    setSaveError('');
  };

  return (
    <Card title={t('account.profile.title')}>
      <div className="mb-4 flex items-center gap-4">
        {/* TODO(design-system): replace this tinted-initials block with a
            Catalyst `<Avatar>` extension that supports a deterministic
            tinted background (currently Avatar takes a src; we need a
            colored-initials variant). */}
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
        <Field size="xs">
          <Label size="xs">First name</Label>
          <Input size="xs" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field size="xs">
          <Label size="xs">Last name</Label>
          <Input size="xs" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
        <Field size="xs">
          <Label size="xs">Phone</Label>
          <Input
            size="xs"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-5555"
          />
        </Field>
        <Field size="xs">
          <Label size="xs" hint="contact your admin to change">Email</Label>
          <Input size="xs" value={user.email} disabled />
        </Field>
        <Field size="xs">
          <Label size="xs" hint="detected from your browser">Time zone</Label>
          <Input size="xs" value={browserTz} disabled />
        </Field>
      </div>

      {saveError && (
        <Field size="xs" className="mt-3">
          <ErrorMessage size="xs">{saveError}</ErrorMessage>
        </Field>
      )}

      <div className="mt-3.5 flex justify-end gap-2">
        <Button outline size="xs" type="button" disabled={!dirty || saveMutation.isPending} onClick={handleReset}>
          {t('account.profile.reset')}
        </Button>
        <Button size="xs" type="button" disabled={!dirty || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? t('common.saving') : t('account.profile.save')}
        </Button>
      </div>
    </Card>
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
    onSuccess: () => {
      refetch();
      showSuccess('Two-factor disabled');
    },
    onError: (err: unknown) =>
      showError("Couldn't disable two-factor", extractApiError(err)),
  });

  const signOutMutation = useMutation({
    mutationFn: () => userApi.signOutEverywhere(user.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-activity', user.id] });
      showSuccess('Signed out of all sessions');
    },
    onError: (err: unknown) =>
      showError(t('account.security.sessionsSignOutError'), extractApiError(err)),
  });

  return (
    <>
      <Card title={t('account.security.title')} padding="none">
        {/* Password */}
        <DataRow
          label={t('account.security.passwordLabel')}
          action={
            <Button outline size="xs" type="button" onClick={() => setPwOpen(true)}>
              {t('account.security.passwordChange')}
            </Button>
          }
        >
          <div className="text-[12.5px] text-fg-strong">{t('account.security.passwordValue')}</div>
          <div className="mt-0.5 text-[11px] text-fg-dim">
            {t('account.security.passwordHint')}
          </div>
        </DataRow>

        {/* 2FA */}
        {isOn ? (
          <DataRow
            label={t('account.security.twofaRowLabel')}
            action={
              <Button outline size="xs" type="button" onClick={() => setDisableOpen(true)}>
                {t('account.security.disableLabel')}
              </Button>
            }
          >
            <div className="flex items-center gap-2">
              {/* TODO(design-system): replace inline "ON" pill with
                  `<Badge color="green" size="xs">` once Badge gains an
                  xs size variant. */}
              <span className="inline-flex items-center rounded-[4px] bg-success-500/14 px-2 py-0.5 text-[11px] font-bold tracking-wider text-success-500">
                <span className="mr-1">●</span>
                {t('account.security.twofaOnPill')}
              </span>
              <span className="text-[12.5px] text-fg-strong">{t('account.security.twofaOnMethod')}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-fg-dim">
              {t('account.security.twofaOnHint')}
            </div>
          </DataRow>
        ) : (
          <div className="my-2 px-3.5">
            <Callout
              kind="accent"
              icon={
                <div className="grid size-9 place-items-center rounded-lg bg-accent-500 text-white">
                  <ShieldCheckIcon className="size-[18px]" />
                </div>
              }
              title={t('account.security.twofaCtaTitle')}
              action={
                <Button size="xs" type="button" onClick={() => setSetupOpen(true)}>
                  {t('account.security.enable')}
                </Button>
              }
            >
              {t('account.security.twofaCtaDescription')}
            </Callout>
          </div>
        )}

        {/* Sessions */}
        <DataRow
          label={t('account.security.sessionsLabel')}
          last
          action={
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
        </DataRow>
      </Card>

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
    <Card title={t('account.preferences.title')} padding="none">
      <DataRow label={t('account.preferences.theme')}>
        <ToggleGroup value={mode} onChange={setMode} aria-label={t('account.preferences.theme')}>
          <ToggleGroupOption value="light">
            <span aria-hidden="true">☀</span>
            {t('account.preferences.themeLight')}
          </ToggleGroupOption>
          <ToggleGroupOption value="dark">
            <span aria-hidden="true">☾</span>
            {t('account.preferences.themeDark')}
          </ToggleGroupOption>
        </ToggleGroup>
      </DataRow>
      <DataRow label={t('account.preferences.accent')} last>
        <ToggleGroup value={accent} onChange={setAccent} aria-label={t('account.preferences.accent')}>
          <ToggleGroupOption value="warm">
            <Swatch color="oklch(68% 0.185 50)" />
            {t('account.preferences.accentWarm')}
          </ToggleGroupOption>
          <ToggleGroupOption value="cool">
            <Swatch color="oklch(56% 0.125 215)" />
            {t('account.preferences.accentCool')}
          </ToggleGroupOption>
        </ToggleGroup>
      </DataRow>
    </Card>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-2.5 rounded-full ring-1 ring-black/10"
      style={{ background: color }}
      aria-hidden="true"
    />
  );
}
