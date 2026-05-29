// ─────────────────────────────────────────────────────────────────────────────
// StatusPickerChip — multi-select chevron picker for scoping a list by status.
//
// A record has exactly one status; a multi-select picker models "which statuses
// to include in the view." Defaulting to ['active'] is the right scope for both
// list pages — but it must be *visible*, not silent, otherwise users hit "why
// can't I find the inactive record I know exists." The chip readout always
// shows the explicit selection (`Status: Active`, `Status: Active +1`, etc.).
//
// Never-empty: deselecting the last option re-selects it. The picker is a
// scope choice, not an on/off toggle — an empty scope is meaningless here.
//
// The chevron affordance matches FilterChipListbox: full-weight label + `▾`,
// never a muted `+`. Selected state uses the accent tint identical to the
// listbox shell so the two chip styles read as siblings.
//
//   <StatusPickerChip
//     label="Status"
//     options={[
//       { id: 'active',   label: 'Active',   count: 412 },
//       { id: 'inactive', label: 'Inactive', count:  18 },
//     ]}
//     selected={statuses}
//     onChange={(next) => updateFilters({ status: next })}
//   />
// ─────────────────────────────────────────────────────────────────────────────
import * as Headless from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';

type Option = { id: string; label: string; count?: number };

export function StatusPickerChip({
  label = 'Status',
  ariaLabel,
  options,
  selected,
  onChange,
  allLabel = 'All',
}: {
  label?: string;
  ariaLabel?: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Label used when every option is selected (default "All"). */
  allLabel?: string;
}) {
  // Format the chip readout. Order follows the canonical `options` order so
  // the headline label is stable regardless of pick order.
  const ordered = options.filter((o) => selected.includes(o.id));
  const display =
    ordered.length === options.length
      ? allLabel
      : ordered.length === 1
        ? ordered[0].label
        : ordered.length > 1
          ? `${ordered[0].label} +${ordered.length - 1}`
          : allLabel; // shouldn't happen — never-empty guard below — but render sanely if it does

  return (
    <Headless.Listbox
      multiple
      value={selected}
      onChange={(next: string[]) => {
        // Never empty — a status picker with no scope is meaningless. If the
        // user just deselected the only remaining option, keep that one
        // selected.
        if (next.length === 0) return;
        onChange(next);
      }}
    >
      <span
        className={clsx(
          'inline-flex h-8 items-center overflow-hidden rounded-md border bg-bg-elev text-[12px] transition-colors',
          'border-accent-500/35 bg-accent-500/5 hover:bg-[color-mix(in_oklch,var(--accent-500)_12%,var(--bg-elev))]'
        )}
      >
        <Headless.ListboxButton
          aria-label={ariaLabel ?? label}
          className="flex h-full items-center gap-1.5 px-2.5 font-medium text-fg outline-none focus:outline-none"
        >
          <span className="text-fg-muted">{label}</span>
          <span className="font-semibold text-fg-strong">{display}</span>
          <ChevronDownIcon className="size-3 text-fg-muted" aria-hidden="true" />
        </Headless.ListboxButton>
      </span>
      <Headless.ListboxOptions
        transition
        anchor="bottom start"
        className={clsx(
          '[--anchor-gap:--spacing(2)] [--anchor-padding:--spacing(1)] [--anchor-offset:-6px]',
          'isolate w-max min-w-[var(--button-width)] rounded-lg p-1',
          'outline outline-transparent focus:outline-hidden',
          'overflow-y-auto',
          'bg-bg-elev/95 backdrop-blur-xl',
          'shadow-lg ring-1 ring-border',
          'transition data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0'
        )}
      >
        {options.map((option) => (
          <Headless.ListboxOption
            key={option.id}
            value={option.id}
            className={clsx(
              'group/option grid w-full cursor-default grid-cols-[16px_1fr_auto] items-center gap-2 rounded-md px-3 py-2',
              'text-[13px] text-fg-strong outline-none',
              'data-focus:bg-bg-hover',
              'data-selected:bg-bg-active'
            )}
          >
            {/* Checkmark on the left, identical visual treatment to
                FilterChipListbox so the two pickers read as one family. */}
            <svg
              className="size-4 stroke-current text-accent-600 opacity-0 group-data-selected/option:opacity-100"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 8.5l3 3L12 4"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="min-w-0 truncate">{option.label}</span>
            {typeof option.count === 'number' && (
              <span className="font-mono text-[11px] tabular-nums text-fg-dim">
                {option.count.toLocaleString()}
              </span>
            )}
          </Headless.ListboxOption>
        ))}
      </Headless.ListboxOptions>
    </Headless.Listbox>
  );
}
