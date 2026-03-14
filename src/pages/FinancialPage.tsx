import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';
import { Heading } from '../components/catalyst/heading';

export default function FinancialPage() {
  const { t } = useTranslation();

  return (
    <AppLayout>
      <Heading>{t('entities.financial')}</Heading>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {t('financial.description')}
      </p>
      <div className="mt-8">
        <p className="text-zinc-500">{t('financial.comingSoon')}</p>
      </div>
    </AppLayout>
  );
}
