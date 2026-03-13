import AppLayout from '../components/AppLayout';
import { Heading } from '../components/catalyst/heading';

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="p-8">
        <Heading>Dashboard</Heading>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Welcome to Dispatch
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
            <h3 className="text-base font-medium text-zinc-900 dark:text-white">
              Customers
            </h3>
            <p className="mt-2 text-3xl font-semibold text-indigo-600 dark:text-indigo-400">
              --
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Total customers
            </p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
            <h3 className="text-base font-medium text-zinc-900 dark:text-white">
              Work Orders
            </h3>
            <p className="mt-2 text-3xl font-semibold text-indigo-600 dark:text-indigo-400">
              --
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Active work orders
            </p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
            <h3 className="text-base font-medium text-zinc-900 dark:text-white">
              Revenue
            </h3>
            <p className="mt-2 text-3xl font-semibold text-indigo-600 dark:text-indigo-400">
              --
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              This month
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
