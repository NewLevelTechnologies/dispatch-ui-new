// ─────────────────────────────────────────────────────────────────
// FilterChip.tsx — filter button used above list tables.
//
// Empty state shows a "+ Label" affordance with neutral border.
// Set state shows "Label: Value ×" with accent-tinted background.
// Clicking either is the host's responsibility — wire to your filter
// state.
//
//   <FilterChip label="Status" value="Open"     onChange={...} />
//   <FilterChip label="Tech"                    onChange={...} />
//   <FilterChip label="Window" value="Next 14d" onChange={...} />
// ─────────────────────────────────────────────────────────────────
import clsx from 'clsx';

type Props = {
  label: string;
  value?: string;
  onChange?: () => void;
  onClear?: () => void;
};

export function FilterChip({ label, value, onChange, onClear }: Props) {
  const isSet = value != null && value !== '';
  return (
    <button
      type="button"
      className={clsx('filter-chip', isSet && 'set')}
      onClick={(e) => {
        if ((e.target as HTMLElement).dataset.role === 'clear') return;
        onChange?.();
      }}
    >
      <span className="label">{label}</span>
      {isSet ? (
        <>
          <span className="value">{value}</span>
          <span
            className="x"
            data-role="clear"
            onClick={(e) => {
              e.stopPropagation();
              onClear?.();
            }}
          >
            ×
          </span>
        </>
      ) : (
        <span className="x">+</span>
      )}
    </button>
  );
}
