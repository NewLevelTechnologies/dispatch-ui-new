import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  notificationTemplateApi,
  getApiErrorMessage,
  type NotificationTemplateListItem,
  type NotificationTemplate,
} from '../../api';
import { useHasCapability } from '../../hooks/useCurrentUser';
import NotificationTemplateEditor from '../../components/NotificationTemplateEditor';
import { Heading } from '../../components/catalyst/heading';
import { Text } from '../../components/catalyst/text';
import { EnvelopeIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import { Pill } from '../../components/ui/Pill';
import { Card, CardBody } from '../../components/ui/Card';
import { DenseTable, DenseTHead, DenseRow } from '../../components/ui/DenseTable';
import { SettingsListFooter } from '../../components/settings/SettingsListFooter';

export default function NotificationTemplatesPanel() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const canView = useHasCapability('VIEW_SETTINGS');
  const canEdit = useHasCapability('EDIT_SETTINGS');
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const { data: templates, isLoading, error } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () => notificationTemplateApi.getAll(),
    enabled: canView,
  });

  const revertMutation = useMutation({
    mutationFn: (id: string) => notificationTemplateApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      setIsEditorOpen(false);
      setSelectedTemplate(null);
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error && 'response' in error
        ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message)
        : undefined;
      alert(errorMessage || t('settings.notificationTemplates.errorRevert'));
    },
  });

  const handleCustomize = async (template: NotificationTemplateListItem) => {
    try {
      const fullTemplate = await notificationTemplateApi.getById(template.id);
      setSelectedTemplate(fullTemplate);
      setIsEditorOpen(true);
    } catch (err) {
      console.error('Failed to load template details:', err);
      alert(t('settings.notificationTemplates.errorLoadDetail'));
    }
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setSelectedTemplate(null);
  };

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <Heading>{t('settings.nav.notificationTemplates')}</Heading>
          <Text className="mt-1 text-sm text-fg-muted max-w-3xl">
            {t('settings.notificationTemplates.description')}
          </Text>
        </div>
      </div>

      {isLoading && <Text>{t('settings.notificationTemplates.loading')}</Text>}
      {error && (
        <Text className="text-danger-500">
          {getApiErrorMessage(error) || t('settings.notificationTemplates.errorLoad')}
        </Text>
      )}
      {templates && templates.length === 0 && <Text>{t('settings.notificationTemplates.empty')}</Text>}

      {templates && templates.length > 0 && (
        <Card>
          <CardBody flush>
            <DenseTable>
              <DenseTHead>
                <tr>
                  <th>{t('settings.notificationTemplates.table.channel')}</th>
                  <th>{t('settings.notificationTemplates.table.template')}</th>
                  <th>{t('settings.notificationTemplates.table.subject')}</th>
                  <th>{t('settings.notificationTemplates.table.status')}</th>
                  <th>{t('settings.notificationTemplates.table.version')}</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </DenseTHead>
              <tbody>
                {templates.map((template) => (
                  <DenseRow key={template.id}>
                    <td>
                      <span className="inline-flex items-center gap-1.5 text-fg-muted">
                        {template.channel === 'EMAIL' ? (
                          <>
                            <EnvelopeIcon className="size-3.5" />
                            <span>{t('settings.notificationTemplates.channel.email')}</span>
                          </>
                        ) : (
                          <>
                            <ChatBubbleLeftIcon className="size-3.5" />
                            <span>{t('settings.notificationTemplates.channel.sms')}</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="strong">{template.displayName}</td>
                    <td>
                      <span className="block max-w-[380px] truncate font-mono text-[11.5px] text-fg-muted">
                        {template.subject || '—'}
                      </span>
                    </td>
                    <td>
                      {template.isSystemTemplate ? (
                        <Pill tone="neutral">{t('settings.notificationTemplates.status.systemDefault')}</Pill>
                      ) : (
                        <Pill tone="accent" dot>{t('settings.notificationTemplates.status.customized')}</Pill>
                      )}
                    </td>
                    <td className="num muted">
                      {t('settings.notificationTemplates.versionShort', { version: template.version })}
                    </td>
                    <td className="right">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleCustomize(template)}
                          className="text-[11.5px] font-semibold text-accent-700 hover:text-accent-500 dark:text-accent-300"
                        >
                          {template.isSystemTemplate
                            ? t('settings.notificationTemplates.action.customize')
                            : t('settings.notificationTemplates.action.edit')}
                        </button>
                      )}
                    </td>
                  </DenseRow>
                ))}
              </tbody>
            </DenseTable>
          </CardBody>
          <SettingsListFooter
            count={templates.length}
            noun={t('settings.notificationTemplates.nounPlural')}
          />
        </Card>
      )}

      {revertMutation.isPending && null}

      {selectedTemplate && (
        <NotificationTemplateEditor
          template={selectedTemplate}
          isOpen={isEditorOpen}
          onClose={handleCloseEditor}
        />
      )}
    </div>
  );
}
