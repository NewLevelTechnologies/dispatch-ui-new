import { useAuthenticator } from '@aws-amplify/ui-react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGlossary } from '../contexts/GlossaryContext';
import {
  HomeIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  WrenchScrewdriverIcon,
  CalendarIcon,
  ShieldCheckIcon,
  Cog6ToothIcon,
  SunIcon,
  MoonIcon,
  SwatchIcon,
  DocumentTextIcon,
  DocumentChartBarIcon,
  CreditCardIcon,
  CubeIcon,
  BuildingStorefrontIcon,
  ChartBarIcon,
  ClockIcon,
  ArrowPathIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { Sidebar, SidebarBody, SidebarFooter, SidebarHeader, SidebarHeading, SidebarItem, SidebarSection } from './catalyst/sidebar';
import { SidebarLayout } from './catalyst/sidebar-layout';
import { Navbar } from './catalyst/navbar';
import { Dropdown, DropdownButton, DropdownItem, DropdownLabel, DropdownMenu } from './catalyst/dropdown';
import { Avatar } from './catalyst/avatar';
import { useTheme } from './ThemeProvider';
import { useHasAnyCapability } from '../hooks/useCurrentUser';

const ENV_BADGE: Record<string, { label: string; className: string }> = {
  development: { label: 'DEV', className: 'bg-warning-500/20 text-warning-500 ring-warning-500/30' },
  qa: { label: 'QA', className: 'bg-info-500/20 text-info-500 ring-info-500/30' },
  staging: { label: 'STG', className: 'bg-violet-500/20 text-violet-500 ring-violet-500/30' },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  const location = useLocation();
  const { t } = useTranslation();
  const { getName } = useGlossary();
  const { mode, accent, setMode, setAccent } = useTheme();

  // Permission checks for navigation visibility
  const canViewUsers = useHasAnyCapability('VIEW_USERS');
  const canViewSettings = useHasAnyCapability('VIEW_SETTINGS');

  const envKey = (import.meta.env.VITE_ENV || '').toLowerCase();
  const envBadge = ENV_BADGE[envKey];

  const isCurrent = (href: string) =>
    href === '/dashboard' ? location.pathname === href : location.pathname.startsWith(href);

  const mainNavigation = [
    { name: t('entities.dashboard'), href: '/dashboard', icon: HomeIcon },
    { name: getName('customer', true), href: '/customers', icon: UserGroupIcon },
    { name: getName('service_location', true), href: '/service-locations', icon: MapPinIcon },
    { name: getName('work_order', true), href: '/work-orders', icon: ClipboardDocumentListIcon },
  ];

  const equipmentNavigation = [
    { name: getName('equipment', true), href: '/equipment', icon: WrenchScrewdriverIcon },
    { name: t('equipment.entities.parts'), href: '/parts-inventory', icon: CubeIcon },
    { name: t('equipment.entities.warehouses'), href: '/warehouses', icon: BuildingStorefrontIcon },
  ];

  const financialNavigation = [
    { name: getName('invoice', true), href: '/invoices', icon: DocumentTextIcon },
    { name: getName('quote', true), href: '/quotes', icon: DocumentChartBarIcon },
    { name: getName('payment', true), href: '/payments', icon: CreditCardIcon },
  ];

  const schedulingNavigation = [
    { name: getName('dispatch', true), href: '/dispatches', icon: CalendarIcon },
    { name: t('scheduling.entities.availability'), href: '/availability', icon: ClockIcon },
    { name: t('scheduling.entities.recurringOrders'), href: '/recurring-orders', icon: ArrowPathIcon },
  ];

  const adminNavigation = [
    // Reports lives here as a role-restricted utility surface (alongside Users
    // and Settings). Not gated yet — when we wire capability checks, gate on
    // "user has access to at least one report" via the registry's
    // requiresCapability fields.
    { name: t('reports.title'), href: '/reports', icon: ChartBarIcon },
    ...(canViewUsers ? [{ name: t('entities.users'), href: '/users', icon: ShieldCheckIcon }] : []),
    ...(canViewSettings ? [{ name: t('entities.settings'), href: '/settings', icon: Cog6ToothIcon }] : []),
  ];

  return (
    <SidebarLayout
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2.5">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-accent-500 to-accent-700 text-[13px] font-bold text-white shadow-sm">
                {t('app.name').charAt(0)}
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="text-[14px] font-semibold tracking-tight text-white">
                  {t('app.name')}
                </span>
                {envBadge && (
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider ring-1 ring-inset ${envBadge.className}`}
                  >
                    {envBadge.label}
                  </span>
                )}
              </div>
            </div>
          </SidebarHeader>

          <SidebarBody className="[&>[data-slot=section]+[data-slot=section]]:mt-5">
            <SidebarSection>
              {mainNavigation.map((item) => {
                const current = isCurrent(item.href);
                return (
                  <SidebarItem
                    key={item.name}
                    href={item.href}
                    current={current}
                  >
                    <item.icon data-slot="icon" />
                    <span>{item.name}</span>
                  </SidebarItem>
                );
              })}
            </SidebarSection>

            <SidebarSection>
              <SidebarHeading>{t('entities.inventory')}</SidebarHeading>
              {equipmentNavigation.map((item) => {
                const current = isCurrent(item.href);
                return (
                  <SidebarItem
                    key={item.name}
                    href={item.href}
                    current={current}
                  >
                    <item.icon data-slot="icon" />
                    <span>{item.name}</span>
                  </SidebarItem>
                );
              })}
            </SidebarSection>

            <SidebarSection>
              <SidebarHeading>{t('entities.financial')}</SidebarHeading>
              {financialNavigation.map((item) => {
                const current = isCurrent(item.href);
                return (
                  <SidebarItem
                    key={item.name}
                    href={item.href}
                    current={current}
                  >
                    <item.icon data-slot="icon" />
                    <span>{item.name}</span>
                  </SidebarItem>
                );
              })}
            </SidebarSection>

            <SidebarSection>
              <SidebarHeading>{t('entities.scheduling')}</SidebarHeading>
              {schedulingNavigation.map((item) => {
                const current = isCurrent(item.href);
                return (
                  <SidebarItem
                    key={item.name}
                    href={item.href}
                    current={current}
                  >
                    <item.icon data-slot="icon" />
                    <span>{item.name}</span>
                  </SidebarItem>
                );
              })}
            </SidebarSection>

            {adminNavigation.length > 0 && (
              <SidebarSection>
                {adminNavigation.map((item) => {
                  const current = isCurrent(item.href);
                  return (
                    <SidebarItem
                      key={item.name}
                      href={item.href}
                      current={current}
                    >
                      <item.icon data-slot="icon" />
                      <span>{item.name}</span>
                    </SidebarItem>
                  );
                })}
              </SidebarSection>
            )}
          </SidebarBody>

          <SidebarFooter>
            <Dropdown>
              <DropdownButton as={SidebarItem}>
                <Avatar
                  slot="icon"
                  initials={user?.signInDetails?.loginId?.charAt(0).toUpperCase() || 'U'}
                  className="size-6"
                />
                <span className="truncate">{user?.signInDetails?.loginId}</span>
              </DropdownButton>
              <DropdownMenu className="min-w-64" anchor="top start">
                <div className="px-3 py-2">
                  <div className="text-sm font-medium text-zinc-900 dark:text-white mb-2">{t('common.theme')}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMode('light')}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                        mode === 'light'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                      }`}
                      aria-label="Light mode"
                    >
                      <SunIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setMode('dark')}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                        mode === 'dark'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                      }`}
                      aria-label="Dark mode"
                    >
                      <MoonIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 mb-2 text-sm font-medium text-zinc-900 dark:text-white">{t('common.themeAccent')}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAccent('warm')}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                        accent === 'warm'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                      }`}
                      aria-label="Warm accent"
                    >
                      <SwatchIcon className="h-4 w-4" /> {t('common.themeAccentWarm')}
                    </button>
                    <button
                      onClick={() => setAccent('cool')}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                        accent === 'cool'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                      }`}
                      aria-label="Cool accent"
                    >
                      <SwatchIcon className="h-4 w-4" /> {t('common.themeAccentCool')}
                    </button>
                  </div>
                </div>
                <DropdownItem href="/account/settings">
                  <DropdownLabel>{t('account.settings')}</DropdownLabel>
                </DropdownItem>
                <DropdownItem onClick={() => signOut()}>
                  <DropdownLabel>{t('common.signOut')}</DropdownLabel>
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </SidebarFooter>
        </Sidebar>
      }
      navbar={
        <Navbar>
          <div className="mx-auto flex h-[30px] w-full max-w-[420px] items-center gap-2 rounded-md border border-border bg-bg-sunken px-2.5 text-[12.5px] text-fg-muted">
            <span className="text-fg-dim">{t('common.search')}</span>
            <span aria-hidden className="ml-auto rounded border border-border bg-bg px-1.5 py-px font-mono text-[10px]">{'⌘K'}</span>
          </div>
        </Navbar>
      }
    >
      {children}
    </SidebarLayout>
  );
}
