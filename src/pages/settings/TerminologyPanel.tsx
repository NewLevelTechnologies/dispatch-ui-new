import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  tenantSettingsApi,
  glossaryApi,
  getApiErrorMessage,
  type Glossary,
} from '../../api';
import { useGlossary } from '../../contexts/GlossaryContext';
import { useHasCapability } from '../../hooks/useCurrentUser';
import { Text } from '../../components/catalyst/text';
import { Button } from '../../components/catalyst/button';
import { Input } from '../../components/catalyst/input';
import { Card } from '../../components/ui/Card';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';

export default function TerminologyPanel() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { updateGlossary } = useGlossary();
  const canEdit = useHasCapability('EDIT_SETTINGS');
  const [isEditing, setIsEditing] = useState(false);
  const [glossaryCustomizations, setGlossaryCustomizations] = useState<Glossary>({});

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => tenantSettingsApi.getSettings(),
  });

  const { data: availableEntities } = useQuery({
    queryKey: ['glossary', 'available'],
    queryFn: () => glossaryApi.getAvailableEntities(),
  });

  useEffect(() => {
    if (settings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGlossaryCustomizations(settings.glossary || {});
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (glossary: Glossary) => tenantSettingsApi.updateSettings({ glossary }),
    onSuccess: (updatedSettings) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      if (updatedSettings.glossary) {
        updateGlossary(updatedSettings.glossary);
      }
      setIsEditing(false);
    },
    onError: (error: unknown) => {
      alert(getApiErrorMessage(error) || t('tenantSettings.messages.errorUpdateSettings'));
    },
  });

  const handleGlossaryChange = (entityCode: string, field: 'singular' | 'plural', value: string) => {
    setGlossaryCustomizations((prev) => ({
      ...prev,
      [entityCode]: {
        singular: field === 'singular' ? value : (prev[entityCode]?.singular || ''),
        plural: field === 'plural' ? value : (prev[entityCode]?.plural || ''),
      },
    }));
  };

  const handleSave = () => {
    const cleanedGlossary = Object.fromEntries(
      Object.entries(glossaryCustomizations).filter(
        ([, value]) => value.singular?.trim() || value.plural?.trim(),
      ),
    );
    updateMutation.mutate(cleanedGlossary);
  };

  const handleCancel = () => {
    setGlossaryCustomizations(settings?.glossary || {});
    setIsEditing(false);
  };

  const handleResetToDefaults = () => {
    setGlossaryCustomizations({});
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

  return (
    <div>
      <SettingsPageHeader
        title={t('settings.terminology.title')}
        description={t('settings.terminology.description')}
        editing={isEditing}
        canEdit={canEdit}
        onEdit={() => setIsEditing(true)}
        onCancel={handleCancel}
        onSave={handleSave}
        saving={updateMutation.isPending}
        secondary={
          isEditing && canEdit ? (
            <Button plain type="button" onClick={handleResetToDefaults}>
              {t('settings.resetDefaults')}
            </Button>
          ) : undefined
        }
      />

      {(() => {
        if (!availableEntities || availableEntities.length === 0) {
          return (
            <Card className="overflow-hidden">
              <div className="px-4 py-6 text-sm text-fg-muted">
                {t('tenantSettings.glossary.loadingEntities')}
              </div>
            </Card>
          );
        }

        // View mode: show only the customized entries (empty state if none).
        if (!isEditing) {
          const customized = availableEntities.filter((entity) => {
            const c = glossaryCustomizations[entity.code];
            return c?.singular?.trim() || c?.plural?.trim();
          });

          if (customized.length === 0) {
            return (
              <Card className="overflow-hidden">
                <div className="px-4 py-6 text-sm text-fg-muted">
                  {t('tenantSettings.glossary.emptyState')}
                </div>
              </Card>
            );
          }

          return (
            <Card className="overflow-hidden">
              <div className="grid grid-cols-[1fr_minmax(220px,1.2fr)_minmax(220px,1.2fr)] border-b border-border bg-bg-elev-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-muted">
                <div>{t('tenantSettings.glossary.entity')}</div>
                <div>{t('tenantSettings.glossary.singularForm')}</div>
                <div>{t('tenantSettings.glossary.pluralForm')}</div>
              </div>
              <div className="divide-y divide-border-soft">
                {customized.map((entity) => {
                  const customization = glossaryCustomizations[entity.code];
                  return (
                    <div
                      key={entity.code}
                      className="grid grid-cols-[1fr_minmax(220px,1.2fr)_minmax(220px,1.2fr)] items-start gap-x-4 px-4 py-3"
                    >
                      <div>
                        <div className="text-[13px] font-semibold text-fg-strong">
                          {entity.defaultSingular}
                        </div>
                        {entity.description && (
                          <div className="text-[11.5px] text-fg-muted mt-0.5 leading-snug">
                            {entity.description}
                          </div>
                        )}
                      </div>
                      <div className="text-[13px] text-fg-strong pt-1">
                        {customization?.singular?.trim() || entity.defaultSingular}
                      </div>
                      <div className="text-[13px] text-fg-strong pt-1">
                        {customization?.plural?.trim() || entity.defaultPlural}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        }

        // Edit mode: full list with placeholder = default
        return (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-[1fr_minmax(220px,1.2fr)_minmax(220px,1.2fr)] border-b border-border bg-bg-elev-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-muted">
              <div>{t('tenantSettings.glossary.entity')}</div>
              <div>{t('tenantSettings.glossary.singularForm')}</div>
              <div>{t('tenantSettings.glossary.pluralForm')}</div>
            </div>
            <div className="divide-y divide-border-soft">
              {availableEntities.map((entity) => {
                const customization = glossaryCustomizations[entity.code];
                return (
                  <div
                    key={entity.code}
                    className="grid grid-cols-[1fr_minmax(220px,1.2fr)_minmax(220px,1.2fr)] items-start gap-x-4 px-4 py-3"
                  >
                    <div>
                      <div className="text-[13px] font-semibold text-fg-strong">
                        {entity.defaultSingular}
                      </div>
                      {entity.description && (
                        <div className="text-[11.5px] text-fg-muted mt-0.5 leading-snug">
                          {entity.description}
                        </div>
                      )}
                    </div>
                    <div>
                      <Input
                        name={`glossary-${entity.code}-singular`}
                        value={customization?.singular || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleGlossaryChange(entity.code, 'singular', e.target.value)
                        }
                        placeholder={entity.defaultSingular}
                      />
                    </div>
                    <div>
                      <Input
                        name={`glossary-${entity.code}-plural`}
                        value={customization?.plural || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleGlossaryChange(entity.code, 'plural', e.target.value)
                        }
                        placeholder={entity.defaultPlural}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}
    </div>
  );
}
