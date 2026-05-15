# Phase 7 — Customer-facing invoice/quote send (share link)

Status: Design locked (2026-05-15)
Owner: Paul Wilcox
Parent: [PHASE_7_FINANCIAL_DRAWER.md](./PHASE_7_FINANCIAL_DRAWER.md) §3.3 (deferred `Send` row action), §7 (open question on PDF/print)

This is the handoff for the customer-facing invoice/quote send slice that closes the loop on the deferred `Save & Send` / `⋯ Send` actions in the financial drawer. Today those flips status to `SENT` but don't deliver anything to the customer; this slice makes them mean what they say.

The work spans three services + frontend. Backend and frontend can ship in parallel — the frontend deliverables (public page UI, email body template, in-app affordances) are explicitly scoped here so backend isn't blocked waiting on design specs.

---

## 1. The shape, in one breath

CSR clicks `⋯ Send` (or `Save & Send` from create). Financial-service issues a per-invoice / per-quote share-link token, publishes a `NotificationRequestedEvent` with the share link URL in `templateData`, and stamps `lastSentAt` / `lastSentToEmail` on the row. Notification-service consumes the event, resolves recipients via the existing pipeline, renders an HTML email containing the link, sends via SES. The customer clicks the link, hits a public route on dispatch-ui (`/p/invoice/:token`), which calls a tokenized public endpoint on financial-service to fetch the invoice and render it read-only with tenant branding. Always-current data — no PDF attachment.

PDF download lives on the public page as a v2 enhancement, server-rendered on demand. Not v1.

---

## 2. Why link, not PDF attachment

| | Link | PDF attachment |
|---|---|---|
| Data freshness | Always current (payment posted today → next view shows paid) | Stale the moment it's sent |
| Email deliverability | Plain HTML + link sails through spam filters | Attachments inflate size, trigger heuristics |
| Future "Pay now" | Natural extension — same URL, new button | Impossible |
| Mobile rendering | Responsive HTML | PDF on phones is friction |
| SES complexity | Existing `sendEmail` works as-is | Needs `sendRawEmail` + MIME + attachment plumbing |
| Customer wants archive | "Download PDF" button on the hosted view (v2, on-demand render) | Already attached |

PDF on-demand from the hosted view in v2 covers the 5% who actually save the file (bookkeepers, AP systems). Don't render on every send for the 95% who don't.

---

## 3. Decisions locked

These were debated; not options.

| Decision | Value | Why |
|---|---|---|
| Token TTL | **1 year hard default** | Long enough for annual recordkeeping; short enough that stale tokens age out. `expires_at` column exists for future per-tenant config UI; no config UI in v1. |
| Revoke-on-void | **Default OFF, opt-in via void dialog checkbox** | Voided record still has context value (customer wants to see what was voided). Per-void checkbox lets CSR explicitly cut access on wrong-customer / wrong-address voids. |
| Voided-invoice UX | **Loud full-width red banner**, not 404 | Banner: "This invoice has been voided" at the top of the hosted view, large type, full width. Reason text deferred to v2 alongside void-with-reason schema change. |
| Reissue vs. Extend | **Two distinct affordances** | Reissue = revoke + new token (old emails dead). Extend = bump `expires_at` (old emails stay alive). Both on the invoice page in the app. |
| Self-service request-new-link | **Cut from v1** | Cliff page renders "Contact [tenant support email]" — CSR reissue covers the case. Add self-serve in v2 when expired-link volume justifies it. |
| Token storage | **Single persistent token per invoice/quote** | Customer's mental model is "the link to my invoice." Send analytics live in `notification_logs`. |
| Single vs. fresh per send | **Single (reuses existing token)** | First send issues; subsequent sends reuse. Reissue is explicit. |

---

## 4. Backend ask — financial-service

### 4.1 New tables

**`invoice_share_links`**

