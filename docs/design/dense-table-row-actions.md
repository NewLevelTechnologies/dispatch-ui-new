# Dense table row actions — use IconButton, not Catalyst Button

**Status:** convention. Swept across all `src/pages/*.tsx` list and detail pages
(2026-05-17). Default for any new `<DenseTable>` row trigger.

## TL;DR

Inside `<DenseTable>` rows, render the row's action menu trigger as
`<DropdownButton as={IconButton}>`, not the default `<DropdownButton plain>`.

```tsx
// ❌ Will make the row ~55-60px tall.
<Dropdown>
  <DropdownButton plain aria-label="More options">
    <EllipsisVerticalIcon />
  </DropdownButton>
  ...
</Dropdown>

// ✅ Row stays at ~42px to match the rest of the dense table.
<Dropdown>
  <DropdownButton as={IconButton} aria-label="More options">
    <EllipsisVerticalIcon className="size-4" />
  </DropdownButton>
  ...
</Dropdown>
```

`IconButton` lives at `src/components/IconButton.tsx`.

## Why

Catalyst's `<Button>` (the default `DropdownButton` element) enforces a touch-target
floor:

- `py-[calc(--spacing(2.5)-1px)]` → ~9px vertical padding
- `*:data-[slot=icon]:my-1` → 4px top + 4px bottom margin around the icon
- `*:data-[slot=icon]:size-4` → 16px icon

Total trigger height ≈ 16 + 8 (icon margin) + 18 (button padding) = **~42px**, and the
rendered border-box height ends up around 36–44px depending on the icon set.

`.dense-table tbody td` has 9px top + 9px bottom padding. With a 13px text line it's
~31px. Drop a 36–44px button into the action cell and the row jumps to **55–60px**.

`IconButton` renders as a plain `<button>` with `p-0.5` (4px) and a `size-4` icon →
~20px tall, which stays inside dense-table's natural row height.

You see this clearly by comparing **Notification Templates** (action is a plain
`<button>Customize</button>`, rows ~42px) against **Item Statuses / Equipment Types
/ Users / Roles** before the fix (`<DropdownButton plain>`, rows 55–60px).

## Why it doesn't show on the main list pages (today)

`CustomersPage`, `WorkOrdersPage`, `ServiceLocationsPage`, `EquipmentPage`, etc. all
use `<DropdownButton plain>` too, but their rows have `CellStack` content (two-line
cells like address + city/state/zip). That intrinsic content is already taller than
the Catalyst Button, so the button is absorbed and the row's height is driven by the
text, not the trigger. Sparse rows on those pages (all dashes, no second line) **will**
pop taller than their neighbours — that's the same root cause, just less visible.

## Still on the old pattern

These two render through Catalyst's `<Table dense>` (not the `.dense-table` /
`DenseTable` primitive this doc targets), so the height math is different and they
weren't touched in the sweep:

- `src/components/FinancialQuotesTab.tsx`
- `src/components/WorkItemsTable.tsx`

If either is migrated to `DenseTable` later, swap the trigger to `IconButton` at the
same time.

## Don't fight Catalyst's defaults

If you find yourself adding `className` overrides to a Catalyst `Button` to fight its
height (`!h-7`, custom padding, etc.), that's the signal to reach for `IconButton`
(or the `.btn.sm` class from `components.css` for non-icon-only triggers) instead.
Catalyst's `Button` is correctly sized for primary actions on a page — it's the wrong
component for inline row controls.
