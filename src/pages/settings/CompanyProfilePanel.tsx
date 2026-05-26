import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PatternFormat } from 'react-number-format';
import {
  tenantSettingsApi,
  getApiErrorMessage,
  type UpdateTenantSettingsRequest,
} from '../../api';
import { useHasCapability } from '../../hooks/useCurrentUser';
import { Text } from '../../components/catalyst/text';
import { Input } from '../../components/catalyst/input';
import { Select } from '../../components/catalyst/select';
import { US_STATES } from '../../constants/states';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';
import { SettingsSection } from '../../components/settings/SettingsSection';
import { FieldLabel, FieldValue } from '../../components/settings/FieldLabel';

type CompanyFormData = Pick<
  UpdateTenantSettingsRequest,
  | 'companyName'
  | 'companyNameShort'
  | 'companySlogan'
  | 'streetAddress'
  | 'city'
  | 'state'
  | 'zipCode'
  | 'phone'
  | 'email'
>;

function emptyForm(): CompanyFormData {
  return {
    companyName: '',
    companyNameShort: '',
    companySlogan: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: '',
    phone: '',
    email: '',
  };
}

function formatLogoFilename(url?: string | null): string | null {
  if (!url) return null;
  try {
    const path = new URL(url).pathname;
    const segment = path.split('/').filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : null;
  } catch {
    return null;
  }
}

