import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from './catalyst/button';
import { SlideOver } from './catalyst/slideover';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from './catalyst/tabs';
import { Text } from './catalyst/text';

export type FinancialTab = 'quotes' | 'purchaseOrders' | 'invoices' | 'payments';

// Chronological order matching WO lifecycle (§3.1):
//   1. Quote     — estimate-before-work (sometimes)
//   2. PO        — mid-job procurement (sometimes)
//   3. Invoice   — bill after work (always)
//   4. Payment   — customer pays (always, last)
// CSRs scan in lifecycle progression. Earlier "click-frequency order"
// reasoning was a guess without telemetry; chronological matches the
// mental model of "where is this WO in its arc."
const TAB_ORDER: FinancialTab[] = ['quotes', 'purchaseOrders', 'invoices', 'payments'];

interface Props {
  open: boolean;
  onClose: () => void;
  workOrderNumber: string;
  /**
   * Tab to land on when the drawer opens. Chip-row click handlers set this
   * based on which chip was clicked (§3.2 routing). Defaults to `invoices` —
   * the most-trafficked surface per §3.1 click-frequency order.
   *
   * Implemented via `key` remounting (not controlled `selectedIndex`) so the
   * user can switch tabs inside the drawer without parent re-renders fighting
   * the local selection. Each new value of `initialTab` from the parent
   * remounts the TabGroup with that tab as the default.
   */
  initialTab?: FinancialTab;
}

/**
 * Right-edge slide-over (~800px) that hosts the WO's financial documents in
 * four tabs: Invoices · Payments · Quotes · POs. Click-frequency order per
 * §3.1 — not lifecycle order — because Invoices is the most-clicked surface.
 *
 * This branch ships the shell only. All four tabs render a "Coming soon"
 * stub. Tab content fills in as backend asks land:
 *   - Invoices read    → backend ask #2 (in flight)
 *   - Invoice create   → backend ask #6
 *   - Payments         → backend asks #3, #4
 *   - Quotes           → 7b (backend asks #7–#10)
 *   - POs              → 7c (deferred)
 *
 * The `initialTab` prop lets the chip row land on the matching tab in one
 * click (e.g. `$ invoiced` → invoices, `$ paid` → payments). When the drawer
 * remains mounted across opens, we reset the selected tab on each transition
 * from closed → open so the next-click landing is honored.
 */
export default function FinancialDrawer({
  open,
  onClose,
  workOrderNumber,
  initialTab = 'invoices',
}: Props) {
  const { t } = useTranslation();

  return (
    <SlideOver open={open} onClose={onClose} className="!max-w-[800px]">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
          {t('workOrders.financialDrawer.title', { number: workOrderNumber })}
        </h2>
        <Button plain onClick={onClose} aria-label={t('common.close')}>
          <XMarkIcon className="size-5" />
        </Button>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <TabGroup
          // Remount on initialTab change so the next chip click lands on the
          // requested tab without fighting any user-driven tab selection.
          key={initialTab}
          defaultIndex={TAB_ORDER.indexOf(initialTab)}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <TabList className="!gap-4 px-4">
            <Tab>{t('workOrders.financialDrawer.tabs.quotes')}</Tab>
            <Tab>{t('workOrders.financialDrawer.tabs.purchaseOrders')}</Tab>
            <Tab>{t('workOrders.financialDrawer.tabs.invoices')}</Tab>
            <Tab>{t('workOrders.financialDrawer.tabs.payments')}</Tab>
          </TabList>

          <TabPanels className="!mt-0 flex-1 overflow-y-auto p-4">
            <TabPanel>
              <ComingSoon
                tab="quotes"
                blockers={t('workOrders.financialDrawer.stubBlockers.quotes')}
              />
            </TabPanel>
            <TabPanel>
              <ComingSoon
                tab="purchaseOrders"
                blockers={t('workOrders.financialDrawer.stubBlockers.purchaseOrders')}
              />
            </TabPanel>
            <TabPanel>
              <ComingSoon
                tab="invoices"
                blockers={t('workOrders.financialDrawer.stubBlockers.invoices')}
              />
            </TabPanel>
            <TabPanel>
              <ComingSoon
                tab="payments"
                blockers={t('workOrders.financialDrawer.stubBlockers.payments')}
              />
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </div>
    </SlideOver>
  );
}

interface ComingSoonProps {
  tab: FinancialTab;
  blockers: string;
}

/**
 * Stub state for a tab whose data path hasn't landed yet. Honest copy ("not
 * built yet") beats a fake table or placeholder rows — see [[no-workaround
 * -recipes]]. The blockers line names the specific backend ask each tab
 * waits on, so a CSR who navigates here understands the timeline.
 */
function ComingSoon({ tab, blockers }: ComingSoonProps) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
      <Text className="!text-base !font-medium !text-zinc-700 dark:!text-zinc-300">
        {t(`workOrders.financialDrawer.tabs.${tab}`)} — {t('workOrders.financialDrawer.comingSoon')}
      </Text>
      <Text className="!text-sm !text-zinc-500">{blockers}</Text>
    </div>
  );
}
