import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGlossary } from '../../contexts/GlossaryContext';
import AppLayout from '../../components/AppLayout';
import { PageHead } from '../../components/ui/PageHead';
import { Card, CardBody } from '../../components/ui/Card';

interface NavItem {
  label: string;
  to: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

export default function SettingsLayout() {
  const { t } = useTranslation();
  const { getName } = useGlossary();

  const sections: NavSection[] = [
    {
      label: t('settings.sections.organization'),
      items: [
        { label: t('settings.nav.general'), to: '/settings/general' },
        { label: t('settings.nav.terminology'), to: '/settings/terminology' },
        { label: t('settings.nav.notificationTemplates'), to: '/settings/notification-templates' },
      ],
    },
    {
      label: t('settings.sections.dispatch', { dispatch: getName('dispatch') }),
      items: [
        { label: `${getName('dispatch')} ${t('entities.regions')}`, to: '/settings/dispatch-regions' },
      ],
    },
    {
      label: t('settings.sections.workOrders', { workOrders: getName('work_order', true) }),
      items: [
        { label: t('settings.nav.types'), to: '/settings/work-orders/types' },
        { label: getName('division', true), to: '/settings/work-orders/divisions' },
        { label: t('settings.nav.itemStatuses'), to: '/settings/work-orders/item-statuses' },
        { label: t('settings.nav.statusWorkflows'), to: '/settings/work-orders/status-workflows' },
        { label: t('settings.nav.workflowConfig'), to: '/settings/work-orders/workflow-config' },
      ],
    },
    {
      label: t('settings.sections.equipment', { equipment: getName('equipment', true) }),
      items: [
        { label: t('settings.nav.equipmentTypes'), to: '/settings/equipment/types' },
        { label: t('settings.nav.equipmentCategories'), to: '/settings/equipment/categories' },
        { label: t('settings.nav.filterSizes'), to: '/settings/equipment/filter-sizes' },
      ],
    },
    {
      label: t('settings.sections.access'),
      items: [
        { label: getName('role', true), to: '/settings/access/roles' },
      ],
    },
  ];

  return (
    <AppLayout>
      <div>
        <PageHead title={t('entities.settings')} />

        <div className="flex gap-5">
          {/* Settings nav rail in its own Card */}
          <Card className="w-56 shrink-0 self-start">
            <CardBody>
              <nav className="space-y-4">
                {sections.map((section) => (
                  <div key={section.label}>
                    <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
                      {section.label}
                    </div>
                    <ul className="space-y-0.5">
                      {section.items.map((item) => (
                        <li key={item.to}>
                          <NavLink
                            to={item.to}
                            className={({ isActive }) =>
                              [
                                'block rounded-md px-2 py-1.5 text-[12.5px] transition-colors',
                                isActive
                                  ? 'bg-accent-500/10 font-semibold text-accent-700 dark:text-accent-300'
                                  : 'text-fg hover:bg-bg-hover hover:text-fg-strong',
                              ].join(' ')
                            }
                          >
                            {item.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            </CardBody>
          </Card>

          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </AppLayout>
  );
}
