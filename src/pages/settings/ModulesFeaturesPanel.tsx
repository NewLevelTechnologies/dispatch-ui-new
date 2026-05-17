import { useTranslation } from 'react-i18next';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';
import { SettingsSection, SettingsSectionLabel } from '../../components/settings/SettingsSection';
import { ToggleSwitch } from '../../components/settings/ToggleSwitch';
import { SoonBadge } from '../../components/settings/SoonBadge';

type Feature = {
  key: string;
  label: string;
  desc: string;
  defaultOn?: boolean;
  comingSoon?: boolean;
};

type Group = {
  label: string;
  features: Feature[];
};

export default function ModulesFeaturesPanel() {
  const { t } = useTranslation();

  const groups: Group[] = [
    {
      label: t('settings.modulesFeatures.selfService'),
      features: [
        {
          key: 'onlineBooking',
          label: t('settings.modulesFeatures.feature.onlineBooking'),
          desc: t('settings.modulesFeatures.feature.onlineBookingDesc'),
          defaultOn: false,
        },
        {
          key: 'customerPortal',
          label: t('settings.modulesFeatures.feature.customerPortal'),
          desc: t('settings.modulesFeatures.feature.customerPortalDesc'),
          comingSoon: true,
        },
      ],
    },
    {
      label: t('settings.modulesFeatures.communications'),
      features: [
        {
          key: 'sms',
          label: t('settings.modulesFeatures.feature.sms'),
          desc: t('settings.modulesFeatures.feature.smsDesc'),
          defaultOn: true,
        },
        {
          key: 'email',
          label: t('settings.modulesFeatures.feature.email'),
          desc: t('settings.modulesFeatures.feature.emailDesc'),
          defaultOn: true,
        },
      ],
    },
    {
      label: t('settings.modulesFeatures.workflow'),
      features: [
        {
          key: 'approvals',
          label: t('settings.modulesFeatures.feature.approvals'),
          desc: t('settings.modulesFeatures.feature.approvalsDesc'),
          comingSoon: true,
        },
        {
          key: 'jobCosting',
          label: t('settings.modulesFeatures.feature.jobCosting'),
          desc: t('settings.modulesFeatures.feature.jobCostingDesc'),
          comingSoon: true,
        },
      ],
    },
  ];

  return (
    <div>
      <SettingsPageHeader
        title={t('settings.modulesFeatures.title')}
        description={t('settings.modulesFeatures.description')}
        badge="planned"
      />

      <SettingsSection flush>
        <div className="divide-y divide-border-soft">
          {groups.map((group) => (
            <div key={group.label} className="px-4 py-4">
              <SettingsSectionLabel className="mb-3">{group.label}</SettingsSectionLabel>
              <ul className="divide-y divide-border-soft">
                {group.features.map((feature) => (
                  <li
                    key={feature.key}
                    className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            feature.comingSoon
                              ? 'text-[13px] font-semibold text-fg-muted'
                              : 'text-[13px] font-semibold text-fg-strong'
                          }
                        >
                          {feature.label}
                        </span>
                        {feature.comingSoon && <SoonBadge />}
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-fg-muted leading-snug">
                        {feature.desc}
                      </p>
                    </div>
                    <ToggleSwitch
                      on={!feature.comingSoon && !!feature.defaultOn}
                      disabled
                      ariaLabel={feature.label}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}
