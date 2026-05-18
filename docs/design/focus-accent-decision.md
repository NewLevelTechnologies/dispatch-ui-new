# Focus indicators: blue (current) vs accent (explored, reverted)

## Context

We tried converting every focus indicator (form-control rings, button/checkbox/radio/switch/avatar/badge outlines, dropdown-item focus background) from Tailwind `blue-500` to our brand `accent-500`, expecting that brand-tinted focus would feel more tailored. It read as over-saturated — accent was already carrying the brand mark, the active sidebar nav item, and the picker's active state, and adding it to every keyboard-focus indicator made the page feel monochrome-orange (or monochrome-teal when the cool toggle was active). Reverted in commits `b9c657e` (12 ring/outline reverts) and `b478953` (the dropdown focus-bg revert).

Brand accent now lives in: brand chip, sidebar active-item left bar, theme/accent picker active state, primary Buttons (`color="accent"`), `ViewTabs` active underline, `FilterChip` set-state border, and the `Pagination` current-page background. Everything else (focus, hover) is neutral.

## Current state (verified 2026-05-16)

| File:Line | Class | Element |
|---|---|---|
| `src/components/catalyst/input.tsx:47` | `sm:focus-within:after:ring-blue-500` | Input focus ring |
| `src/components/catalyst/select.tsx:21` | `has-data-focus:after:ring-blue-500` | Select focus ring |
| `src/components/catalyst/textarea.tsx:25` | `sm:focus-within:after:ring-blue-500` | Textarea focus ring |
| `src/components/catalyst/listbox.tsx:38` | `data-focus:after:ring-blue-500` | Listbox focus ring |
| `src/components/catalyst/combobox.tsx:50` | `sm:focus-within:after:ring-blue-500` | Combobox focus ring |
| `src/components/catalyst/button.tsx:13` | `data-focus:outline-blue-500` | Button focus outline |
| `src/components/catalyst/checkbox.tsx:64` | `group-data-focus:outline-blue-500` | Checkbox focus outline |
| `src/components/catalyst/radio.tsx:70` | `group-data-focus:outline-blue-500` | Radio focus outline |
| `src/components/catalyst/switch.tsx:164` | `data-focus:outline-blue-500` | Switch focus outline |
| `src/components/catalyst/avatar.tsx:71` | `data-focus:outline-blue-500` | Avatar (as button) focus outline |
| `src/components/catalyst/badge.tsx:66` | `data-focus:outline-blue-500` | Badge (as link) focus outline |
| `src/components/catalyst/table.tsx:67` | `has-[[data-row-link][data-focus]]:outline-blue-500` | TableRow (when row is a link) focus outline |
| `src/components/catalyst/dropdown.tsx:67` | `data-focus:bg-blue-500` | DropdownItem keyboard-focus background |

13 hits total, 13 files.

## To re-apply accent (find/replace)

| From | To | Files |
|---|---|---|
| `ring-blue-500` | `ring-accent-500` | 5: `input.tsx`, `select.tsx`, `textarea.tsx`, `listbox.tsx`, `combobox.tsx` |
| `outline-blue-500` | `outline-accent-500` | 7: `button.tsx`, `checkbox.tsx`, `radio.tsx`, `switch.tsx`, `avatar.tsx`, `badge.tsx`, `table.tsx` |
| `data-focus:bg-blue-500` | `data-focus:bg-accent-500` | 1: `dropdown.tsx` |

Each file has exactly one occurrence — `replace_all` per file is safe. Total: 13 line edits across 13 files.

## Why blue (the current call)

- **Convention.** Blue focus is the OS / browser / WCAG default. Sighted keyboard users and screen-reader users alike are calibrated to recognize it as "this is the focused element" without thinking.
- **Contrast.** `--accent-500` against the warm-paper canvas (`oklch(98.4% 0.004 80)` light, `oklch(17% 0.008 250)` dark) is in the same lightness family as the background and reads softer than blue against the same surfaces. Blue stays clearly separated.
- **Accent budget.** Brand mark, active sidebar nav, primary CTAs, view-tabs underline, set-state filter chips, current page in pagination — accent already carries identity and location signals. Adding interaction state to that list overloads the meaning.
- **Brand-storytelling value is low.** Focus rings flash for milliseconds during keyboard nav. The accessibility weight is high; the design weight is low. Spending the brand color here is asymmetric.
- **Empirical.** When applied across the board, the page read as over-saturated even though each individual use was defensible.

## Why accent (if we revisit)

- **Cohesion.** Focus following the warm/cool toggle does feel intentional — a small detail that says "we thought about this."
- **Differentiation.** Distinguishes the app from anything else built on default Catalyst / Headless UI.
- **Toggle reinforcement.** Makes warm/cool a real preference that shows up in interaction, not just decoration.

## Things to verify before re-applying

- **Contrast.** Test `--accent-500` (warm: `oklch(68% 0.185 50)`; cool: `oklch(56% 0.125 215)`) against `--bg`, `--bg-sunken`, `--bg-elev` in both light and dark themes. Focus indicators are non-text UI; the WCAG floor is 3:1 against the adjacent background. Cool accent against `--bg-elev` in light mode is the most likely failure case — lightness 56% on lightness 100% surface.
- **Keyboard nav test.** Tab through a dense form (Edit Customer dialog, Create Work Order dialog). Does the warm ring feel directional or distracting? Did we lose the "where am I?" clarity?
- **Dark mode.** Equally important — focus indicators in dark mode often need *more* chroma to pop against a dark surface, and the warm hue at 68% lightness may sit too close to dark-mode surface chroma to read clearly.
- **Bundle scope.** Last time we treated all 13 hits as one decision. Consider whether the dropdown-item focus background (a full-bleed fill that already wins on contrast against the menu) is a separate call from the thin outline/ring on form controls. They have different visual weight.

## Related changes that stay either way

- **Chevron strokes** — `stroke-zinc-* → stroke-fg-muted` / `stroke-fg-dim` / `stroke-fg-strong` on `select.tsx:56`, `listbox.tsx:68`, `combobox.tsx:88`. Not focus indicators, just static SVG glyphs that should match the warm-paper text family.
- **Shell + Catalyst Group 1/2 token conversions** from the earlier audit (sidebar, topbar, navbar, heading, input/select/dropdown/pagination internals, AppLayout theme picker). Those fixed real palette drift, not a design preference.
