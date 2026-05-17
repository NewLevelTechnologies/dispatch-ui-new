import { useTranslation } from 'react-i18next';
import { Input } from '../../components/catalyst/input';
import { Select } from '../../components/catalyst/select';
import { US_TIMEZONES } from '../../constants/timezones';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';
import { SettingsSection, SettingsSectionLabel } from '../../components/settings/SettingsSection';
import { FieldLabel, FieldHelp } from '../../components/settings/FieldLabel';

export default function BusinessDefaultsPanel() {
  const { t } = useTranslation();

  return (
    <div>
      <SettingsPageHeader
        title={t('settings.businessDefaults.title')}
        description={t('settings.businessDefaults.description')}
        badge="planned"
      />

      <SettingsSection>
        <fieldset disabled aria-disabled className="opacity-70">
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
            <div className="space-y-3">
              <SettingsSectionLabel>{t('settings.businessDefaults.operational')}</SettingsSectionLabel>
              <div>
                <FieldLabel>{t('tenantSettings.form.timezone')}</FieldLabel>
                <Select name="timezone" defaultValue="">
                  <option value="">{t('common.form.select')}</option>
                  {US_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </Select>
                <FieldHelp>{t('settings.businessDefaults.timezoneHelper')}</FieldHelp>
              </div>
            </div>

            <div className="space-y-3">
              <SettingsSectionLabel>{t('settings.businessDefaults.financial')}</SettingsSectionLabel>
              <div>
                <FieldLabel>{t('tenantSettings.form.defaultTaxRate')}</FieldLabel>
                <Input
                  name="defaultTaxRate"
                  type="number"
                  step="0.0001"
                  min="0"
                  max="1"
                  placeholder="0.0825"
                />
                <FieldHelp>{t('settings.businessDefaults.taxRateHelper')}</FieldHelp>
              </div>
              <div>
                <FieldLabel>{t('tenantSettings.form.invoiceTerms')}</FieldLabel>
                <Select name="invoiceTerms" defaultValue="">
                  <option value="">{t('common.form.select')}</option>
                  <option value="DUE_ON_RECEIPT">{t('settings.businessDefaults.terms.dueOnReceipt')}</option>
                  <option value="NET_15">{t('settings.businessDefaults.terms.net15')}</option>
                  <option value="NET_30">{t('settings.businessDefaults.terms.net30')}</option>
                  <option value="NET_45">{t('settings.businessDefaults.terms.net45')}</option>
                  <option value="NET_60">{t('settings.businessDefaults.terms.net60')}</option>
                </Select>
                <FieldHelp>{t('settings.businessDefaults.termsHelper')}</FieldHelp>
              </div>
            </div>
          </div>
        </fieldset>
      </SettingsSection>
    </div>
  );
}
