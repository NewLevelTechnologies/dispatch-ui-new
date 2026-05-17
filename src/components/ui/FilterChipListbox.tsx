// ─────────────────────────────────────────────────────────────────────────────
// FilterChipListbox — single-select filter chip used above list tables.
//
// Empty state shows "+ Label" with a neutral border. Set state shows
// "Label: Value ×" with an accent-tinted background. Clicking the body opens
// a Listbox popover; × is a sibling button that clears.
//
// Listbox (not Menu) is the correct primitive: screen readers announce
// "<option>, selected" for the currently-applied filter via aria-selected,
// which a menu can't communicate. Keyboard nav, type-ahead, Esc-to-close,
// click-outside, and floating positioning all come from Headless UI — don't
// hand-roll any of it.
//
// The reset row uses <ListboxOption value={null}>. Hosts pass `value={x || null}`
// so empty-string URL params map cleanly to the null option.
//
//   <FilterChipListbox
//     label="Type"
//     ariaLabel="Type"
//     value={typeId || null}
//     displayValue={typeId ? lookupName(typeId, types) : null}
//     onChange={(id) => updateParams({ type: id, page: null })}
//     onClear={() => updateParams({ type: null, page: null })}
//   >
//     <ListboxOption value={null}>Any type</ListboxOption>
//     <ChipDivider />
//     {types.map((t) => <ListboxOption key={t.id} value={t.id}>{t.name}</ListboxOption>)}
//   </FilterChipListbox>
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';
import * as Headless from '@headlessui/react';
import clsx from 'clsx';

type Props = {
  label: string;
  value: string | null;
  displayValue?: string | null;
  ariaLabel: string;
  onChange: (value: string | null) => void;
  onClear?: () => void;
  children: ReactNode;
};

export function FilterChipListbox({
  label,
  value,
  displayValue,
  ariaLabel,
  onChange,
  onClear,
  children,
}: Props) {
  const isSet = value != null && displayValue != null && displayValue !== '';
  return (
    <Headless.Listbox value={value} onChange={onChange}>
      <span
        className={clsx(
          'inline-flex h-8 items-center overflow-hidden rounded-md border bg-bg-elev text-[12px] transition-colors',
          isSet
            ? 'border-accent-500/35 bg-accent-500/5 hover:bg-[color-mix(in_oklch,var(--accent-500)_12%,var(--bg-elev))]'
            : 'border-border hover:bg-bg-hover'
        )}
      >
        <Headless.ListboxButton
          aria-label={ariaLabel}
          className="flex h-full items-center gap-1.5 px-2.5 font-medium text-fg outline-none focus:outline-none"
        >
          <span className="text-fg-muted">{label}</span>
          {isSet ? (
            <span className="font-semibold text-fg-strong">{displayValue}</span>
          ) : (
            <span className="text-fg-dim">+</span>
          )}
        </Headless.ListboxButton>
        {isSet && onClear && (
          <button
            type="button"
            aria-label={`${ariaLabel} — clear`}
            onClick={onClear}
            className="flex h-full items-center border-l border-accent-500/20 px-1.5 text-fg-dim hover:bg-bg-hover hover:text-fg-strong"
          >
            ×
          </button>
        )}
      </span>
      <Headless.ListboxOptions
        transition
        anchor="bottom start"
        className={clsx(
          '[--anchor-gap:--spacing(2)] [--anchor-padding:--spacing(1)] [--anchor-offset:-6px]',
          'isolate w-max rounded-xl p-1',
          'outline outline-transparent focus:outline-hidden',
          'overflow-y-auto',
          'bg-bg-elev/95 backdrop-blur-xl',
          'shadow-lg ring-1 ring-border',
          'transition data-leave:duration-100 data-leave:ease-in data-closed:data-leave:opacity-0'
        )}
      >
        {children}
      </Headless.ListboxOptions>
    </Headless.Listbox>
  );
}

// Visual separator between the reset row and real options. Matches DropdownDivider styling.
export function ChipDivider() {
  return <hr className="mx-3 my-1 h-px border-0 bg-border-soft" />;
}
