# Phase 7 — Financial Detail Drawer

Status: Design locked (2026-05-14)  
Owner: Paul Wilcox  
Parent: [WORK_ORDER_DETAIL_DESIGN.md](./WORK_ORDER_DETAIL_DESIGN.md) §3.1 (header chips), §3.5 (drawer pattern), §5 phase 7, §5c (NTE follow-up)

This is the canonical Phase 7 spec. It consolidates and supersedes the three earlier drafts (`PHASE7_FINANCIAL_DRAWER.md`, `WO_PHASE_7_FINANCIAL_DRAWER.md`, `PHASE_7_FINANCIAL_DRAWER_DESIGN.md`), which were independent design passes. When 7a starts landing, fold the relevant sections back into the parent design doc as inline updates.

---

## 1. The big constraint: line items are not ours to design yet

The existing `InvoiceFormDialog` / `QuoteFormDialog` / `PaymentFormDialog` are placeholders. They function, but they will be rebuilt when the inventory architecture (see `dispatch-api/docs/planning/INVENTORY_ARCHITECTURE.md`) lands. The deep dependency is **line items** — invoice and quote lines end up backed by:

- `Part` master catalog references (`InvoiceLineItem.partId`)
- Cached supplier cost (`costEach`)
- Sourcing reference (`supplierPartMappingId`)
- Stock movement linkage (`stockMovementId`)
- Pricing-rule-driven `unitPrice` auto-fill
- Auto-creation from work-order parts usage (`StockMovement → InvoiceLineItem`)

A polished line-item editor *now* fights that future. Every prop, every helper button, every pre-fill pattern we add to the placeholder dialogs becomes throwaway work that drags inventory rework along with it.

**The reframe:** Phase 7 is **financial visibility in WO context + the write paths that don't touch line items**. It is *not* "financial CRUD with full line-item editing in the drawer." The drawer reads what's billed and paid; creation is supported as a **minimal lump-sum** flow (single description + amount), which the backend stores as one custom line item under the hood. The full inventory-aware create rebuild waits for inventory.

**Why lump-sum is forward-compatible:** the inventory doc defines `InvoiceLineItem.partId` as nullable for custom (non-stocked) lines — labor, service charges, one-offs. A lump-sum invoice is just an invoice with a single custom line item. Anything we create now lands as `[{description, quantity: 1, unitPrice: amount, partId: null}]` and stays valid after inventory ships. No data migration risk.

This applies the "don't pre-implement future state" rule explicitly. The earlier drafts' best UX ideas (Convert-to-Invoice, Add-lines-from-work-items, line-item inline expansion, locked-WO-id props on the placeholder form dialogs) are not lost — they're parked in §8 below for the post-inventory rework.

---

## 2. Slicing

| Slice | Ships | Notes |
|---|---|---|
| **7a** | Drawer shell · Invoices tab (read + status edits + minimal lump-sum create) · Payments tab (read + record + void) · header money chips · NTE migration | Quote create deferred to 7b |
| **7b** | Quotes tab (read + status edits + minimal lump-sum create) · `$ quoted` chip joins header | Requires `Quote.workOrderId` backend ask |
| **7c** | Purchase Orders | Separate design pass; deferred indefinitely (no backend entity) |
| **post-inventory** | Full invoice/quote create *enhancement* — parts picker, pricing rules, auto-seeding from WO parts usage, Convert-to-Invoice, linked-entity chips on work items. Lump-sum mode remains as a quick path. | See §8 |

---

## 3. The drawer (7a)

### 3.1 Shell