function formatLogoMeta(updatedAt?: string | null): string | null {
  if (!updatedAt) return null;
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CompanyProfilePanel() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const canEdit = useHasCapability('EDIT_SETTINGS');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<CompanyFormData>(emptyForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => tenantSettingsApi.getSettings(),
  });

  useEffect(() => {
    if (settings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        companyName: settings.companyName ?? '',
        companyNameShort: settings.companyNameShort ?? '',
        companySlogan: settings.companySlogan ?? '',
        streetAddress: settings.streetAddress ?? '',
        city: settings.city ?? '',
        state: settings.state ?? '',
        zipCode: settings.zipCode ?? '',
        phone: settings.phone ?? '',
        email: settings.email ?? '',
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateTenantSettingsRequest) => tenantSettingsApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      setIsEditing(false);
    },
    onError: (error: unknown) => {
      alert(getApiErrorMessage(error) || t('tenantSettings.messages.errorUpdateSettings'));
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: (file: File) => tenantSettingsApi.uploadLogo(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      setLogoFile(null);
      setLogoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (error: unknown) => {
      alert(getApiErrorMessage(error) || t('tenantSettings.messages.errorUploadLogo'));
    },
  });

  const handleChange = (field: keyof CompanyFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (settings) {
      setFormData({
        companyName: settings.companyName ?? '',
        companyNameShort: settings.companyNameShort ?? '',
        companySlogan: settings.companySlogan ?? '',
        streetAddress: settings.streetAddress ?? '',
        city: settings.city ?? '',
        state: settings.state ?? '',
        zipCode: settings.zipCode ?? '',
        phone: settings.phone ?? '',
        email: settings.email ?? '',
      });
    }
    setLogoFile(null);
    setLogoPreview(null);
    setIsEditing(false);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert(t('tenantSettings.messages.fileSizeTooLarge'));
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
      alert(t('tenantSettings.messages.invalidFileType'));
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
    uploadLogoMutation.mutate(file);
  };

  const handleLogoRemove = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerLogoPicker = () => {
    fileInputRef.current?.click();
  };

  if (isLoading) {
    return <Text className="text-fg-muted">{t('tenantSettings.messages.loadingSettings')}</Text>;
  }

  if (error) {
    return (
      <Text className="text-danger-500">
        {getApiErrorMessage(error) || t('tenantSettings.messages.errorLoadingSettings')}
      </Text>
    );
  }

  const cityStateZip = [
    settings?.city,
    [settings?.state, settings?.zipCode].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');

  const logoUrl = logoPreview || settings?.logoThumbnailUrl;
  const logoName = logoFile?.name || formatLogoFilename(settings?.logoOriginalUrl) || formatLogoFilename(settings?.logoThumbnailUrl);
  const logoMeta = formatLogoMeta(settings?.updatedAt);

  return (
    <div>
      <SettingsPageHeader
        title={t('settings.companyProfile.title')}
        description={t('settings.companyProfile.description')}
        editing={isEditing}
        canEdit={canEdit}
        onEdit={() => setIsEditing(true)}
        onCancel={handleCancel}
        onSave={handleSave}
        saving={updateMutation.isPending}
      />

      <div className="grid grid-cols-2 gap-4">
        {/* ── Company card ─────────────────────────────────────── */}
        <SettingsSection title="Company">
          {!isEditing ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="col-span-2">
                <FieldLabel>{t('tenantSettings.form.companyName')}</FieldLabel>
                <FieldValue>{settings?.companyName || '—'}</FieldValue>
              </div>
              <div>
                <FieldLabel>{t('tenantSettings.form.companyNameShort')}</FieldLabel>
                <FieldValue>{settings?.companyNameShort || '—'}</FieldValue>
              </div>
              <div>
                <FieldLabel>{t('tenantSettings.form.companySlogan')}</FieldLabel>
                <FieldValue>{settings?.companySlogan || '—'}</FieldValue>
              </div>
              <div className="col-span-2">
                <FieldLabel>{t('tenantSettings.form.address')}</FieldLabel>
                <FieldValue>
                  {settings?.streetAddress ? (
                    <>
                      {settings.streetAddress}
                      {cityStateZip && (
                        <>
                          <br />
                          {cityStateZip}
                        </>
                      )}
                    </>
                  ) : (
                    '—'
                  )}
                </FieldValue>
              </div>
              <div>
                <FieldLabel>{t('tenantSettings.form.phone')}</FieldLabel>
                <FieldValue>{settings?.phone || '—'}</FieldValue>
              </div>
              <div>
                <FieldLabel>{t('tenantSettings.form.email')}</FieldLabel>
                <FieldValue>{settings?.email || '—'}</FieldValue>
              </div>
            </dl>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-3">
              <div className="col-span-2">
                <FieldLabel required>{t('tenantSettings.form.companyName')}</FieldLabel>
                <Input
                  name="companyName"
                  value={formData.companyName || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleChange('companyName', e.target.value)
                  }
                  required
                />
              </div>
              <div>
                <FieldLabel hint={t('settings.companyProfile.shortNameHint')}>
                  {t('tenantSettings.form.companyNameShort')}
                </FieldLabel>
                <Input
                  name="companyNameShort"
                  value={formData.companyNameShort || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleChange('companyNameShort', e.target.value)
                  }
                />
              </div>
              <div>
                <FieldLabel>{t('tenantSettings.form.companySlogan')}</FieldLabel>
                <Input
                  name="companySlogan"
                  value={formData.companySlogan || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleChange('companySlogan', e.target.value)
                  }
                />
              </div>
              <div className="col-span-2">
                <FieldLabel>{t('tenantSettings.form.address')}</FieldLabel>
                <Input
                  name="streetAddress"
                  value={formData.streetAddress || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleChange('streetAddress', e.target.value)
                  }
                  placeholder={t('tenantSettings.form.streetAddress')}
                />
              </div>
              <div className="col-span-2 grid grid-cols-6 gap-3">
                <div className="col-span-3">
                  <Input
                    name="city"
                    value={formData.city || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleChange('city', e.target.value)
                    }
                    placeholder={t('tenantSettings.form.city')}
                  />
                </div>
                <div className="col-span-1">
                  <Select
                    name="state"
                    value={formData.state || ''}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      handleChange('state', e.target.value)
                    }
                  >
                    <option value="">{t('tenantSettings.form.state')}</option>
                    {US_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="col-span-2">
                  <Input
                    name="zipCode"
                    value={formData.zipCode || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleChange('zipCode', e.target.value)
                    }
                    placeholder={t('tenantSettings.form.zipCode')}
                  />
                </div>
              </div>
              <div>
                <FieldLabel>{t('tenantSettings.form.phone')}</FieldLabel>
                <PatternFormat
                  format="(###) ###-####"
                  mask="_"
                  customInput={Input}
                  name="phone"
                  value={formData.phone || ''}
                  onValueChange={(values) => handleChange('phone', values.formattedValue)}
                />
              </div>
              <div>
                <FieldLabel>{t('tenantSettings.form.email')}</FieldLabel>
                <Input
                  name="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleChange('email', e.target.value)
                  }
                />
              </div>
            </div>
          )}
        </SettingsSection>

        {/* ── Logo card ────────────────────────────────────────── */}
        <SettingsSection
          title={t('settings.companyProfile.logo')}
          subtitle={isEditing ? t('settings.companyProfile.logoSection') : undefined}
        >
          <div className="flex items-start gap-4">
            <div
              className="grid h-[88px] w-[88px] shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-bg-elev-2"
              style={{ backgroundColor: logoUrl ? undefined : undefined }}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={t('tenantSettings.form.logo')}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-[10.5px] text-fg-dim">{t('settings.companyProfile.logoNone')}</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              {isEditing ? (
                <>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={triggerLogoPicker}
                      className="text-[12.5px] font-semibold text-fg-strong hover:text-fg-accent"
                      disabled={uploadLogoMutation.isPending}
                    >
                      {uploadLogoMutation.isPending ? t('common.saving') : t('settings.companyProfile.logoReplace')}
                    </button>
                    <button
                      type="button"
                      onClick={handleLogoRemove}
                      className="text-[12.5px] font-semibold text-fg-muted hover:text-fg-strong"
                      disabled={uploadLogoMutation.isPending || !logoUrl}
                    >
                      {t('settings.companyProfile.logoRemove')}
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <p className="mt-2 text-[11px] text-fg-dim leading-snug">
                    {t('settings.companyProfile.logoHelperLong')}
                  </p>
                </>
              ) : (
                <div className="space-y-0.5">
                  <div className="text-[13px] font-medium text-fg-strong truncate">
                    {logoName || (logoUrl ? t('settings.companyProfile.logoUploaded') : '—')}
                  </div>
                  {logoUrl && logoMeta && (
                    <div className="text-[11px] text-fg-dim">
                      {t('settings.companyProfile.logoUploadedAt', { date: logoMeta })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </SettingsSection>
      </div>

    </div>
  );
}
