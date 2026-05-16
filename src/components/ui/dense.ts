// ─────────────────────────────────────────────────────────────────
// dense.ts — className presets for restyling Catalyst form primitives
// to match this design system's denser scale.
//
// Goal: KEEP Catalyst's <Input>, <Select>, <Field>, <Label>, <Switch>,
// <Textarea> — they have accessibility, focus, validation integration
// baked in. We're only changing visual scale.
//
// Pass these via `className` (or merge with whatever Catalyst exposes).
//
//   import { dense } from '@/components/ui/dense';
//   import { Field, Label, Input } from '@/components/catalyst/...';
//
//   <Field className={dense.field}>
//     <Label className={dense.label}>Customer address</Label>
//     <Input name="address" className={dense.input} />
//   </Field>
//
// Tailwind v4 important-modifier syntax: trailing `!` (was leading `!`
// in v3). Without the bang Catalyst's own utilities win.
// ─────────────────────────────────────────────────────────────────

export const dense = {
  /** Compact Field wrapper — minimal margin between Label and Input. */
  field: 'mb-2!',

  /** Smaller, uppercase label that matches our other section labels. */
  label:
    'text-[10px]! font-semibold! uppercase! tracking-[0.06em]! ' +
    'text-fg-muted! mb-1!',

  /** Text-style inputs — 32px tall, 12.5px text. */
  input:
    'h-8! text-[12.5px]! px-2.5! rounded-md! ' +
    'bg-bg-elev! border-border! text-fg-strong! ' +
    'placeholder:text-fg-dim! ' +
    'focus:border-accent-500! focus:ring-2! focus:ring-accent-500/15!',

  /** Select dropdowns — same height/text as input. */
  select:
    'h-8! text-[12.5px]! px-2.5! pr-8! rounded-md! ' +
    'bg-bg-elev! border-border! text-fg-strong! ' +
    'focus:border-accent-500! focus:ring-2! focus:ring-accent-500/15!',

  /** Textareas — same character as input, multi-line. */
  textarea:
    'text-[12.5px]! px-2.5! py-2! rounded-md! leading-[1.5]! ' +
    'bg-bg-elev! border-border! text-fg-strong! ' +
    'placeholder:text-fg-dim! ' +
    'focus:border-accent-500! focus:ring-2! focus:ring-accent-500/15!',

  /** Smaller switch — pair with smaller label text. */
  switch: 'h-[18px]! w-[30px]!',

  /** Smaller checkbox to match form scale. */
  checkbox: 'h-3.5! w-3.5!',

  /** Inline help text under an input. */
  hint: 'text-[10.5px]! text-fg-dim! mt-1!',

  /** Error / validation text under an input. */
  error: 'text-[10.5px]! text-danger-500! mt-1! font-medium!',

  /** Two-column field row — drop a couple <Field> inside. */
  row: 'flex gap-2.5 mb-2 [&>*]:flex-1',
};

// Optional helper if you want to apply many presets at once on a parent
// — wraps a form so EVERY field inside renders dense without per-field
// className. Use this when an entire admin form should be dense.
export function withDensity(parentClass = '') {
  return [
    parentClass,
    '[&_label]:text-[10px]! [&_label]:font-semibold! [&_label]:uppercase! [&_label]:tracking-[0.06em]! [&_label]:text-fg-muted!',
    '[&_input]:h-8! [&_input]:text-[12.5px]!',
    '[&_select]:h-8! [&_select]:text-[12.5px]!',
    '[&_textarea]:text-[12.5px]!',
  ].filter(Boolean).join(' ');
}