- One `SlideOver`, `!max-w-[800px]` (mid-range of §3.5's 760–840). Single mount; content swaps on tab change. Reference implementations: `EquipmentQuickViewDrawer` (480px), `ActivityDrawer` (~448px). Financial is the widest by design because of tabular density.
- **Tabs across the top: `Quotes · POs · Invoices · Payments`.** WO-lifecycle (chronological) order — Quote (estimate-before-work, sometimes) → PO (mid-job procurement, sometimes) → Invoice (bill after work, always) → Payment (customer pays, always, last). The earlier "click-frequency order" framing was a telemetry-free guess; chronological matches the CSR mental model of "where is this WO in its arc?" and reads consistently regardless of which stage a given WO is in. Default landing tab is still Invoices (the live billable surface) when no specific tab is requested.
- **Tab badge counts**: `Invoices (3)`, `Payments (2)`. Stub tabs show no count.
- **Drawer header**: `Financials · WO #1234` + close. Below the tabs, a one-line summary strip mirrors the chip-row numbers so totals stay visible while scanning a tab.
- **Drawer-over-drawer / dialog-over-drawer** behavior is the established pattern (§3.5, EquipmentQuickViewDrawer in §5b). Drawer stays mounted under dialogs, visually dimmed. `Esc` closes topmost — formalized here as canonical across all surfaces.

### 3.2 Initial active tab

Determined by which chip the user clicked:

| Chip | Tab | Action on open |
|---|---|---|
| `$ invoiced` | Invoices | none |
| `Bal` | Invoices | none |
| `$ paid` | Payments | none |
| `$ quoted` (7b) | Quotes | none |
| `[+ Invoice]` ghost | Invoices | open create dialog |
| `[+ Quote]` ghost (7b) | Quotes | open create dialog |
| `NTE` | inline edit at the chip; **no drawer** | n/a |

`Bal` does not apply a "balance > 0" table filter in v1 — the Invoices tab is short on most WOs and the Balance column already makes outstanding items visible without filtering. Add a default filter later if WOs commonly accumulate >5 invoices (§7).

Ghost chips (`[+ Invoice]`, `[+ Quote]`) are the bootstrap entry from the chip row when summary is zero (§5.3). They land on the matching tab AND open the create dialog in one click — the disambiguation step that a generic `[+ Financials]` chip would have forced.

### 3.3 Tab tables

Dense Catalyst `Table` with the `dense` prop + `[--gutter:theme(spacing.1)] text-sm` per CSR patterns. Status pills inline-editable. `⋯` per-row menu for workflow actions.

**`+ New Invoice` button** in the Invoices tab header (right-aligned) opens the minimal lump-sum invoice dialog (§4.2). Ships in 7a.

**`+ New Quote` button** in the Quotes tab header — ships in **7b**, blocked on backend ask #6 (`Quote.workOrderId`). In 7a the Quotes tab is a stub with "Coming soon" copy.

**No `+ New` button on the Payments tab header** — payment creation lives behind the `+ Record Payment` button at the top of the tab body, which opens the Payment dialog (§4.3). Functionally the same; the wording emphasizes that payments are *recorded against an existing invoice*, not standalone documents.

**Empty states** for Invoices/Quotes/Payments: muted copy. Invoices and Payments empty states include the same `+ New X` / `+ Record Payment` button as the tab header. Use `getName('invoice', true)` per glossary patterns.

| Tab | Columns | Row click | Row `⋯` |
|---|---|---|---|
| Invoices | `Invoice # · Date · Due · Status · Total · Paid · Balance` | Inline-expand line items (read-only) + notes | Send · Mark paid · Void · Print |
| Payments | `Payment # · Date · Method · Amount · Invoice # · Reference` | No expansion (flat record) | Void (with confirm) |
| Quotes (7b) | `Quote # · Date · Expires · Status · Total` | Inline-expand line items (read-only) | Send · Mark accepted · Mark declined |
| POs | — | — | — |

**Status pill colors:**

- Invoices: `zinc` DRAFT · `sky` SENT · `lime` PAID · `amber` OVERDUE · `zinc` CANCELLED/VOID
- Quotes: `zinc` DRAFT · `sky` SENT · `lime` ACCEPTED · `rose` DECLINED · `amber` EXPIRED
- Payments: no status pill in v1 (voided rows render with muted styling)

**Invoice # chip in Payments tab**: click switches active tab to Invoices and expands the matching row.

**Stub tabs (Quotes in 7a, POs in 7a/7b)**: empty state, no `+ New` button, copy "Coming soon." Reserves the architecture without misleading the user.

### 3.4 Row expansion (read-only line items)

When a CSR expands an invoice or quote row, render the current line items as a small read-only sub-table inside the row. Today's placeholder line-item shape (description · qty · unit price · total) is fine for read; we are explicitly **not** investing in inline editing, fancy formatting, or part-picker hooks here. When inventory lands the line-item renderer gets rebuilt as part of §8.

### 3.5 Closing the drawer

- Click outside (when no dialog is open over it)
- X affordance
- `Esc` closes topmost surface (dialog first if open, then drawer)

---

## 4. Create dialogs

Three minimal write surfaces ship in Phase 7. None of them touch line items or depend on inventory. All three are **new, purpose-built dialogs** — we do *not* reuse or polish the existing placeholder `InvoiceFormDialog` / `QuoteFormDialog` / `PaymentFormDialog`. Those stay where they are for the standalone pages; their replacement happens in §8 alongside inventory.

### 4.1 Layout principles (all three dialogs)

- Catalyst `Dialog`, single-column form, dense spacing per the form-density rule (`mt-4`/`mt-2`, paired fields side-by-side where they're related, ≤1-line descriptions).
- **Locked context strip** at the top: `Work Order #1234 · Customer Name`. Read-only, not a field — context for the CSR.
- Opens *over* the financial drawer; drawer stays mounted underneath, dimmed. `Esc` closes the dialog (not the drawer).
- On successful save, dialog closes, drawer refreshes (invalidates `['financial-summary', woId]` + the relevant tab's list query).

### 4.2 Invoice dialog (7a) — minimal lump-sum

For "create a basic invoice against this WO" without line-item editing. CSR enters a single description + amount; backend stores it as one custom line item (`partId: null, quantity: 1, unitPrice: amount`). Forward-compatible with the inventory rebuild (§8.1).

```
Locked context strip: Work Order #1234 · Customer Name

Invoice Date    [date, default today]      Due Date     [date, default +30d]
Description     [textarea — "Service call diagnosis and repair"]
Amount          [currency]
Notes           [textarea, optional]

                              [Cancel]  [Save as Draft]  [Save & Send]
```

**Width: ~520px.** Date pair side-by-side; description and notes full width.

**Field notes:**

- **Description**: free text. This becomes the single line item's description on the backend. Encourage CSRs to write what the bill is *for* in customer-readable language ("Diagnostic + condenser fan motor replacement").
- **Amount**: total invoice amount, pre-tax. Tax handling is out of scope for v1; if a CSR needs to split tax out, they can use the standalone Invoices page until §8.1 ships. Backend stores `totalAmount = amount, taxAmount = 0` for v1 lump-sum invoices.
- **Save buttons**:
  - `[Save as Draft]` → `POST /financial/invoices` with status DRAFT.
  - `[Save & Send]` → same create, then immediately `updateStatus(SENT)` in a chained mutation.

**Backend wiring** (verify before build):
- Existing `POST /financial/invoices` accepts `workOrderId` + `customerId` (both pre-filled from WO).
- Body submits `lineItems: [{description, quantity: 1, unitPrice: amount}]` — a single auto-generated line. If the existing endpoint requires line items in a different shape or doesn't accept this body, file as a small additional backend ask (no new endpoint, just contract alignment).

### 4.3 Quote dialog (7b) — minimal lump-sum

Mirror of the invoice dialog, blocked on backend ask #6 (`Quote.workOrderId`). Ships in 7b alongside the Quotes tab activation.

```
Locked context strip: Work Order #1234 · Customer Name

Quote Date      [date, default today]      Expires      [date, default +30d]
Description     [textarea — "Replace 3-ton condenser + R-410A recharge"]
Amount          [currency]
Notes           [textarea, optional]

                              [Cancel]  [Save as Draft]  [Save & Send]
```

Same shape, two differences from the invoice dialog: `Due Date` → `Expiration Date`, and `Save & Send` puts the quote in SENT status (still pre-billing, no tax handling either way).

### 4.4 Payment dialog (7a)

Recording a payment doesn't create a new financial document — it's a transaction against an existing invoice. Simplest of the three dialogs.

```
Locked context strip: Work Order #1234 · Customer Name

Invoice         [dropdown — this WO's invoices with balanceDue > 0, format "INV-001 · Bal $1,234"]
Payment Date    [date, default today]      Method       [select]
Amount          [currency, auto-fill to selected invoice's balanceDue]
Reference #     [text, optional — check number / transaction id]
Notes           [textarea, optional]

                                                  [Cancel]  [Record Payment]
```

**Width: ~480px.**

**Behavior:**

- Invoice picker preselects when exactly one open invoice exists. Disabled with helper "No outstanding invoices on this WO" when none — the `+ Record Payment` button in the tab header is also disabled in that state, with the same helper.
- Amount auto-fills to the selected invoice's `balanceDue` (pay-in-full is the common case). CSR can override for partial payments. No validation enforcing `amount ≤ balanceDue` — allow overpayment, let accounting resolve.
- Method options: `CASH · CHECK · CREDIT_CARD · DEBIT_CARD · ACH · WIRE_TRANSFER · OTHER`.
- On submit: create payment. Backend reduces `amountPaid`/`balanceDue` on the selected invoice and auto-promotes status to `PAID` at zero balance (backend ask #5).

### 4.5 Payment void flow

Payments tab `⋯ → Void` shows a confirmation dialog ("Void payment for $1,234 against INV-001? This cannot be undone."), then calls `POST /financial/payments/{id}/void` (backend ask #4). Backend reverses `amountPaid`/`balanceDue` on the invoice and demotes its status from PAID if applicable. UI invalidates `['financial-summary', woId]` and the invoice/payment list queries.

---

## 5. Money chip row (header row 3)

### 5.1 Layout

```
[+ Set NTE]  │  [+ Invoice]                                          (fresh WO 7a)
[+ Set NTE]  │  [+ Quote] · [+ Invoice]                              (fresh WO 7b)
NTE $12K  │  [+ Invoice]                                             (NTE set, no activity yet — 7a)
NTE $12K  │  $3.2K invoiced · $0 paid · Bal $3.2K                    (7a, full)
[+ Set NTE]  │  $3.2K invoiced · $0 paid · Bal $3.2K                 (activity, no NTE)
NTE $12K  │  $9.8K quoted · $3.2K invoiced · $0 paid · Bal $3.2K     (7b, full)
```

(Layout states after the drawer-shell branch lands. The current chip-row branch ships the "full" states only — the typed-ghost states require the drawer as their click target. See §5.3 implementation phasing.)

- **NTE on the left** with a leading separator from the right cluster. NTE is settable (contract cap) and represents a different role than derived totals — different visual weight.
- **Right cluster on the right**, separated by middot. Each chip clickable → drawer at the matching tab. Live chips (derived totals) and ghost chips (typed entry points) share the same separator vocabulary — the visual rule is "everything to the right of the `│` is a financial document or its entry point."
- **Compact display**: `$9.8K`, `$1.2M`, `$847`. Full precision in `title` tooltip and inside the drawer. CSRs scan from the header; they don't audit from it.

### 5.2 Bal chip color signal

- `zinc` when balance is 0, or partial-pay in progress and nothing overdue
- `amber` when invoiced > 0 and paid = 0 (outstanding but not late)
- `rose` when any invoice on the WO is OVERDUE

All other chip values are plain text — no color signal on quoted / invoiced / paid.

### 5.3 Reveal logic

**Revised 2026-05-14 (Option B).** The earlier draft hid the entire row on truly fresh WOs, treating the chip cluster as a derived-only display surface. That worked for display but broke the bootstrap path — chips were the only entry to the drawer (§3.2), and hiding them on fresh WOs left CSRs no way to create the first invoice / quote from the WO page. The replacement design treats the chip row as **the canonical financial entry surface**, not just a display. It always renders (once the drawer is wired); contents change with state.

**The row always renders** once the drawer-shell branch lands. Before that branch, ghost chips have no click target, so the chip row uses the legacy "hide when both NTE and summary are zero" rule as a transitional state — there is no half-shipped affordance.

**Within the row, by state:**

- NTE slot — `NTE $X` when set, or a muted `[+ Set NTE]` ghost when unset. Click → inline edit (same `EditableField` pattern as today's Order Info NTE entry). Cancelled/archived: read-only when set, omitted when unset.
- Derived cluster — when `financial-summary` returns any non-zero value, render the full cluster `$X invoiced · $Y paid · Bal $Z` together (including `$0 paid` if not yet paid). Avoids the "one lonely chip" look. Each chip click → drawer at the matching tab.
- **Typed ghost cluster** — when `financial-summary` is all-zero, render typed ghost chips for each financial entity that has a buildable drawer tab in the current phase. Each ghost click → drawer at the matching tab + opens the create dialog.
  - 7a: `[+ Invoice]`
  - 7b: `[+ Quote] · [+ Invoice]`
  - 7c (if it ships): `[+ Quote] · [+ Invoice] · [+ PO]`

**Why typed ghosts (not a single generic `[+ Financials]`):** the chip row's job is *fast entry to the right surface*. Typed ghosts collapse the disambiguation step ("which kind of financial doc?") into the visible label and land directly on the correct tab + create flow. The cost is ~2-3 ghost chips of width in the empty state, which is the same density budget as the NTE ghost. Once any activity exists, the typed ghosts disappear and the derived chips take over — typed ghosts are bootstrap-only.

**What the rejected designs got wrong:**

- *Action-cluster `$ / Financials` button (rejected 2026-05-14):* split entry across two affordance vocabularies (button when empty, chips when active). CSRs would learn both surfaces. The chip row is already the financial-entry vocabulary; adding a sibling button fragments it.
- *Activity-threshold gate (e.g. "show ghost only when status past CREATED" — rejected 2026-05-14):* introduces a heuristic for "is this WO real enough to invoice?" that fails for pre-billing (deposit), service-only WOs (no parts logged), and any status-vs-billability mismatch. CSRs hit "I need to invoice this but the ghost is missing" → confusion. The fix is to drop the threshold entirely; ghosts always render when summary is zero.
- *Single generic `[+ Financials]` ghost (rejected 2026-05-14):* "one ghost, drawer picks tab" forces the CSR to disambiguate inside the drawer instead of in the header. Slower path, vague label.

**Implementation phasing:**

| Branch | §5.3 reveal predicate | Why |
|---|---|---|
| `feat/wo-financial-summary-chips` (this work) | Row hidden when no NTE AND zero summary. No typed ghosts yet. | Ghosts need the drawer as their click target; shipping them without the drawer is a "click does nothing" footgun. |
| `feat/wo-financial-drawer-shell` (next) | Row always renders. Typed ghost cluster appears when summary is zero. Click → drawer at the matching tab + create dialog. | Drawer exists; ghosts have a destination. The legacy hide-on-fresh rule retires here. |

### 5.4 NTE single-surface migration (ships in 7a)

- Add NTE chip behavior (display + inline edit + ghost-when-unset) to the header chip row.
- Remove the NTE row from the left-strip Order Info card.
- Move the existing `handleSaveWorkOrderField('notToExceed', ...)` wiring verbatim — same `EditableField`, new home. Don't rebuild.
- One PR, one migration. Completes the §3.1 single-surface consolidation.

---

## 6. Backend asks

Block 7a until 1–4 land. "Backend-first when there's a gap" applies — no client-side rollup from list endpoints.

### Required for 7a

| # | Ask | Why |
|---|---|---|
| 1 | `GET /financial/work-orders/{id}/summary` → `{ invoiced: BigDecimal, paid: BigDecimal, balance: BigDecimal, currency: String }` (add `quoted` in 7b). **Lives on financial-service**, not work-order-service. Live aggregation — no caching, no denormalization onto `work_orders`. Returns 200 with zero totals when nothing matches (RLS makes "no activity" / "wrong tenant" / "doesn't exist" indistinguishable; trying to distinguish them is a leak anyway). Frontend pairs this with `GET /work-orders/{id}` as parallel React Query calls. See §11 for why caching was rejected. | Chip row is in the sticky header — must be cheap, must not drift from drawer-table sums. Live `SUM` over `invoices.work_order_id` + `payments.invoice_id` on existing indexes is sub-50ms on realistic data; caching only adds drift risk and cross-service write coupling without buying anything. |
| 2 | `GET /work-orders/{id}/invoices` | Today only `getByCustomer` exists; client-side filtering loads more than needed. |
| 3 | `GET /work-orders/{id}/payments` | Payment is invoice-scoped today; one WO-rollup endpoint beats client-side stitching. |
| 4 | `POST /financial/payments/{id}/void` (or `PATCH /financial/payments/{id}/status` with `VOID`) | Payments are voided not deleted (audit). Backend reverses `amountPaid`/`balanceDue` on the invoice and demotes status from PAID if applicable. |
| 5 | Auto-promote invoice → `PAID` at zero balance | Confirm backend already does this on payment creation, or add. Frontend should not infer status from amounts. |
| 6 | Confirm `POST /financial/invoices` accepts a single-line-item body shaped `{ workOrderId, customerId, invoiceDate, dueDate, notes, lineItems: [{description, quantity: 1, unitPrice: amount}] }` and returns the created invoice with status DRAFT | Powers the minimal lump-sum invoice dialog (§4.2). Should require no new endpoint — just contract confirmation. If the existing endpoint enforces a stricter shape (e.g. requires a `partId` per line), file a small follow-up to relax it. |

### Required for 7b

| # | Ask | Why |
|---|---|---|
| 7 | `Quote.workOrderId?: UUID?` nullable column + add to `CreateQuoteRequest` + add to Quote response | Quote has no WO reference today. Customer-scoped quotes stay valid; the WO link is additive. |
| 8 | `GET /work-orders/{id}/quotes` | Same shape as ask #2. |
| 9 | `GET /financial/work-orders/{id}/summary` extends its response with `quoted: BigDecimal` (live `SUM` over `quotes.work_order_id` excluding DECLINED/EXPIRED). Same endpoint as ask #1, additive field. | Powers the `$ quoted` header chip. |
| 10 | Confirm `POST /financial/quotes` accepts the analogous single-line-item body once #7 lands | Same as ask #6 for the quote dialog. |

### Required for 7c

| # | Ask | Why |
|---|---|---|
| 11 | Full `PurchaseOrder` entity + endpoints + status workflow + line items + (optionally) receiving | Punt to 7c's own design pass. |

### Explicitly NOT asked

- **Invoice/quote edit endpoints.** Real billing freezes after send; void + recreate is the v1 workflow. The current API surface (`create` + `updateStatus`) is correct for 7a/7b.
- **`InvoiceLineItem.workItemId`.** Already deferred per §2.3. Build when per-work-item profitability reporting earns it (§8).
- **Tenant-config defaults** (default due-date offset, default tax rate, default quote expiration). Hardcode v1 defaults; revisit when the tenant settings page covers this.
- **Multi-jurisdiction tax.** Single tax rate per invoice is enough.
- **Refund flow.** Separate design pass; flagged in §7.

---

## 7. Open questions to resolve during 7a

These don't block design but need answers before / during the matching build step.

1. **Status pill transition graph.** What transitions are valid via `updateStatus()` vs server-derived? `OVERDUE` is likely date-based; confirm. `Invoice DRAFT → SENT → (PAID | OVERDUE | CANCELLED | VOID)` is the expected graph but needs backend confirmation.
2. **`⋯` row actions per entity.** First-pass list above is a starting point — confirm with first real CSR pass.
3. **Default sort / `updatedAt` in tab tables.** Default date desc; confirm with first real CSR pass.
4. **Print / PDF render for invoices and quotes.** Currently surfaced as a `Print` action in the per-row `⋯` menu, but the actual render is undefined. Could be its own small slice between 7a and 7b. Out of scope for this doc.
5. **Refund flow.** `paymentsApi` has no refund method today and the inventory doc doesn't address it. Separate design; flag for follow-up after 7a ships.
6. **Filtering inside drawer tabs.** Not required for v1. Add if WOs commonly accumulate >5 invoices.

---

## 8. After inventory ships — the parked ideas

This section preserves the good UX from the earlier drafts that we're explicitly *not* building in 7a/7b because line items are not ours to design yet. When the inventory architecture lands (see `dispatch-api/docs/planning/INVENTORY_ARCHITECTURE.md`), revisit this list and run a fresh design pass on the create/edit flows.

### 8.1 Invoice / Quote create enhancement

The minimal lump-sum dialogs from §4.2 and §4.3 stay. The enhancement work adds a line-items mode alongside the lump-sum field. Specifically:

- **Add a line-items table** below the lump-sum amount field, collapsed by default. Toggle: `[+ Add line items]` expands it; once expanded, the lump-sum amount field hides and Total is computed from line totals.
- **Line-items table structure**:
  - Description column backed by a **parts picker** (typeahead against the `Part` master catalog from the inventory service).
  - Qty · Unit Price · Line Total. Unit price auto-fills from `Part.standardPrice` if set, or from `PricingRule` markup applied to cached supplier cost.
  - **Cost column (admin-visible, optional)** showing `costEach` from the part's supplier mapping, so CSR/manager can see margin while editing.
  - Free-text line for non-stocked items (labor, service charges, custom one-offs). Same row schema, `partId = null`. This is the same shape today's lump-sum dialog already produces — backward-compatible with everything created during 7a/7b.
- **Lump-sum mode stays** as a quick path. Don't punish CSRs who don't have parts to itemize; for a flat $350 service call, the lump-sum field is faster.
- Tax handling enters the dialog here, not before.

The existing standalone-page `InvoiceFormDialog` / `QuoteFormDialog` placeholders get replaced by this same dialog (used in both contexts). At that point, `lockedWorkOrderId` / `lockedCustomerId` props enter — to pre-fill and lock when opened from the drawer, fall back to pickers when opened from the standalone page. Single source of truth, no drift.

### 8.2 Auto-create invoice lines from work-order parts usage

Per the inventory flow doc (§Use Part on Job):

1. Tech logs parts used on a work order → `StockMovement` (type `JOB_USAGE`, negative qty).
2. Backend (or frontend on the invoice create surface) materializes one `InvoiceLineItem` per movement:
   - `partId`, `description`, `unitOfMeasure`, `quantity` from the part / movement
   - `costEach` from `StockMovement.unitCost`
   - `unitPrice` from pricing rules
   - `stockMovementId` linking back to the inventory event
3. CSR creating an invoice on the drawer sees the **suggested line items already seeded** from the WO's parts usage. They can adjust, remove, or add custom lines before sending.

This is what makes "Add lines from work items" (from earlier draft Doc 2) obsolete — the line items come from *parts used*, not from work-item descriptions. The auto-seed is richer and structurally correct.

### 8.3 Convert-to-Invoice from Quotes

Once line items are inventory-aware, "Convert to Invoice" on an accepted quote opens the new invoice dialog with line items pre-copied from the quote (frontend-only — no new backend endpoint). Same `partId` references, same `costEach`, fresh invoice number and dates.

### 8.4 Margin column on invoice rows / line items

`InvoiceLineItem.costEach` + `unitPrice` enables profit reporting. Surface:

- Per-line margin on the create/edit dialog (admin-visible only)
- Per-invoice margin in a column on the Invoices tab (admin-visible role, hidden for CSR-only roles)
- A summary margin chip somewhere on the WO page or financial drawer header (open question)

### 8.5 Linked-entity chips on work-item rows (§3.3 LINKED block)

Gated on `InvoiceLineItem.workItemId` per §2.3 — an optional nullable FK on the line item back to the work item it billed for. Once present:

- Each work-item row in `WorkItemsTable` expansion shows a `LINKED` block with chips for Quote / Invoice / PO records that reference this work item.
- Clicking a chip opens the financial drawer to that record (Invoices/Quotes/Payments tab, scrolled and expanded to the matching row).
- Enables per-work-item profitability reporting without forcing 1:1 line-to-work-item billing.

### 8.6 In-drawer CTAs ship in 7a/7b; only the *dialogs* get enhanced here

The `+ New Invoice` (7a) and `+ New Quote` (7b) CTAs already live in the drawer. The post-inventory work doesn't add CTAs — it upgrades the dialogs those CTAs open (per §8.1). No UI relocation needed; the CSR keeps the same entry point and gets a richer form.

### 8.7 Inline line-item editing in tab tables

Once line items are first-class entities with `EditableField` semantics, the inline row expansion in the drawer can support edit-in-place for unsent invoices/quotes. Today's read-only expansion (§3.4) becomes editable. Not before.

### 8.8 Pricing rule visibility in the UI

The inventory doc defines `PricingRule` for category-based markup. UI follow-up: where do pricing rules live (settings page?), how does a CSR see *why* a line came out at $25 (tooltip on the unit price?), how are overrides flagged.

---

## 9. Build order

Each step is a separate branch from `dev`. Steps within a slice are mostly sequential; some can overlap.

**7a (current scope):**

1. **NTE chip migration** — independent, smallest, ship first. No backend dependency. Step-1 reveal predicate `notToExceed != null` (deviating from §5.3 hide-on-fresh, which would orphan the only NTE entry point). **Shipped.**
2. **Backend ask #1 lands** (`GET /financial/work-orders/{id}/summary` on financial-service, live aggregation). **Shipped.**
3. **Chip row goes live (derived chips)** — wire ask #1, render `$ invoiced · $ paid · Bal` cluster, §5.2 Bal color signal (zinc/amber; rose deferred until ask #2). Chips display but are non-clickable until step 4. **Shipped.**
4. **Drawer shell + typed-ghost cluster** — `FinancialDrawer` component using `SlideOver` at 800px, four tabs (Invoices, Payments, Quotes, POs; last three stubbed until their backend asks land). Wire chip click → drawer at matching tab. Add typed-ghost cluster (`[+ Invoice]` in 7a) to the chip row when summary is zero (§5.3). `Esc` close-topmost formalized. Retire the legacy "hide row on truly fresh WO" predicate here — the typed ghosts always render and *are* the row's purpose on fresh WOs.
5. **Backend asks #2–#6 land.** Block subsequent steps. (#6 is a contract confirmation, likely no work.)
6. **Invoices tab read + status edits** — wire ask #2, dense table, inline read-only line-item expansion, status pill edits, `⋯` actions.
7. **Minimal invoice create dialog (§4.2)** — `+ New Invoice` button in Invoices tab header, Save as Draft / Save & Send. The `[+ Invoice]` ghost chip (step 4) lands on this dialog.
8. **Payments tab + Record Payment dialog + Void flow** — wire asks #3, #4.
9. **Bal rose-on-OVERDUE** — once ask #2's invoice list is wired, the chip row can detect any OVERDUE invoice and apply rose color per §5.2. Small follow-up.

**7b (after inventory work begins or in parallel if backend bandwidth):**

10. **Backend asks #7–#10 land.**
11. **Quotes tab read + status edits + minimal create dialog (§4.3)** — same shape as Invoices in 7a, including the `+ New Quote` button. `$ quoted` chip joins header row. `[+ Quote]` ghost joins the typed-ghost cluster.

**7c (separate design pass):**

12. Purchase Orders — defer. `[+ PO]` ghost would join the typed-ghost cluster.

**Post-inventory (§8):**

13. Fresh design pass on invoice/quote dialog enhancement. Pick up the parked ideas in §8.

---

## 10. Out of scope for Phase 7

- PO functionality (→ 7c, own design pass)
- Invoice/quote line-item editing of any kind (the minimal dialogs don't have a line-items UI; line-item editing post-DRAFT is void+recreate either way)
- Invoice/quote line-item *creation* — the line item is auto-generated from the lump-sum amount; CSRs don't see or edit a line-items table until §8.1
- Tax handling in the create dialogs (lump-sum stores `taxAmount = 0`; tax UI enters with §8.1)
- Linked-entity chips on work-item rows (parked for §8.5)
- Tenant-config defaults
- Multi-jurisdiction or line-level tax
- Recurring / scheduled invoicing
- Customer-facing invoice render or payment portal
- Refund flow

---

## 11. Risks to watch

- **~~Rollup staleness.~~** Originally listed as the top risk under a denormalize-onto-WorkOrder design for ask #1. Resolved by moving ask #1 to financial-service with live aggregation (no cache, no cross-service writes). Single source of truth — the same `SUM` powers the chip and the drawer-table totals can't drift from it because they aren't separate stores. Kept here as a marker of why the design changed; future contributors evaluating "should we cache this?" should re-read this entry.
- **Bridging until ask #2 lands.** If the frontend wants to ship before the WO-scoped list endpoints exist, client-side filtering on `getByCustomer` is an acceptable bridge — but only as a bridge, removed once ask #2 lands. Don't ossify the filter pattern.
- **Visual affordance for editable-NTE vs read-only money chips.** NTE is the only "edit at chip" pattern; all other chips open the drawer. Ghost-chip-when-unset already differentiates; verify CSRs don't try to click-to-edit `$ invoiced` during the §5e stand-back review.
- **Lump-sum muscle memory.** Once CSRs are creating invoices/quotes via the minimal dialog, the inventory-aware version in §8.1 needs to feel like an *upgrade*, not a regression. Mitigation: keep the lump-sum amount field as a primary path in the post-inventory dialog (line items collapsed by default). If a CSR's WO doesn't have parts to itemize, the flow should still be a single-field entry.
- **Backend ask #6 surprise.** If the existing `POST /financial/invoices` enforces a stricter line-item shape (e.g. requires `partId`), the minimal dialog needs the contract relaxed before it can ship. Verify in the design-handoff conversation with backend, not partway through frontend work.
- **Dialog stacking depth.** Drawer → create dialog is fine (§3.5 carved out). Don't open sub-dialogs from edit dialogs — that's a smell.

---

## 12. References

- [WORK_ORDER_DETAIL_DESIGN.md](./WORK_ORDER_DETAIL_DESIGN.md) — parent design, especially §3.1 (header chips), §3.5 (drawer pattern), §5 phase 7, §5c (NTE follow-up), §2.3 / §2.6 (financial data model).
- `../dispatch-api/docs/planning/INVENTORY_ARCHITECTURE.md` — the inventory design that gates the §8 post-inventory rework.
- `src/api/financialApi.ts` — current Invoice / Quote / Payment client (gaps documented in §6).
- `src/components/EquipmentQuickViewDrawer.tsx` — reference implementation for `SlideOver` + drawer-stack + over-drawer dialog patterns.
- `src/components/ActivityDrawer.tsx` — reference for the activity-drawer-over-page pattern that 7a's financial drawer mirrors.
