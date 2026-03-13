import AppLayout from '../components/AppLayout';
import { Heading } from '../components/catalyst/heading';

export default function FinancialPage() {
  return (
    <AppLayout>
      <div className="p-8">
        <Heading>Financial</Heading>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Manage invoices, quotes, and payments
        </p>
        <div className="mt-8">
          <p className="text-zinc-500">Coming soon...</p>
        </div>
      </div>
    </AppLayout>
  );
}
