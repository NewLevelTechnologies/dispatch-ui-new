// ─────────────────────────────────────────────────────────────────────────────
// FilterChipListbox — single- or multi-select filter chip used above list tables.
//
// Empty state shows "+ Label" with a neutral border. Set state shows
// "Label: Value ×" with an accent-tinted background. Clicking the body opens
// a Listbox popover; × is a sibling button that clears.
//
// Listbox (not Menu) is the correct primitive: screen readers announce
// "<option>, selected" for the currently-applied filter via aria-selected,
// which a menu can't communicate. Keyboard nav, type-ahead, Esc-to-close,
// click-outside, and floating positioning, and (in multi mode) Space-to-toggle
// without closing all come from Headless UI — don't hand-roll any of it.
//
// SINGLE-SELECT (default):
//   value: string | null. The reset row uses <ListboxOption value={null}>.
//   Hosts pass `value={x || null}` so empty-string URL params map cleanly.
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
//
// MULTI-SELECT:
//   value: string[]. No reset row; clearing happens via the × button (or by
//   deselecting every option). Caller formats displayValue per their rules
//   (e.g. "Installation, Service" for 2; "3 selected" for 3+).
//
//   <FilterChipListbox
//     multiple
//     label="Type"
//     ariaLabel="Type"
//     value={typeIds}
//     displayValue={formatMulti(typeIds, lookup)}
//     onChange={(ids) => updateParams({ type: ids, page: null })}
//     onClear={() => updateParams({ type: [], page: null })}
//   >
//     {types.map((t) => <ListboxOption key={t.id} value={t.id}>{t.name}</ListboxOption>)}
//   </FilterChipListbox>
// ─────────────────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';
import * as Headless from '@headlessui/react';
import clsx from 'clsx';

type BaseProps = {
  label: string;
  ariaLabel: string;
  displayValue?: string | null;
  onClear?: () => void;
  children: ReactNode;
};

type SingleProps = BaseProps & {
  multiple?: false;
  value: string | null;
  onChange: (value: string | null) => void;
};

type MultiProps = BaseProps & {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
};

type Props = SingleProps | MultiProps;

export function FilterChipListbox(props: Props) {
  const { label, ariaLabel, displayValue, onClear, children } = props;

  // isSet drives the accent tint + × button visibility. In single mode it's
  // "value != null and we have a label to show"; in multi mode it's "at least
  // one id picked". Caller controls displayValue formatting in both modes.
  const isSet =
    props.multiple === true
      ? props.value.length > 0
      : props.value != null && displayValue != null && displayValue !== '';

  const shell = (
    <>
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
    </>
  );

  // Conditional render — Headless.Listbox's value/onChange types depend on
  // `multiple`, so we can't conditionally spread without fighting TS. Two
  // small JSX blocks is cleaner than the cast gymnastics.
  if (props.multiple === true) {
    return (
      <Headless.Listbox multiple value={props.value} onChange={props.onChange}>
        {shell}
      </Headless.Listbox>
    );
  }
  return (
    <Headless.Listbox value={props.value} onChange={props.onChange}>
      {shell}
    </Headless.Listbox>
  );
}

// Visual separator between the reset row and real options. Matches DropdownDivider styling.
export function ChipDivider() {
  return <hr className="mx-3 my-1 h-px border-0 bg-border-soft" />;
}