```sql
id                 UUID PK
tenant_id          UUID NOT NULL                    -- bootstrap TenantContext from this
invoice_id         UUID NOT NULL FK invoices.id
token              TEXT NOT NULL UNIQUE             -- base64url, ≥32 chars, opaque
created_at         TIMESTAMP NOT NULL DEFAULT now()
expires_at         TIMESTAMP NOT NULL               -- default created_at + 1 year
revoked_at         TIMESTAMP NULL                   -- non-null = inert
last_viewed_at     TIMESTAMP NULL
view_count         INTEGER NOT NULL DEFAULT 0       -- bot prefetches inflate this; treat as "request count," not "human views"

INDEX (token)                                       -- public lookup hot path
INDEX (invoice_id)                                  -- "reissue / extend on this invoice" lookups
```

**`quote_share_links`** — identical shape with `quote_id` instead of `invoice_id`.

RLS: standard tenant scoping via `tenant_id`. Public endpoint bootstraps context from `tenant_id` after the token lookup (see §4.4).

### 4.2 Denormalized fields on Invoice / Quote responses

Add to existing `InvoiceResponse` and `QuoteResponse` DTOs:

```
lastSentAt: Instant?        // last successful send, null if never sent
lastSentToEmail: String?    // captured at send time; renames don't rewrite history
```

Denormalized columns on the parent table updated transactionally with each successful send. Cheap to read on every invoice row; saves joining `notification_logs` for the common "show last-sent on the list" case.

### 4.3 Send endpoints

```
POST /api/v1/financial/invoices/{id}/send
POST /api/v1/financial/quotes/{id}/send
```

**Request body:** none (v1). Future `{ "toEmailOverride": "..." }` is easy to add.

**Behavior:**
1. Look up invoice/quote, enforce tenant scoping via existing RLS.
2. Refuse with 400 if status is `VOID` or `CANCELLED` (or `DECLINED` / `EXPIRED` for quotes).
3. Refuse with 422 if bill-to customer has no email on file. Body: `{ "error": "BILL_TO_NO_EMAIL", "message": "..." }` so FE can surface "Add an email to the bill-to customer first."
4. If no active (non-revoked, non-expired) share-link exists for this invoice/quote → create one. Otherwise reuse the existing one.
5. Publish `NotificationRequestedEvent`:
   - `notificationTypeKey = "invoice_created"` or `"quote_sent"` — both seeded already in `008-seed-notification-types.yaml`. NOTE: `invoice_created` is the existing slot tenants see in their template editor as "Invoice Created"; it's currently unpublished plumbing. Repurpose it for this send event in v1 rather than introducing an `invoice_sent` sibling that'd confuse tenants. If backend prefers the semantic clarity of `invoice_sent`, rename the existing row at the schema level — zero migration cost since nothing publishes it today.
   - `customerId` from the invoice/quote's `customerId`
   - `entityType`, `entityId` for audit
   - `templateData` — see §4.5 for the full variable list and the `{{share_url}}` addition
