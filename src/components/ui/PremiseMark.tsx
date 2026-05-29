// ─────────────────────────────────────────────────────────────────
// PremiseMark.tsx — small icon chip identifying what a tech is
// walking into at a given LOCATION.
//
// House glyph for `RESIDENCE`, building glyph for `BUSINESS`. The mark
// is per-LOCATION (driven by `Location.premiseType`), never per-customer
// and NEVER inferred from address topology — a property-management
// company can own residential rental locations, and we have to be able
// to express that.
//
//   <PremiseMark premise="BUSINESS" />
//   <PremiseMark premise="RESIDENCE" title="Homeowner" />
//
// Used on the Locations list and Location detail surface only — it
// does not appear on the Customers list, because a customer can own a
// mix of premise types and there's no honest customer-level answer.
// ─────────────────────────────────────────────────────────────────
import { BuildingOffice2Icon, HomeIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

type Premise = 'BUSINESS' | 'RESIDENCE';

export function PremiseMark({
  premise,
  title,
  className,
}: {
  premise: Premise;
  title?: string;
  className?: string;
}) {
  const business = premise === 'BUSINESS';
  const Icon = business ? BuildingOffice2Icon : HomeIcon;
  return (
    <span
      title={title ?? (business ? 'Business' : 'Residence')}
      aria-label={title ?? (business ? 'Business' : 'Residence')}
      className={clsx(
        'inline-grid size-[22px] shrink-0 place-items-center rounded-[5px] border',
        business
          ? 'border-accent-500/30 bg-accent-500/10 text-accent-700 dark:text-accent-300'
          : 'border-border-soft bg-bg-active text-fg-muted',
        className
      )}
    >
      <Icon className="size-[13px]" aria-hidden="true" />
    </span>
  );
}
