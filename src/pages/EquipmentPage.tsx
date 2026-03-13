import AppLayout from '../components/AppLayout';
import { Heading } from '../components/catalyst/heading';

export default function EquipmentPage() {
  return (
    <AppLayout>
      <div className="p-8">
        <Heading>Equipment</Heading>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Track equipment and inventory
        </p>
        <div className="mt-8">
          <p className="text-zinc-500">Coming soon...</p>
        </div>
      </div>
    </AppLayout>
  );
}
