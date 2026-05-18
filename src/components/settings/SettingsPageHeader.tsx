import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PencilIcon } from '@heroicons/react/16/solid';
import { Button } from '../catalyst/button';
import { Pill } from '../ui/Pill';

type Props = {
  title: ReactNode;
  description?: ReactNode;
  badge?: 'planned';
  editing?: boolean;
  canEdit?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  saving?: boolean;
  saveLabel?: ReactNode;
  secondary?: ReactNode;
};

export function SettingsPageHeader({
  title,
  description,
  badge,
  editing = false,
  canEdit,
  onEdit,
  onCancel,
  onSave,
  saving,
  saveLabel,
  secondary,
}: Props) {
  const { t } = useTranslation();
  const hasEditControls = canEdit && (onEdit || onSave);

  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-[22px] font-bold text-fg-strong tracking-[-0.02em] m-0">
            {title}
          </h1>
          {badge === 'planned' && (
            <Pill tone="neutral" className="uppercase tracking-wider">
              {t('settings.planned')}
            </Pill>
          )}
        </div>
        {description && (
          <p className="text-[12.5px] text-fg-muted mt-1 max-w-3xl leading-snug">
            {description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {secondary}
        {hasEditControls && (
          editing ? (
            <>
              <Button plain type="button" onClick={onCancel} disabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button color="accent" type="button" onClick={onSave} disabled={saving}>
                {saving ? t('common.saving') : (saveLabel ?? t('settings.saveChanges'))}
              </Button>
            </>
          ) : (
            onEdit && (
              // Edit is the secondary action on a view-mode page (90% of
              // visits don't touch it). Demoted from filled-primary to an
              // outlined treatment using project tokens. Reserve accent for
              // Save / Add / net-new creation.
              <Button
                outline
                type="button"
                onClick={onEdit}
                className="border-border text-fg-strong hover:bg-bg-hover dark:border-border dark:text-fg-strong dark:hover:bg-bg-hover"
              >
                <PencilIcon data-slot="icon" />
                {t('common.edit')}
              </Button>
            )
          )
        )}
      </div>
    </div>
  );
}