6. Stamp `lastSentAt = now()`, `lastSentToEmail = <resolved email>` on the invoice/quote row (transactional with event publish).
7. For invoices in `DRAFT` status: auto-flip to `SENT` in the same transaction. (Lets the FE's `Save & Send` route through this endpoint instead of doing a separate `updateStatus(SENT)` call.)
8. Respond:

```
202 Accepted
{
  "notificationId": "...",                   // matches notification_logs entry
  "queuedAt": "2026-05-15T...",              // Instant
  "shareUrl": "https://app.../p/invoice/...",// for FE display / copy-link affordance
  "lastSentToEmail": "..."                   // echo back what was resolved
}
```

### 4.4 Public render endpoints

```
GET /api/v1/public/invoices/{token}
GET /api/v1/public/quotes/{token}
```

**Auth:** none. The token IS the auth. No JWT, no tenant header.

**Behavior:**
1. Look up token in `invoice_share_links` / `quote_share_links` (the only DB read that runs **without** TenantContext set).
2. If row not found OR `revoked_at IS NOT NULL` OR `expires_at < now()` → 404. (All three indistinguishable to caller. Don't leak existence.)
3. `TenantContext.setTenantId(row.tenant_id)` — same pattern as event consumers (per CLAUDE.md).
4. Fetch invoice/quote (RLS-filtered) plus tenant branding (logo URL, display name, support email/phone) plus customer name.
5. Increment `view_count`, set `last_viewed_at = now()`.
6. `TenantContext.clear()` in finally.
7. Respond 200 with the full payload the public page needs:

```json
{
  "invoice": { ...InvoiceResponse, with line items, payments, status... },
  "tenant": {
    "displayName": "Acme HVAC",
    "logoUrl": "https://...",
    "supportEmail": "support@acmehvac.com",
    "supportPhone": "+1..."
  },
  "customer": { "id": "...", "name": "..." }
}
```

Quote variant: same shape, `quote` instead of `invoice`.

**Rate limiting:**
- **30 req/min per IP** on each public route (broad scraping defense)
- **10 lookups/min per token** (per-token brute-force / sharing-pattern detection)
- Per-IP and per-token bucketed independently — both, not OR'd
- 429 with `Retry-After` header on either trip

### 4.5 Template variables — extend, don't replace

`invoice_created` and `quote_sent` notification types already exist in `notification_types` (seeded in `008-seed-notification-types.yaml`) and already have tenant-editable System Default email templates rendered by the existing template editor UI (`Settings → Notification Templates`). The current `Invoice Created` System Default body uses `{{customer_name}}`, `{{invoice_number}}`, `{{amount}}`, `{{due_date}}`, `{{company_name}}`.

What this slice adds:

1. **New `{{share_url}}` variable** in `templateData` when financial-service publishes the event. Resolved from the share-link row created in step 4 of §4.3:

```
share_url = "https://app.dispatch.example/p/invoice/{token}"
```

(Domain comes from the existing `FRONTEND_URL` env var injected by infra — see §11.5. Financial-service treats it as a bare base URL, no path suffix, and composes `${FRONTEND_URL}/p/invoice/${token}`.)

2. **Update the System Default body** for both `invoice_created` and `quote_sent` to render a CTA button using `{{share_url}}`. Suggested addition to the existing plain-text body:

```
View your invoice: {{share_url}}
```

…and an equivalent `<a class="cta-button" href="{{share_url}}">View Invoice</a>` in the HTML body.

3. **Expose `share_url` in the template editor's "Available Variables"** panel for these two types so tenants who customize their template know the variable exists.

**Graceful degradation:** existing tenant overrides that don't reference `{{share_url}}` will continue to render fine — they just won't include the link. The email is still informative; the customer can call the tenant if they want to view the invoice. Tenants pull `{{share_url}}` into their override when they want it; no migration needed.

**Naming consideration on `invoice_created`:** the existing type_key + display name implies an auto-on-create trigger that doesn't exist today. The send endpoint is the only thing publishing it. If backend wants semantic clarity, rename to `invoice_sent` in the same migration that adds the new variable — zero risk since nothing publishes the old name. If renamed, update the tenant-facing display name in the template editor too.

### 4.6 Reissue / Extend endpoints (CSR-facing)

```
POST /api/v1/financial/invoices/{id}/share-link/reissue
POST /api/v1/financial/quotes/{id}/share-link/reissue
```

Revokes the current active token (`revoked_at = now()`) and creates a new one. Old emails go dead. Returns the new `shareUrl`.

```
POST /api/v1/financial/invoices/{id}/share-link/extend
POST /api/v1/financial/quotes/{id}/share-link/extend
```

Bumps `expires_at` on the existing active row by another year (or `+ INTERVAL '1 year'` from `now()`, not from current `expires_at` — prevents 5-year-out tokens from a single extend click). Old emails keep working.

Both require standard JWT auth + tenant scoping. CSR-only.

---

## 5. Backend ask — notification-service

### 5.1 Rendering, no changes needed

Notification-service consumes `NotificationRequestedEvent`, resolves recipients via the existing `RecipientResolverService`, renders the template via `TemplateRenderService` (Mustache), and sends via the existing `EmailService` (SES `sendEmail` — HTML + plain text, no attachments). **All of this pipeline works as-is.** No changes to `EmailService`, no MIME, no attachment plumbing.

The only thing notification-service needs to do for this slice:
1. Confirm `templateData.share_url` (from financial-service's published event per §4.3) flows through the Mustache renderer into the rendered subject/body the same way other variables do today.

Template **content** changes happen in the financial-service migration that updates the System Default bodies — see §4.5. Tenant-customized template bodies live in the existing `notification_templates` table and are edited through the existing template editor UI (`Settings → Notification Templates`); no work here for v1.

### 5.2 Log scrubbing

When the notification job logs the dispatch action, the rendered URL contains the token. Same scrubbing rule as the access-log middleware: replace the `/p/invoice/{token}` and `/p/quote/{token}` path segments with `/p/invoice/:token` and `/p/quote/:token` placeholders before logging. Applies to:
- Notification-service application logs (rendered URL or full message body)
- Email-send job retry logs
- Error reports / Sentry events

---

## 6. Frontend deliverables (parallel, not asks)

Backend doesn't block on these. We ship them on our side and coordinate template seeding.

### 6.1 Public page (`/p/invoice/:token`, `/p/quote/:token`)

- Lives outside `AppLayout` (no sidebar, no nav, no app chrome)
- Top bar: tenant logo + display name (from `/api/v1/public/...` response)
- Invoice body: invoice number, dates, status badge, line items table, payments list (if any), totals (subtotal, tax, total, paid, balance)
- Voided banner (full-width red, large type) when status is `VOID` — top of the page, above the invoice content
- Bottom: tenant support email + phone
- Print CSS (`@media print` rules so customer save-to-PDF works cleanly)
- Mobile-responsive
- "Download PDF" button: **placeholder slot in v1**, hidden. Wired in v2.
- "Pay now" button: **placeholder slot in v1**, hidden. Wired when payment integration ships.

### 6.2 Cliff page (expired/revoked/not-found)

- Same outer layout (tenant logo, branding)
- Headline: "This link has expired"
- Body: "Please contact [tenant support email] to request a new link."
- No request-new-link button in v1 — that's v2.

### 6.3 Email body template — NOT a frontend deliverable

Tenant-editable email templates already exist in the system (`Settings → Notification Templates` UI, `notification_templates` table). Frontend does **not** ship template HTML. The System Default body changes are part of the financial-service migration (see §4.5).

If during this work we discover the existing template editor needs improvements to support `{{share_url}}` (e.g., the "Available Variables" panel doesn't list it, or there's no preview rendering for the new variable), those land as small follow-up branches on this repo — but the email body content itself is tenant configuration, not a frontend deliverable.

### 6.4 In-app affordances

On the invoice / quote row in the financial drawer:
- `⋯ Send` row action (or "Resend" label when `lastSentAt != null`) → POST `/send`
- `⋯ Reissue link` → POST `/share-link/reissue` with confirmation ("Old emails will stop working")
- `⋯ Extend expiry` → POST `/share-link/extend`
- `lastSentAt` display: "Last sent May 15" in row metadata when present
- Void confirmation dialog gains a checkbox: **"Revoke the share link so the original recipient can no longer view this invoice."** Below the checkbox, smaller text: "The customer who received this invoice will see a 404 if they revisit the link." Default OFF.

The `Save & Send` button in the existing create dialog gets simplified to a single call to `/send` (no chained `updateStatus(SENT)`), since the endpoint handles the DRAFT → SENT flip server-side.

---

## 7. Infrastructure ask — dispatch-infra (CloudFront)

The public route sits behind CloudFront. Tokens in URL paths must not land in CloudFront logs.

### 7.1 New cache behavior for `/p/*`

Create a separate CloudFront cache behavior for path pattern `/p/*`. It routes to the S3 frontend origin (same target as the default behavior — `/p/invoice/:token` is an SPA route, served as `/index.html` via the existing 403→`/index.html` custom-error-response mapping; the token sits in the URL bar and is consumed client-side, it never reaches any origin via the URL path). The separate behavior exists to attach the response-headers policy in §7.3 and to keep the route surface explicit so future changes (caching, headers, edge functions) can be scoped to public-render traffic without touching the authenticated app.

**Logging stance — distribution-wide, not per-behavior:**

CloudFront standard access logs are configured at the **distribution** level — one S3 bucket, all behaviors, all-or-nothing. There is no behavior-level `LoggingEnabled` toggle to flip off for `/p/*`. The rule is therefore distribution-wide: **do not enable `logging_config` on this distribution while `/p/*` is live.** Tokens in `cs-uri-stem` would otherwise land in S3 access logs. Current state: standard logging is not enabled — staying off satisfies acceptance criterion #13. A Terraform-side comment on the distribution block guards against future re-enablement without thinking.

**Real-time logs (Kinesis)** *are* per-behavior, configurable via `realtime_log_config_arn` on each `ordered_cache_behavior`. Not enabled today; if introduced later for the rest of the site, omit it on the `/p/*` behavior.

Origin-side access logs (with `:token` middleware scrubbing per §8) provide all operational visibility. CloudFront logging would be redundant + a token-leak surface.

### 7.2 If CDN-level visibility is required later (v2)

CloudFront Functions rewrite path at edge before logging:

```
function handler(event) {
  var req = event.request;
  // Match /p/invoice/{token} or /p/quote/{token}; forward token to origin via header, scrub URI for logs
  var m = req.uri.match(/^\/p\/(invoice|quote)\/([^\/]+)$/);
  if (m) {
    req.headers['x-share-token'] = { value: m[2] };
    req.uri = '/p/' + m[1] + '/__REDACTED__';
  }
  return req;
}
```

Origin (financial-service public endpoint) reads `X-Share-Token` header instead of the URI path segment when present. Don't build this for v1.

### 7.3 Security headers on the public route

Implemented as an `aws_cloudfront_response_headers_policy` attached to the `/p/*` behavior only — **not** distribution-wide. Scoping it avoids forcing `X-Frame-Options: DENY` and `Referrer-Policy: no-referrer` on the authenticated app, which may need embed-friendly or referrer-aware behavior later (e.g. OAuth redirect flows, marketing-page integrations). The auth app inherits whatever the distribution-level defaults are.

```
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
X-Frame-Options: DENY                   # no embedding the public page in iframes
Content-Security-Policy: default-src 'self'; ...   # full policy TBD with FE — defer to v2
```

`no-referrer` is critical — prevents the token-bearing URL from leaking via `Referer` headers when the page contains any outbound links (PDF download button in v2, "Pay now" button when payments ship).

---

## 8. Security checklist — token must not leak

| # | Surface | Mechanism |
|---|---|---|
| 1 | Server access logs (financial-service) | Middleware replaces `/p/invoice/{token}` and `/p/quote/{token}` with `:token` placeholder before logging |
| 2 | HTTP response headers | `Referrer-Policy: no-referrer` set on every public-route response (or at CDN per §7.3) |
| 3 | Outbound links on public page | `rel="noopener noreferrer"` on every `<a>` tag |
| 4 | Sentry / error reporter | Path-pattern scrubbing rule for `/p/(invoice|quote)/:token` URLs |
| 5 | CloudFront access logs | Disabled on `/p/*` behavior (per §7.1); if re-enabled later, CloudFront Function rewrites URI before logging (per §7.2) |
| 6 | Email-send job logs (notification-service) | Same `:token` scrubbing on rendered URLs in dispatch logs (per §5.2) |

---

## 9. Acceptance criteria

1. CSR clicks `⋯ Send` on a `SENT` or `DRAFT` invoice → backend returns 202 within 300ms.
2. Within seconds, the bill-to customer's email receives an HTML email with a `View Invoice` button linking to `/p/invoice/{token}` on dispatch-ui.
3. Clicking the button renders the read-only invoice with tenant branding, current amounts (reflecting any payments posted since send), and customer name.
4. `lastSentAt` and `lastSentToEmail` update on the invoice and are visible on the next GET.
5. `notification_logs` records the send (channel=EMAIL, status=SENT, externalMessageId from SES).
6. Visiting an expired token URL renders the cliff page with tenant support email, not a generic 404.
7. Visiting a revoked token URL renders the same cliff page.
8. Voiding an invoice with the "Revoke share link" checkbox enabled marks `revoked_at` on the link row; subsequent visits hit the cliff page. Without the checkbox, visits still resolve but show the loud voided banner.
9. Sending an invoice whose bill-to has no email returns 422 with `BILL_TO_NO_EMAIL`; FE displays "Add an email to the bill-to customer first."
10. Sending a `VOID` or `CANCELLED` invoice returns 400.
11. Hitting the public route 31 times in a minute from one IP returns 429.
12. Hitting the public route 11 times in a minute for the same token returns 429.
13. CloudFront access logs (sampled) do not contain any token segments under `/p/`.

---

## 10. Out of scope (v1)

- Automatic self-service "Request new link" from the cliff page (v2 once expired-link volume justifies)
- PDF generation / "Download PDF" button on the hosted view (v2, on-demand render)
- "Pay now" button on the hosted view (waits for payment integration)
- Tenant-config UI for token TTL (DB column exists; config surface is future work)
- Void reason text in the voided banner (waits for void-with-reason schema + UI)
- Re-send rate limiting beyond per-IP / per-token network limits (one human action = one send; no idempotency guard required)
- Bounce / complaint handling beyond SES's existing configuration set behavior
- Multi-recipient (cc/bcc) — defer until a real ask
- Customer-facing invoice editing or commenting

---

## 11. Open questions to resolve during build

1. **`expires_at` initial value:** confirmed +1 year from `created_at`. Backend can adjust the column default once.
2. **Reissue email behavior:** does Reissue automatically re-send the email to `lastSentToEmail` with the new link, or does it just generate a new token that CSR has to manually send? My lean: **just generates the token; CSR clicks Send separately.** Clean separation between "rotate access" and "deliver to customer."
3. **What email gets used when a customer is BILLING_ONLY with no service location?** Should be `customer.email` directly — these customers exist specifically as billing entities, the email is the primary contact channel. Confirm `customerApi` returns a usable email for `BILLING_ONLY` records.
4. **`view_count` semantics — what counts as a view?** Includes bot prefetches from corporate scanners. Document this as "request count, not human view count" in the response field's description so callers don't trust it as engagement signal.
5. **`FRONTEND_URL` config source:** ~~open~~ **resolved.** Financial-service receives `FRONTEND_URL` as an ECS env var injected by infra (`modules/ecs/main.tf` financial-service task definition, value from `var.frontend_url` already wired in `environments/dev/main.tf` = `https://dev.dispatch.newleveltech.net`). Same env var name and value scheduling-service already consumes — no fork in convention. Financial-service composes `${FRONTEND_URL}/p/invoice/${token}` at event-publish time; notification-service stays generic and just renders whatever `{{share_url}}` it gets handed.
6. **`invoice_created` rename to `invoice_sent`:** backend's call. Nothing publishes the old name today so renaming is zero-risk; the tenant-facing display name in the template editor needs updating in lockstep if so.

---

## 12. References

- [PHASE_7_FINANCIAL_DRAWER.md](./PHASE_7_FINANCIAL_DRAWER.md) — the parent design; this slice closes §3.3's deferred `Send` action and answers §7's PDF-render question with "link instead, PDF on-demand in v2"
- `dispatch-api/notification-service/` — existing notification pipeline being reused
- `dispatch-api/shared-events/.../NotificationEvent.kt` — event class published by financial-service
- `dispatch-api/notification-service/.../EmailService.kt` — existing SES wrapper, no changes needed
