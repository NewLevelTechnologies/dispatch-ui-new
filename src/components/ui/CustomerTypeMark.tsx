// ─────────────────────────────────────────────────────────────────
// CustomerTypeMark.tsx — small icon chip identifying a customer's
// category at a glance.
//
// Building glyph for commercial, house glyph for residential. Used in
// the leading cell of customer-list and location-list rows so the type
// reads pre-attentively without taking a column for itself.
//
//   <CustomerTypeMark category="COMMERCIAL" />
//   <CustomerTypeMark category="RESIDENTIAL" title="Homeowner" />
//
// `BILLING_ONLY` customers (payers) live on their own page and don't
// appear in either of these lists, so the mark intentionally doesn't
// model that case — callers should filter payers out upstream.
// ─────────────────────────────────────────────────────────────────
import { BuildingOffice2Icon, HomeIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

type Category = 'COMMERCIAL' | 'RESIDENTIAL';

export function CustomerTypeMark({
  category,
  title,
  className,
}: {
  category: Category;
  title?: string;
  className?: string;
}) {
  const commercial = category === 'COMMERCIAL';
  const Icon = commercial ? BuildingOffice2Icon : HomeIcon;
  return (
    <span
      title={title ?? (commercial ? 'Commercial' : 'Residential')}
      aria-label={title ?? (commercial ? 'Commercial' : 'Residential')}
      className={clsx(
        'inline-grid size-[22px] shrink-0 place-items-center rounded-[5px] border',
        commercial
          ? 'border-accent-500/30 bg-accent-500/10 text-accent-700 dark:text-accent-300'
          : 'border-border-soft bg-bg-active text-fg-muted',
        className
      )}
    >
      <Icon className="size-[13px]" aria-hidden="true" />
    </span>
  );
}
