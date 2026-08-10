# FreelancerHisab — Full Project Audit

**Audit date:** 2026-08-10
**Scope:** `apps/api` (NestJS + Drizzle + Postgres), `apps/web` (Next.js 15 App Router), `packages/*`
**Method:** static review of 100% of `src` in both apps + live black-box testing against the running stack (web `:3000`, api `:3001`, postgres `:5432`) using freshly registered users and realistic data. Every finding marked **VERIFIED** was reproduced against the live API or database in this session.

**This is an audit only. No application code, schema, migration, config, or dependency was modified.**

---

## Executive Summary

The project is architecturally sound and superficially complete: it builds, type-checks, lints clean, all 86 backend unit tests pass, and all 16 routes return HTTP 200. The UI is consistent and the shared table primitives (`useDataTable`, `PaginationBar`, `BulkActionsBar`, `SortableTableHead`) are genuinely well factored.

Underneath that, the audit found **73 issues, 11 of them critical**. The critical set clusters into four themes:

1. **Multi-tenant isolation is broken in the invoice path.** One user can permanently destroy another user's invoices — verified twice, by two different mechanisms. `DELETE /invoices/:id` deletes line items *before* checking ownership, and `POST /invoices` accepts any `clientId` without verifying it belongs to the caller, so a FK cascade lets User A's routine "delete my client" wipe User B's invoice. In the verified run the confirmation dialog told User A that **0 invoices** would be deleted, immediately before it deleted one belonging to someone else.

2. **The money shown to the user is not reliably the money in the database.** Marking an invoice paid creates no income record, so paid revenue disappears from the dashboard, reports and tax estimate entirely. Invoice PKR conversion uses a hardcoded `280` fallback instead of the live FX service the rest of the app uses — a EUR invoice was stored 14% under its real PKR value. Negative tax rates and negative discounts are accepted and persisted.

3. **The default tax year is stale and the app disagrees with itself about what "total income" means.** `DEFAULT_TAX_YEAR = 2026` is hardcoded, but as of today the current Pakistani tax year is **2027**. Income entered today is invisible to the tax estimate, wealth reconciliation and filing readiness at their default settings. Separately, the dashboard sums income over all time with no period filter. In a verified three-record test the same data produced **three different totals** — Rs 883,880 (dashboard), Rs 555,920 (tax estimate default), Rs 327,960 (tax estimate for the actual current year) — with the readiness score, income-consolidation card, and reports each scoped to a *different* period on the *same page*.

4. **`npm run db:seed` is unscoped and destructive.** It selects every user in the database, deletes their clients/invoices/income/expenses, runs `db.delete(invoiceItems)` with **no WHERE clause at all**, and overwrites every user's bank details and PSEB ID with demo values.

The reported toast problem is confirmed and fully diagnosed: **there is no toast system**. `Toast` is a bare presentational component with no provider, no hook, and no global mount point. Every page re-implements it with local `useState`, so a toast exists only where a developer happened to wire one — 21 mutation paths have no notification at all, and the Wealth page's six write operations only `console.error`.

Build, type-check, lint and tests are all green, but that green is partly illusory: `apps/web/eslint.config.mjs` contains **zero rules**, so frontend linting checks nothing.

### Status at a glance

| Area | Status |
|---|---|
| Build / type-check / tests | ✅ Pass (86/86 tests, 0 TS errors) |
| Lint | ⚠️ "Passes" — but web lint config has no rules |
| Routing / navigation | ✅ Pass |
| Authentication & session | ⚠️ Solid rotation & reuse detection; logout does not revoke |
| Multi-tenant isolation | ❌ **Broken** (invoices) |
| Financial calculations | ❌ **Multiple correctness defects** |
| Dashboard / reports consistency | ❌ **Three conflicting definitions of income** |
| Toast / notifications | ❌ **No system exists; ~21 paths silent** |
| Tables | ⚠️ Consistent primitives, inconsistent behaviour |
| Responsive | ✅ Largely fine |
| Dead code | ⚠️ 6 dead endpoints, 4 dead hooks, 2 dead packages, 5 unused deps |

### Issue counts

| Severity | Count |
|---|---|
| Critical | 11 |
| High | 20 |
| Medium | 24 |
| Low | 18 |
| **Total** | **73** |

---

## Critical Issues

---

### C-01 — A user can delete another user's invoice line items

- **Severity:** Critical — cross-tenant data destruction
- **Page/feature:** Invoices → delete
- **Location:** [apps/api/src/modules/invoices/invoices.service.ts:323-335](apps/api/src/modules/invoices/invoices.service.ts#L323-L335)
- **Status:** ✅ **VERIFIED live**

**Problem.** `delete()` removes the invoice's line items *before* it verifies the invoice belongs to the caller:

```ts
async delete(userId: string, id: string) {
  await this.db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));  // ← no ownership check
  const result = await this.db.delete(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))            // ← check happens here
    .returning();
  if (!result.length) throw new NotFoundException('Invoice not found');
```

The line-item delete is scoped only by `invoiceId`. Any authenticated user who knows or guesses an invoice UUID can strip its items. The subsequent 404 makes the attack look like it failed.

**Steps to reproduce.**
1. User A creates an invoice with 1 line item (`$500 × 2 = $1000`).
2. User B (any other account) calls `DELETE /api/v1/invoices/{A's invoice id}`.
3. B receives `404 Invoice not found`.
4. A re-opens their own invoice.

**Expected.** B's request changes nothing.

**Actual (verified).** A's invoice went from `1 items; total 1000.00` to `0 items; total 1000.00`. The invoice is now permanently inconsistent — a stated total of $1000 with no line items to justify it. On a tax-audited document this is unrecoverable without a backup.

**Root cause.** Ownership is enforced on the parent row only, and the child delete runs first, unguarded.

**Affected functionality.** Invoice integrity, invoice detail/print view, PDF filing package (income report line detail), FBR audit trail.

**Recommended fix.** Load and ownership-check the invoice first (reuse `findOne(userId, id)`), then delete items and invoice inside a single transaction.

---

### C-02 — Deleting your own client destroys another user's invoices (and the dialog says "0 invoices")

- **Severity:** Critical — cross-tenant data destruction with misleading confirmation
- **Page/feature:** Clients → delete; Invoices → create
- **Location:** [apps/api/src/modules/invoices/invoices.service.ts:67-92](apps/api/src/modules/invoices/invoices.service.ts#L67-L92) (root cause), [apps/api/src/database/schema/invoices.ts](apps/api/src/database/schema/invoices.ts) `clientId … onDelete: 'cascade'`, [apps/api/src/modules/clients/clients.service.ts:108-142](apps/api/src/modules/clients/clients.service.ts#L108-L142)
- **Status:** ✅ **VERIFIED live**

**Problem.** `InvoicesService.create()` accepts `dto.clientId` and only checks that it is a 36-character string. It never verifies the client belongs to the requesting user:

```ts
let targetClientId = dto.clientId;
if (!targetClientId || typeof targetClientId !== 'string' || targetClientId.length !== 36) {
  /* …create-or-find by name… */
}
// otherwise dto.clientId is used verbatim
```

The FK only requires the client to *exist*. Because `invoices.clientId` cascades on delete, the owner of that client can now destroy invoices they cannot see.

**Steps to reproduce.**
1. User A creates a client; note its id.
2. User B posts `POST /api/v1/invoices` with `clientId` = A's client id and a $5,000 line item. **Succeeds — 201.**
3. B lists invoices: 1 invoice.
4. A deletes their own client normally (`DELETE /clients/{id}` → 409 warning → confirm → `?force=true`).
5. B lists invoices again.

**Expected.** Step 2 is rejected with 404/403. A's delete affects only A's data.

**Actual (verified).**
- Step 2 succeeded.
- Step 4's 409 pre-flight reported `invoiceCount: 0` and the response reported `deletedInvoiceCount: 0` — because both count queries are scoped `and(clientId, userId=A)`, so B's invoice is invisible to the check.
- Step 5: B's invoice count went `1 → 0`. `GET /invoices/{id}` → `Invoice not found`.

A performed a routine, correctly-confirmed action and silently destroyed another tenant's financial record. Neither user gets any indication.

**Root cause.** Missing ownership validation on `clientId` at invoice creation, combined with a cascading FK and ownership-scoped impact counting.

**Affected functionality.** Invoices, client deletion, income linkage, every downstream financial total.

**Recommended fix.** Validate `clientId` belongs to `userId` in `InvoicesService.create()` and `update()` (and the same for `IncomeService` — see C-11). Additionally make the delete-impact count unscoped, or forbid deleting a client that has any referencing rows.

---

### C-03 — The "paid invoices are legally locked" rule is bypassable

- **Severity:** Critical — compliance / audit-trail integrity
- **Page/feature:** Invoices → status change / edit
- **Location:** [apps/api/src/modules/invoices/invoices.service.ts:305-321](apps/api/src/modules/invoices/invoices.service.ts#L305-L321) (`updateStatus`), vs [:173-225](apps/api/src/modules/invoices/invoices.service.ts#L173-L225) (`update`)
- **Status:** ✅ **VERIFIED live + confirmed in DB**

**Problem.** `update()` enforces careful rules — paid invoices cannot be edited ("legally locked to maintain tax compliance & PRC audit records"), cancelled invoices are archived, issued invoices cannot revert to draft, and `status: 'paid'` cannot be set through it. `updateStatus()` enforces **none** of them. It writes whatever status the DTO contains (the DTO only validates enum membership) and is reachable by any owner.

**Steps to reproduce.**
1. Create invoice (`subtotal 1099.99, taxRate 17, total 1236.99`).
2. `PATCH /invoices/:id/status` `{"status":"paid"}` → paid, `paidAt` set.
3. `PATCH /invoices/:id/status` `{"status":"draft"}`.
4. `PATCH /invoices/:id` `{"taxRate": 0}`.

**Expected.** Step 3 rejected ("Issued invoices cannot be reverted to draft"); step 4 rejected ("Paid invoices are legally locked").

**Actual (verified).** Step 3 succeeded. Step 4 then succeeded, rewriting the financials of a previously-paid invoice. Final DB row:

```
invoice_number | subtotal | total   | status | paid_at                    | items
FH-2026-0001   | 1099.99  | 1049.99 | draft  | 2026-08-10 12:39:53.995    | 2
```

A draft invoice carrying a `paid_at` timestamp, with a total that changed after payment. Every lock the codebase documents is defeated by one extra request.

**Root cause.** Two independent write paths to `invoices.status`; only one carries the state machine. `updateStatus` also never clears `paidAt` when leaving `paid`.

**Affected functionality.** Invoice immutability, FBR/PRC audit trail, filing readiness `ORPHANED_PAID_INVOICE` check, revenue reporting.

**Recommended fix.** Move the transition rules into a single guarded helper used by both endpoints; reject illegal transitions; clear `paidAt` when status leaves `paid`.

---

### C-04 — Marking an invoice paid records no income: the revenue disappears

- **Severity:** Critical — incorrect financial reporting
- **Page/feature:** Invoice detail → "Mark as Paid"; Dashboard; Reports; Tax
- **Location:** [apps/api/src/modules/invoices/invoices.service.ts:305-321](apps/api/src/modules/invoices/invoices.service.ts#L305-L321), [apps/web/src/app/(dashboard)/invoices/[id]/page.tsx:85-87](apps/web/src/app/(dashboard)/invoices/%5Bid%5D/page.tsx#L85-L87)
- **Status:** ✅ **VERIFIED live**

**Problem.** Dashboard income, reports, tax estimate and wealth reconciliation all read exclusively from the `income` table. `updateStatus` writes only to `invoices`. So marking an invoice paid removes it from "pending" without ever adding it to "income" — the money vanishes from every financial surface in the product.

**Steps to reproduce.**
1. Fresh user. Create a client and a $1,000 invoice.
2. Dashboard: `pendingInvoices 1`, `pendingAmount 280,000`.
3. Click **Mark as Paid** (`PATCH /invoices/:id/status {"status":"paid"}`).
4. Re-read `GET /income` and `GET /dashboard/summary`.

**Expected.** Total income increases by the invoice value, or the user is prompted to record the remittance.

**Actual (verified).**
```
income rows after marking invoice paid: 0
totalIncome 0   pendingInvoices 0   pendingAmount 0
```
$1,000 of collected revenue is now invisible everywhere. It is also under-declared in the tax estimate and the generated FBR filing package.

The inverse path is inconsistent in a second way: creating income *with* an `invoiceId` **does** flip the invoice to `paid` ([income.service.ts:76-81](apps/api/src/modules/income/income.service.ts#L76-L81)) — but never sets `paidAt`, and does so regardless of amount (see C-10 note below). Verified: **$10 of income against a $9,999 invoice marked the whole invoice `paid`.**

**Root cause.** Invoice status and the income ledger are two independent sources of truth with a one-way, unvalidated link.

**Affected functionality.** Dashboard KPIs, Reports, Tax estimate, Wealth reconciliation, Filing readiness, generated PDF package.

**Recommended fix.** Make "Mark as Paid" open the income-recording flow (pre-filled with invoice total, currency, client, rate), or create the linked income row transactionally. Require full payment (or support partial payments explicitly) before setting `paid`. Set `paidAt` on both paths.

---

### C-05 — Invoices convert to PKR at a hardcoded 280 instead of the live rate

- **Severity:** Critical — incorrect financial calculation
- **Page/feature:** Invoices → create/edit; Clients KPIs; all PKR totals
- **Location:** [apps/api/src/modules/invoices/invoices.service.ts:137](apps/api/src/modules/invoices/invoices.service.ts#L137) `const exchangeRate = dto.exchangeRate || 280;`
- **Status:** ✅ **VERIFIED live**

**Problem.** `IncomeService` and `ExpensesService` both inject `ExchangeRateService` and resolve a live rate. `InvoicesService` does not inject it at all and falls back to the literal `280` for **every** currency.

**Steps to reproduce.**
1. `POST /invoices` with `currency: "EUR"`, one item `1 × 100`, and **no** `exchangeRate`.
2. Compare with `GET /exchange-rate`.

**Expected.** EUR converted at the live EUR→PKR rate.

**Actual (verified).**
```
invoice: currency EUR  rate 280.0000  total 100.00  totalPKR 28000.00
live rates: { USD: 277.96, EUR: 320.97, GBP: 374.61 }
```
The EUR invoice is booked at Rs 28,000 instead of Rs 32,097 — **12.8% understated**. GBP is understated by 25%. Even USD is wrong (280 vs 277.96).

This also produces a same-day contradiction: in the same test session a $1,000 *income* row was converted at 277.96 while a $1,000 *invoice* was converted at 280 — two different PKR values for the same dollar on the same day.

**Root cause.** `InvoicesService` never wired to `ExchangeRateService`; a USD-shaped constant used as a universal fallback.

**Affected functionality.** `invoices.totalPKR`, dashboard `pendingAmount`, invoices page "Total Invoiced (PKR)", client lifetime PKR earnings, PDF invoices.

**Recommended fix.** Inject `ExchangeRateService` into `InvoicesService` and resolve per-currency, mirroring `IncomeService.resolveRate()`. Remove the literal.

---

### C-06 — `DEFAULT_TAX_YEAR` is hardcoded to a tax year that ended six weeks ago

- **Severity:** Critical — current-year financial data invisible by default
- **Page/feature:** Tax estimate, Wealth, Filing, Reports, Dashboard readiness
- **Location:** [apps/api/src/common/tax-year.ts:8](apps/api/src/common/tax-year.ts#L8) `export const DEFAULT_TAX_YEAR = 2026;` and [apps/api/src/modules/wealth/wealth.controller.ts](apps/api/src/modules/wealth/wealth.controller.ts) (`year: string = '2026'` × 5)
- **Status:** ✅ **VERIFIED live**

**Problem.** Pakistani tax year N runs 1 Jul (N−1) → 30 Jun (N). Today is **2026-08-10**, so the current tax year is **2027**. The backend default is 2026 — the year that closed on 2026-06-30. The frontend helper `getCurrentTaxYear()` ([apps/web/src/lib/tax-year.ts:5](apps/web/src/lib/tax-year.ts#L5)) correctly returns 2027, but only *some* callers pass it, so frontend and backend disagree.

**Steps to reproduce.** Create income dated today (Aug 2026), then `GET /tax/estimate` with no `year`.

**Expected.** Today's income appears in the default estimate.

**Actual (verified).**
```
default:     taxYear 2026, period 2025-07-01 → 2026-06-30, gross 555,920
year=2027:   taxYear 2027, period 2026-07-01 → 2027-06-30, gross 327,960
```
Rs 327,960 of current-year income — including everything entered today — is absent from the default tax estimate. `/wealth/*` (5 endpoints) hardcode `'2026'` the same way, so assets filed for TY2027 do not reconcile by default.

Callers that pass the year: `/filing` page, `/tax-simulator`, `useIncomeVsExpensesReport`, `useIncomeConsolidation`, Wealth page. Callers that do **not**: dashboard `useReadinessScore()`, `useTaxEstimate` in `use-reports.ts`, every raw `/wealth/*` default.

**Root cause.** A constant where a function of the current date is required; no single source of truth shared between apps.

**Affected functionality.** Tax estimate, wealth reconciliation, filing readiness, dashboard readiness banner, reports tax card, generated filing package.

**Recommended fix.** Replace `DEFAULT_TAX_YEAR` with a `getCurrentTaxYear()` computed from `new Date()` (the frontend already has the correct implementation); remove the `= '2026'` controller defaults; move the helper into `packages/shared` so both apps use one implementation.

---

### C-07 — Dashboard totals are unscoped lifetime sums; the app reports three different "total income"

- **Severity:** Critical — misleading financial reporting
- **Page/feature:** Dashboard, Reports, Tax
- **Location:** [apps/api/src/modules/dashboard/dashboard.service.ts:10-31](apps/api/src/modules/dashboard/dashboard.service.ts#L10-L31)
- **Status:** ✅ **VERIFIED live**

**Problem.** `getSummary()` sums **every** income and expense row the user has ever had, with no date or tax-year filter, while every other financial surface scopes to a tax year. The dashboard also renders period-scoped and unscoped figures side by side.

**Steps to reproduce.** One user, three income rows: $1,000 (Aug 2026), Rs 50,000 (Aug 2026), $2,000 (Jan 2026). Load the dashboard and compare with `/tax/estimate` and `/reports/*`.

**Expected.** One consistent definition of "total income", clearly labelled with its period.

**Actual (verified).**

| Surface | Total income (PKR) | Period actually used |
|---|---|---|
| Dashboard "Total Income" KPI | **883,880** | All time |
| Dashboard "Income Consolidation" card (same page) | 327,960 | TY2027 |
| Dashboard readiness banner (same page) | — | TY2026 |
| `/tax/estimate` (default) | **555,920** | TY2026 |
| `/tax/estimate?year=2027` | **327,960** | TY2027 |
| Reports trend chart | 555,920 | TY2026 tax-year buckets |
| Reports "Total Revenue" KPI | 883,880 | All time |

Three periods on a single page; three totals across the app for identical data.

Two further defects in the same service:
- `pendingInvoices` / `pendingAmount` include **draft** invoices ([:19](apps/api/src/modules/dashboard/dashboard.service.ts#L19) excludes only `paid` and `cancelled`), so unsent drafts are presented as money owed.
- `calculateGrowth()` ([:38-63](apps/api/src/modules/dashboard/dashboard.service.ts#L38-L63)) compares a **partial** current month (`startOfThisMonth → now`) against a **full** previous month. On the 3rd of a month this reports roughly −90% growth regardless of performance.

**Root cause.** No period parameter on the dashboard endpoint; per-page ad-hoc scoping decisions.

**Recommended fix.** Add a `?year=` parameter to `/dashboard/summary` defaulting to the current tax year; label every KPI with its period; exclude drafts from pending; compare month-to-date against the same-length window last month.

---

### C-08 — `npm run db:seed` destroys all users' data, unscoped

- **Severity:** Critical — data loss
- **Page/feature:** Tooling / `apps/api` scripts
- **Location:** [apps/api/src/database/seed.ts:12-52](apps/api/src/database/seed.ts#L12-L52)

**Problem.**

```ts
let targetUsers = await db.select().from(users);   // ← EVERY user, not just the demo user
// ...
for (const user of targetUsers) {
  await db.delete(income).where(eq(income.userId, user.id));
  await db.delete(invoiceItems);                    // ← NO WHERE CLAUSE AT ALL
  await db.delete(invoices).where(eq(invoices.userId, user.id));
  await db.delete(expenses).where(eq(expenses.userId, user.id));
  await db.delete(clients).where(eq(clients.userId, user.id));

  await db.update(users).set({
    bankName: user.bankName || 'Meezan Bank Limited',
    iban:     user.iban     || 'PK36MEZN0001020304050607',
    psebId:   user.psebId   || 'PSEB-2026-98765',
    isFiler: true,
  }).where(eq(users.id, user.id));
}
```

`db.delete(invoiceItems)` with no predicate truncates the entire table for every tenant. The loop then wipes clients, invoices, income and expenses for every account, and stamps demo bank/PSEB details onto any user missing them. It also seeds an **admin** account (`isAdmin: true`) with the password `password123`.

**Steps to reproduce.** With any production-like data present, run `npm run db:seed` in `apps/api`.

**Expected.** Seeds demo data for a demo user only, and refuses to run against a non-empty/non-development database.

**Actual.** Total financial data loss across all tenants, plus overwritten compliance fields.

**Root cause.** A demo script written for an empty database, wired into `package.json` and `turbo.json` with no environment guard.

**Recommended fix.** Scope every delete by `userId`, add the missing `WHERE` on `invoiceItems`, restrict `targetUsers` to the demo email, refuse to run unless `NODE_ENV === 'development'`, and never seed a real password or admin flag.

---

### C-09 — Logout does not revoke the session; the frontend never calls it

- **Severity:** Critical — authentication
- **Page/feature:** Sidebar → Sign out
- **Location:** [apps/api/src/modules/auth/auth.controller.ts:56-60](apps/api/src/modules/auth/auth.controller.ts#L56-L60), [apps/web/src/components/layout/sidebar.tsx:36-39](apps/web/src/components/layout/sidebar.tsx#L36-L39)
- **Status:** ✅ **VERIFIED live**

**Problem.** Two independent defects compound:

1. `POST /auth/logout` only calls `res.clearCookie('refreshToken')`. It never marks the stored token `isRevoked`, so the refresh token remains valid in `refresh_tokens` for its full 7-day life.
2. The frontend's logout handler never calls the endpoint at all — it clears Zustand state and pushes `/login`. The httpOnly cookie is therefore not even cleared in the browser.

```ts
const handleLogout = () => { logout(); router.push('/login'); };  // no API call
```

**Steps to reproduce.**
1. Register, capture the `refreshToken` cookie.
2. `POST /auth/logout`.
3. Replay `POST /auth/refresh` with the pre-logout cookie.

**Expected.** 401.

**Actual (verified).** `STILL VALID - token NOT revoked` — a full new access token was issued after logout.

Because the browser flow never calls logout, the cookie also survives in the browser; anything that re-triggers the refresh interceptor can silently restore the session on a shared machine.

**Root cause.** Revocation logic exists (`changePassword` revokes correctly, and refresh-rotation reuse detection works — both verified) but was not applied to logout, and the endpoint was never wired up in the UI.

**Recommended fix.** Read the cookie in `logout()`, mark that token (or all the user's tokens) revoked, then clear the cookie; call the endpoint from `handleLogout` and await it before redirecting.

---

### C-10 — Negative tax rates and negative discounts are accepted and persisted

- **Severity:** Critical — financial data corruption
- **Page/feature:** Invoices → create/edit
- **Location:** [apps/api/src/modules/invoices/dto/invoice.dto.ts:46-52](apps/api/src/modules/invoices/dto/invoice.dto.ts#L46-L52), [invoices.service.ts:130-135](apps/api/src/modules/invoices/invoices.service.ts#L130-L135)
- **Status:** ✅ **VERIFIED live**

**Problem.** `taxRate` and `discountAmount` are `@IsNumber() @IsOptional()` with **no** `@Min`/`@Max`. (`Max` is imported in the file but never applied.) The service validates item quantity and rate, and rejects a negative *total*, but never bounds the rate or the discount.

**Steps to reproduce / Actual (verified).**

| Payload | Stored result |
|---|---|
| `taxRate: -50`, item `1 × 100` | `taxAmount -50.00`, `total 50.00` — negative tax on an invoice |
| `discountAmount: -500`, item `1 × 100` | `subtotal 100.00`, `discountAmount -500.00`, **`total 600.00`** — a "discount" that increases the total by 500 |
| `taxRate: 100000` | `HTTP 500 {"message":"numeric field overflow"}` — raw Postgres error surfaced |

The negative-discount case is the worst: an invoice showing a discount line while charging 6× the subtotal.

**Expected.** `400` with a clear validation message for all three.

**Root cause.** Missing bounds on money/rate DTO fields; DB constraint violation not translated to a 400.

**Recommended fix.** `@Min(0) @Max(100)` on `taxRate`; `@Min(0)` on `discountAmount`; add a matching guard in `update()`; map Postgres `22003` to `BadRequestException`. Consider DB `CHECK` constraints as the backstop.

---

### C-11 — Income and invoices can be attached to another user's client or invoice

- **Severity:** Critical — tenant isolation / referential integrity
- **Page/feature:** Income → create; Invoices → create
- **Location:** [apps/api/src/modules/income/income.service.ts:60-74](apps/api/src/modules/income/income.service.ts#L60-L74)
- **Status:** ✅ **VERIFIED live**

**Problem.** `IncomeService.create()` inserts `dto.clientId` and `dto.invoiceId` straight through. Neither is checked for ownership; the FK only requires existence. (`EvidenceService` gets this right — see `assertOwnsParent` — so the correct pattern already exists in the codebase.)

**Steps to reproduce.** User B posts income with `clientId` = User A's client id.

**Expected.** 404 "Client not found".

**Actual (verified).** `201` — income row created for B pointing at A's client:
```json
{"userId":"863cb5b0-…(B)","clientId":"bff78ab0-…(A's client)","amount":"10.00"}
```

**Impact.** B's income is silently deleted-by-cascade or orphaned when A deletes their client (this is the mechanism behind C-02); A's client-earnings totals can be polluted by B's rows; the reports client-breakdown can surface names across tenants.

**Recommended fix.** Add an `assertOwns` check for `clientId` and `invoiceId` in `IncomeService.create`/`update` and `InvoicesService.create`/`update`, matching `EvidenceService.assertOwnsParent`.

---

## High Priority

---

### H-01 — Query hooks swallow every API error, so failures render as empty states

- **Severity:** High
- **Location:** [use-clients.ts:17](apps/web/src/hooks/use-clients.ts#L17), [use-dashboard.ts:16,36](apps/web/src/hooks/use-dashboard.ts#L16), [use-income.ts:17](apps/web/src/hooks/use-income.ts#L17), [use-invoices.ts:17](apps/web/src/hooks/use-invoices.ts#L17), [use-reports.ts:17,37,57,78,97](apps/web/src/hooks/use-reports.ts#L17), [use-tax.ts:23,55](apps/web/src/hooks/use-tax.ts#L23), [use-filing.ts:18,38](apps/web/src/hooks/use-filing.ts#L18), [use-profile.ts:18](apps/web/src/hooks/use-profile.ts#L18), [use-transactions.ts:69](apps/web/src/hooks/use-transactions.ts#L69)

**Problem.** 14 of 16 query hooks wrap the request in `try { … } catch (e) { return []; }` (or `return null`). Because the queryFn *resolves*, React Query never enters `isError`. A 500, a network outage or a malformed response is indistinguishable from "you have no data".

**Reproduce.** Stop the API, load `/clients`.
**Expected:** "Couldn't load clients — retry."
**Actual:** "No clients found matching your search." — a confident, wrong statement about the user's data.

Worse on the dashboard: `useIncomeConsolidation` returning `null` renders `"Loading data..."` **forever** ([dashboard/page.tsx:281-282](apps/web/src/app/(dashboard)/dashboard/page.tsx#L281-L282)), and the readiness banner disappears entirely rather than reporting a problem.

`useExpenses` and `useInvoice` deliberately do *not* swallow — so `/expenses` and the invoice detail page are the only two surfaces with real error states. That inconsistency is the tell.

**Fix.** Remove the catch blocks; let React Query surface `isError`; render a shared error state component.

---

### H-02 — The web app's ESLint config contains zero rules

- **Severity:** High — the whole frontend is effectively unlinted
- **Location:** [apps/web/eslint.config.mjs](apps/web/eslint.config.mjs)

```js
const eslintConfig = defineConfig([
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
```

No `extends`, no plugins, no rules. `next lint` reports `✔ No ESLint warnings or errors` because there is nothing to violate. The build also warns: `⚠ The Next.js plugin was not detected in your ESLint configuration.`

Consequences: no `react-hooks/exhaustive-deps` (the codebase has several effects with incomplete deps — e.g. [sidebar.tsx:46](apps/web/src/components/layout/sidebar.tsx#L46), [invoices/new/page.tsx:57](apps/web/src/app/(dashboard)/invoices/new/page.tsx#L57)), no unused-import detection, none of `eslint-config-next`'s correctness rules. Meanwhile `packages/eslint-config` (base/next/react-internal) exists and is imported by **nothing**.

Note also that `apps/api`'s lint script is `eslint … --fix` — a lint task that rewrites source files, which is unsafe in CI, and it disables `no-unused-vars` and `no-explicit-any` wholesale.

**Fix.** Point `apps/web/eslint.config.mjs` at `@freelancerhisab/eslint-config/next`; drop `--fix` from the API lint script.

---

### H-03 — GET requests silently write to the global tax-rules table; rate selection is non-deterministic

- **Severity:** High — shared configuration integrity
- **Location:** [apps/api/src/modules/tax/tax.service.ts:127-151](apps/api/src/modules/tax/tax.service.ts#L127-L151)
- **Status:** ✅ **VERIFIED live**

**Problem.** `getExportTaxRate()` inserts a row into `tax_rules` when none matches — from inside a read-only `GET /tax/estimate`. `tax_rules` is **global**, not per-user, and writes are otherwise `AdminGuard`-protected. Any signed-in user loading the tax page therefore mutates platform-wide configuration.

**Verified:** four rows materialised in `tax_rules` purely from GET traffic during this audit (`2026-27 IT_EXPORT_PSEB/STANDARD`, notes: *"Auto-seeded default rate"*).

Compounding problems:
- No unique constraint on `(tax_year, income_type)`; `createRule` does not de-duplicate. Concurrent first-requests will insert duplicates.
- Lookup uses `.limit(1)` with **no `orderBy`** — with duplicates present, Postgres may return either row, so the tax rate applied becomes non-deterministic between requests.
- `AdminGuard` correctly returns 403 for non-admin writes (verified) — but this read path bypasses it entirely.
- `threshold`, `effectiveFrom` and `effectiveTo` columns exist and are editable in the admin UI but are **never consulted** when selecting a rate. An admin can set a future effective date and it will apply immediately.

**Fix.** Seed defaults via migration, not lazily on read; add a unique index on `(tax_year, income_type)`; add `orderBy(effectiveFrom desc)`; honour `effectiveFrom`/`effectiveTo` in selection, or remove the columns.

---

### H-04 — PSEB registration comes from a URL parameter, not the user's record

- **Severity:** High — understated tax liability
- **Location:** [apps/api/src/modules/tax/tax.controller.ts:15-19](apps/api/src/modules/tax/tax.controller.ts#L15-L19) `const isPseb = pseb !== 'false';`
- **Status:** ✅ **VERIFIED live**

The estimate defaults to **PSEB-registered = true** and never reads `users.psebId`. A user with no PSEB registration sees the concessional **0.25%** rate instead of the standard **1%** — a 4× understatement of export tax. Verified: `?pseb=false → rate 1`, no param → `rate 0.25`, on an account whose `psebId` was null.

Frontend compounds it: `useTaxEstimate(true)` in [use-reports.ts:86](apps/web/src/hooks/use-reports.ts#L86) hardcodes `true`, and the Reports page passes `true` unconditionally. The Filing page, by contrast, correctly reads `profile?.psebId` — so the two pages disagree about the same user.

**Fix.** Derive `isPseb` from `user.psebId` server-side; keep the query param only as an explicit "what-if" override in the simulator.

---

### H-05 — Income-tax slab table is hardcoded in application code

- **Severity:** High — regulatory drift, unverifiable
- **Location:** [apps/api/src/modules/tax/tax.service.ts:113-125](apps/api/src/modules/tax/tax.service.ts#L113-L125)

```ts
if (incomePKR <= 600000) return 0;
else if (incomePKR <= 1200000) return (incomePKR - 600000) * 0.025;
else if (incomePKR <= 2400000) return 15000 + (incomePKR - 1200000) * 0.125;
else if (incomePKR <= 3600000) return 165000 + (incomePKR - 2400000) * 0.225;
else return 435000 + (incomePKR - 3600000) * 0.35;
```

The `tax_rules` table and its admin UI exist specifically so rates can change without a deploy — but they only drive the **export** rate. The slabs that compute local-income tax are literals. They cannot be updated for a new Finance Act without a code release, are not year-aware (the same slabs apply to every tax year queried), and are not shown to the user anywhere for verification. The bracket set also appears to be the *salaried* schedule; freelance/business income is assessed on a different schedule — this needs confirmation with a tax professional, and this audit cannot verify it.

**Fix.** Move slabs into `tax_rules` (or a `tax_slabs` table) keyed by tax year; have a professional verify the bracket set before the next filing season.

---

### H-06 — Failed FX fetches silently serve hardcoded rates with a fresh "updated" timestamp

- **Severity:** High — silently wrong financial data
- **Location:** [apps/api/src/modules/exchange-rate/exchange-rate.service.ts:12-17, 42-49, 81-84](apps/api/src/modules/exchange-rate/exchange-rate.service.ts#L12-L17)

**Problem.** Seed rates are literals (`USD: 280.50, EUR: 302.10, GBP: 356.40`). If the upstream fetch fails:

```ts
} catch (err) { this.logger.warn(`… Using fallback rates. …`); }
if (!this.lastFetchTimestamp) { this.lastFetchTimestamp = now; }   // ← marks it "fetched"
```

Setting the timestamp on failure means the 24-hour TTL check passes for the next day, so the service **stops retrying** and serves the hardcoded rates for 24 hours. Worse, `getAllRates()` returns `updatedAt: new Date(this.lastFetchTimestamp)` — a *current* timestamp — so the UI displays stale hardcoded rates as freshly fetched. There is no `isStale` signal anywhere in the response.

Additional: rates are cached per-process in memory, so a multi-instance deployment converts identical transactions at different rates depending on which pod serves the request, and nothing is persisted for audit (`income.exchangeRate` is stored per row, which is good, but the source and time of that rate is not).

**Fix.** Do not set `lastFetchTimestamp` on failure; return an explicit `stale: true` / real `fetchedAt`; surface staleness in the UI; persist rates to a table so all instances and future audits agree.

---

### H-07 — Two of four report endpoints ignore the tax year

- **Severity:** High — inconsistent reporting
- **Location:** [apps/api/src/modules/reports/reports.service.ts:50-80](apps/api/src/modules/reports/reports.service.ts#L50-L80)
- **Status:** ✅ **VERIFIED live**

`getIncomeVsExpenses` and `getIncomeConsolidation` accept and apply `year`. `getClientBreakdown` and `getPlatformBreakdown` accept no year parameter and aggregate **all income ever**.

Verified on the same dataset: trend chart totalled 555,920 (TY2026) while `client-breakdown` totalled 883,880 (lifetime) — a 59% difference between two charts fed by "the same" report API.

`getClientBreakdown` has a second defect: income with no `clientId` is bucketed as `"Other"`, and income whose client was deleted is bucketed as `"Unknown"` — two distinct labels for the same "unattributed" concept, both indistinguishable from a real client literally named "Other".

**Fix.** Add `year` to both endpoints and scope with `incomeInTaxYear`.

---

### H-08 — Reports page mixes three different periods in one view

- **Severity:** High
- **Location:** [apps/web/src/app/(dashboard)/reports/page.tsx:34-37, 103-108](apps/web/src/app/(dashboard)/reports/page.tsx#L34-L37)

On a single screen:
- Trend chart → `useIncomeVsExpensesReport()` → `?year=getCurrentTaxYear()` = **TY2027**
- KPI cards ("Total Revenue", "Net Profit", "Profit Margin") → `useIncome()` / `useExpenses()` → **all time**
- Tax liability card → `useTaxEstimate(true)` with no year → backend default **TY2026**

Additionally the tax card falls back to hardcoded literals when the estimate is unavailable:
```ts
const taxRate = … ?? "0.25%";
const taxLiability = … ?? formatPKR(totalRevenuePKR * 0.0025);
```
so a failed request renders a **fabricated tax figure** that looks identical to a real one.

**Fix.** Drive the whole page from one tax-year selector; remove the hardcoded fallbacks in favour of an error state.

---

### H-09 — `paymentMethod` is accepted then silently discarded on expenses

- **Severity:** High — silent data loss
- **Location:** [apps/api/src/modules/expenses/expenses.service.ts:57-67](apps/api/src/modules/expenses/expenses.service.ts#L57-L67) vs [dto/expense.dto.ts:49-52](apps/api/src/modules/expenses/dto/expense.dto.ts#L49-L52)
- **Status:** ✅ **VERIFIED live**

The DTO declares `paymentMethod`, the column exists with default `'bank_transfer'`, but `create()` never maps it into the insert (and `update()` never maps it either). The API returns `201` as though it saved.

Verified: posted `paymentMethod: "credit_card"` → stored `"bank_transfer"`.

**Fix.** Map the field in both `create` and `update`, or remove it from the DTO and column.

---

### H-10 — An empty PATCH body returns HTTP 500

- **Severity:** High — unhandled error, leaked internals
- **Location:** [income.service.ts:124-128](apps/api/src/modules/income/income.service.ts#L124-L128), [expenses.service.ts:105-109](apps/api/src/modules/expenses/expenses.service.ts#L105-L109), [wealth.service.ts:22-30, 51-59](apps/api/src/modules/wealth/wealth.service.ts#L22-L30)
- **Status:** ✅ **VERIFIED live**

All build `updateData` conditionally and call `.set(updateData)` unguarded. Drizzle throws when the object is empty.

Verified: `PATCH /income/:id` with `{}` → `HTTP 500 {"message":"No values to set"}`. Same for `/expenses/:id`. Reachable from the UI whenever a user opens an edit modal and saves without changing anything.

**Fix.** Return the existing record (or `400`) when `updateData` has no keys.

---

### H-11 — Database constraint violations surface as HTTP 500

- **Severity:** High
- **Location:** [apps/api/src/common/filters/http-exception.filter.ts:29-31](apps/api/src/common/filters/http-exception.filter.ts#L29-L31)
- **Status:** ✅ **VERIFIED live**

The catch-all filter passes any non-`HttpException` through as a 500 with `exception.message` verbatim. Verified: `taxRate: 100000` → `500 "numeric field overflow"`. The same path will leak constraint names, column names and other Postgres internals to clients on unique-violation races (e.g. concurrent invoice-number creation, C-14).

**Fix.** Map known Postgres SQLSTATEs (`22003` numeric overflow, `23505` unique violation, `23503` FK violation) to 400/409 with safe messages; log the raw error server-side only.

---

### H-12 — There is no toast system; notifications are re-implemented per page

- **Severity:** High — this is the root cause of the reported bug
- **Location:** [apps/web/src/components/ui/toast.tsx](apps/web/src/components/ui/toast.tsx), [apps/web/src/app/layout.tsx](apps/web/src/app/layout.tsx)

See the dedicated **Toast Notification Findings** section below for the full analysis and the complete list of 21 affected operations.

---

### H-13 — The Wealth page reports nothing to the user on any single write

- **Severity:** High
- **Location:** [apps/web/src/app/(dashboard)/wealth/page.tsx:71, 88, 108, 117, 162, 171](apps/web/src/app/(dashboard)/wealth/page.tsx#L71)

Six write paths — `updateOpeningWealth`, `addAsset`, `deleteAsset`, `addLiability`, `deleteLiability`, and the page's initial `fetchData` — all end in `catch (error) { console.error(error) }`. No toast, no inline error, no success confirmation. The page has a working `Toast` wired up, but **only** the two bulk-delete handlers use it.

Reproduce: submit an asset with a value exceeding `numeric(14,2)`, or with the API stopped. The dialog closes, `fetchData()` runs, the asset is absent, and the user is told nothing — indistinguishable from a successful save that didn't render.

Because wealth feeds the filing reconciliation, a silently-dropped asset produces an incorrect wealth statement with no warning.

---

### H-14 — `helmet` is installed but never applied

- **Severity:** High — missing security headers
- **Location:** [apps/api/package.json](apps/api/package.json) (`"helmet": "^8.0.0"`), [apps/api/src/main.ts](apps/api/src/main.ts)

`helmet` is a production dependency but `app.use(helmet())` appears nowhere in the codebase (verified: 0 references in `apps/api/src`). The API ships without HSTS, `X-Content-Type-Options`, `X-Frame-Options`, referrer policy or CSP.

**Fix.** `app.use(helmet())` in `bootstrap()`, before the global prefix.

---

### H-15 — Hardcoded JWT secret fallbacks

- **Severity:** High — authentication bypass if env is missing
- **Location:** [auth.service.ts:56, 102](apps/api/src/modules/auth/auth.service.ts#L56), [jwt.strategy.ts:12](apps/api/src/modules/auth/jwt.strategy.ts#L12)

```ts
process.env.JWT_SECRET || 'fh_dev_access_secret_key_2026_pk'
process.env.JWT_REFRESH_SECRET || 'fh_dev_refresh_secret_key_2026_pk'
```

These literals are committed to the repository. A deployment that fails to set the env vars starts successfully and signs tokens with a publicly known secret — anyone can forge a valid token for any user. There is no startup validation of required environment variables.

**Fix.** Throw at boot if `JWT_SECRET`/`JWT_REFRESH_SECRET` are unset; delete the literals.

---

### H-16 — Invoice numbers are randomly generated on the client

- **Severity:** High — audit/compliance
- **Location:** [apps/web/src/app/(dashboard)/invoices/new/page.tsx:60-64](apps/web/src/app/(dashboard)/invoices/new/page.tsx#L60-L64)

```ts
setInvoiceNumber(`${prefix}${Math.floor(1000 + Math.random() * 9000)}`);
```

The pre-filled number is a random 4-digit value. Tax authorities generally expect sequential, gap-free invoice numbering; random numbers make gaps and reordering indistinguishable from destroyed records. It can also collide with an existing number, producing a `409` at submit time after the user has filled the whole form.

The backend's own generator ([invoices.service.ts:107-117](apps/api/src/modules/invoices/invoices.service.ts#L107-L117)) *is* sequential and collision-avoiding — but only runs when the client sends no number, which the UI never does.

**Fix.** Expose a `GET /invoices/next-number` endpoint and use it, or send no number and let the server assign one.

---

### H-17 — CSV import: no de-duplication, invalid dates become today, no transaction

- **Severity:** High — financial accuracy
- **Location:** [apps/api/src/modules/csv/csv.service.ts:102-163](apps/api/src/modules/csv/csv.service.ts#L102-L163)

Three defects in one flow:

1. **No idempotency.** Re-uploading the same statement imports every row again. There is no dedupe on `refId`, date+amount, or a file hash — even though `Ref ID` is parsed and used to detect Upwork statements. A double-click on Import doubles the user's declared income.
2. **Invalid dates silently become today** ([:113-114](apps/api/src/modules/csv/csv.service.ts#L113-L114)): `const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;`. A malformed date column pushes historical transactions into the current tax year with no warning. `skippedRows` counts unusable *amounts* but not unusable dates.
3. **No transaction.** Rows are inserted one at a time in an `await` loop. A failure at row 700 of 1000 leaves a partial import with no rollback and no report of where it stopped.

Also: accounting-style negatives `(500)` parse as **positive** 500 ([:194-200](apps/api/src/modules/csv/csv.service.ts#L194-L200) strips the parentheses), turning a fee into income; `getOrCreateClient` silently creates clients from a regex over the description ([:202-208](apps/api/src/modules/csv/csv.service.ts#L202-L208)); and `POST /csv/import` has **no file-size or MIME limit** on the interceptor (contrast `/evidence/upload`, which correctly caps at 5 MB) — the 5 MB check exists only in the browser and is trivially bypassed.

---

### H-18 — A failed token refresh leaves queued requests hanging forever

- **Severity:** High
- **Location:** [apps/web/src/lib/api-client.ts:41-75](apps/web/src/lib/api-client.ts#L41-L75)

When a refresh is already in flight, concurrent 401s park a callback in `refreshSubscribers` and return a promise that only resolves via `onRefreshed()`. `onRefreshed()` is called **only on success**. In the `catch` branch the queue is never flushed or rejected, so every queued request's promise never settles. React Query stays in `isPending` indefinitely and those panels spin forever.

Two related issues in the same block:
- Queued requests never set `originalRequest._retry`, so a second 401 on a retried request re-enters the refresh flow — a potential loop.
- On success the interceptor calls `setTokens(accessToken)` but ignores the fresh `user` object the endpoint returns, so profile changes made elsewhere never propagate into the store.

This is aggravated by `JWT_EXPIRATION=2m` in the current `.env`, which exercises this path roughly every two minutes.

**Fix.** Flush `refreshSubscribers` with a rejection in the `catch`, set `_retry` on queued configs, and apply the returned `user`.

---

### H-19 — Evidence documents are uploaded with public blob access

- **Severity:** High — confidentiality
- **Location:** [apps/api/src/modules/evidence/evidence.service.ts:88-92](apps/api/src/modules/evidence/evidence.service.ts#L88-L92)

```ts
const blob = await put(filename, file.buffer, { access: 'public', … });
```

Evidence documents are PRCs, bank statements, invoices and receipts. They are stored at publicly readable URLs. `addRandomSuffix: true` provides obscurity, not access control: anyone with the URL — including anything that logs or forwards it — can read another user's bank statement indefinitely, with no revocation path.

The rest of this module is well built (ownership assertion, MIME+extension double-check, 5 MB cap at both interceptor and service, path-separator stripping) which makes the public ACL stand out as an oversight rather than a design decision.

**Fix.** Use private blob access with short-lived signed URLs minted by an authenticated endpoint.

---

### H-20 — CSV import modal reads the wrong error field and invalidates the wrong caches

- **Severity:** High
- **Location:** [apps/web/src/components/features/csv-import-modal.tsx:72-80](apps/web/src/components/features/csv-import-modal.tsx#L72-L80)

Two API-contract mismatches:

1. **Wrong error path.** `err.response?.data?.message` — but the API's error envelope is `{ success, data, error: { code, message, details } }`. The message is at `data.error.message`. The read always yields `undefined`, so the user sees axios's `"Request failed with status code 400"` instead of the actual reason (e.g. *"Could not find the required Date and Amount columns…"*). The codebase already has `apiErrorMessage()` in `lib/utils.ts` which handles this correctly — it just isn't used here.

2. **Wrong query keys.** It invalidates `["reports"]`, but the real report keys are `["report-income-vs-expenses"]`, `["report-client-breakdown"]`, `["report-platform-breakdown"]`, `["report-income-consolidation"]`. **No report ever refreshes after a CSV import.** It also omits `["transactions"]` and `["filing-readiness"]`, both of which are stale after import.

**Reproduce.** Import a valid CSV, then open Reports — the imported income is missing until a hard reload.

---

## Medium Priority

| ID | Area | Location | Problem |
|---|---|---|---|
| **M-01** | Clients earnings math | [clients.service.ts:38-52](apps/api/src/modules/clients/clients.service.ts#L38-L52) | `totalEarnings = incomeUSD > 0 ? incomeUSD : invoiceUSD` — conflates two different concepts. A client with any income shows *income*; otherwise it shows *invoiced* (uncollected) amounts, under the same "Total Billed" label. Amounts are also summed across currencies without conversion, so USD + EUR + PKR are added as bare numbers. |
| **M-02** | Clients FX fallback | [clients.service.ts:41](apps/api/src/modules/clients/clients.service.ts#L41) | `Number(inc.amountPKR \|\| (Number(inc.amount) * 280.50))` — hardcoded rate as fallback. |
| **M-03** | Reports client bucket | [reports.service.ts:56-64](apps/api/src/modules/reports/reports.service.ts#L56-L64) | Unattributed income splits into two labels (`"Other"` when `clientId` is null, `"Unknown"` when the client row is gone) and collides with any real client named "Other". |
| **M-04** | Double response envelope | [transactions.controller.ts:31-34](apps/api/src/modules/transactions/transactions.controller.ts#L31-L34) | Returns `{success, ...result}`, which `TransformInterceptor` wraps again → `{success, data:{success, data:[…], total,…}, error}`. **Verified.** The only endpoint with this shape; every other consumer must special-case it. |
| **M-05** | Defensive unwrapping everywhere | all hooks, e.g. [use-clients.ts:15](apps/web/src/hooks/use-clients.ts#L15) | `resData?.data?.data \|\| resData?.data \|\| resData \|\| []` appears ~30 times. Guessing at three possible shapes hides contract breaks: if the API changes, the fallback silently returns the wrapper object instead of failing. |
| **M-06** | Wealth tax-year key mismatch | [wealth.service.ts:13-14](apps/api/src/modules/wealth/wealth.service.ts#L13-L14) | `taxYear` is a free-text client string matched with exact equality. An asset saved as `"2025-26"` is invisible to a reconciliation querying `"2026"`. No normalisation via `parseTaxYear`. |
| **M-07** | GET creates rows | [wealth.service.ts:71-87](apps/api/src/modules/wealth/wealth.service.ts#L71-L87) | `getWealthStatement` INSERTs when absent — a side-effecting read, called transitively by `/filing/readiness`. No unique index on `(userId, taxYear)`, so concurrent loads create duplicates. |
| **M-08** | Tax rule mutations don't refresh | [use-tax.ts:63-90](apps/web/src/hooks/use-tax.ts#L63-L90) | `useCreateTaxRule`/`useUpdateTaxRule`/`useDeleteTaxRule` have no `onSuccess` invalidation (the component invalidates manually — fragile). `useCreateTaxRule` also calls `useTaxRules()` purely to destructure `refetch`, which it never uses — a wasted query subscription. |
| **M-09** | Admin form has no error handling | [tax-rules-tab.tsx:50-68](apps/web/src/components/features/tax-rules-tab.tsx#L50-L68) | `handleSubmit` has no `try/catch`. A 403 or validation error rejects unhandled: the form neither resets nor reports anything. |
| **M-10** | Dashboard fetches an unused query | [dashboard/page.tsx:18](apps/web/src/app/(dashboard)/dashboard/page.tsx#L18) | `const { data: invoices } = useInvoices();` — never referenced. A full invoice list is fetched on every dashboard load and discarded. |
| **M-11** | Dead "Monthly/Weekly" control | [dashboard/page.tsx:174-177](apps/web/src/app/(dashboard)/dashboard/page.tsx#L174-L177) | `<select>` with no `value`, no `onChange`, no effect. Looks functional, does nothing. |
| **M-12** | Dead global search | [header.tsx:38-44, 68-74](apps/web/src/components/layout/header.tsx#L38-L44) | "Search anything…" with a `⌘F` hint, on every page. No state, no handler, no results. Mobile has a second dead copy. |
| **M-13** | Fake notification bell | [header.tsx:56-64](apps/web/src/components/layout/header.tsx#L56-L64) | A permanent unread dot (`bg-primary` ping) that always opens *"You have no new notifications at this time."* The badge is unconditional markup, so it signals unread items that can never exist. |
| **M-14** | Pending-amount disagreement | [invoices/page.tsx:27-29](apps/web/src/app/(dashboard)/invoices/page.tsx#L27-L29) vs [dashboard.service.ts:19-20](apps/api/src/modules/dashboard/dashboard.service.ts#L19-L20) | Invoices page: `pending = totalBilled − totalPaid` (counts **cancelled** as pending). Dashboard: excludes cancelled. Two different pending figures. |
| **M-15** | Transactions sorting is page-local | [transactions/page.tsx:67-87](apps/web/src/app/(dashboard)/transactions/page.tsx#L67-L87) | Sorting reorders only the 20 loaded rows, while every other table sorts the full set. Clicking "Amount ↓" shows the largest of *this page*, not overall — visually identical to a real sort. |
| **M-16** | No debounce on search | [clients/page.tsx:263-268](apps/web/src/app/(dashboard)/clients/page.tsx#L263-L268), transactions page | `search` is in the query key, so every keystroke issues a request. |
| **M-17** | Server-side filters unused | [clients.service.ts:11-28](apps/api/src/modules/clients/clients.service.ts#L11-L28) | Backend supports `status` and `platform` filters; the UI filters client-side instead and never sends them. Search is applied *twice* (server then client). |
| **M-18** | Bulk delete skips the safety warning | [clients/page.tsx:161-182](apps/web/src/app/(dashboard)/clients/page.tsx#L161-L182) | Single delete uses a careful two-step confirm showing exactly what will be lost. Bulk delete jumps straight to `force: true` with a generic warning and no per-client counts — the more destructive action has the weaker guard. |
| **M-19** | Native `confirm()` / `alert()` | [tax-rules-tab.tsx:71](apps/web/src/components/features/tax-rules-tab.tsx#L71), [evidence-vault-modal.tsx:51](apps/web/src/components/features/evidence-vault-modal.tsx#L51) | Two places use browser dialogs while the rest of the app uses `ConfirmModal`/`Toast`. |
| **M-20** | Evidence delete fails silently | [evidence-vault-modal.tsx:55-62](apps/web/src/components/features/evidence-vault-modal.tsx#L55-L62) | `deleteMutation` has no `onError`. A failed delete leaves the document listed with no explanation. |
| **M-21** | N+1-style in-memory aggregation | [clients.service.ts:30-33](apps/api/src/modules/clients/clients.service.ts#L30-L33), [transactions.service.ts:45-91](apps/api/src/modules/transactions/transactions.service.ts#L45-L91), [reports.service.ts](apps/api/src/modules/reports/reports.service.ts), [filing.service.ts:26-46](apps/api/src/modules/filing/filing.service.ts#L26-L46) | Every aggregation loads all rows for the user into Node and reduces in JS. `/transactions` loads the entire ledger to return 20 rows. No `LIMIT`/`OFFSET`/`SUM` pushed to Postgres. Fine at demo scale; degrades linearly. |
| **M-22** | Filing does duplicate work | [filing.service.ts:206-208](apps/api/src/modules/filing/filing.service.ts#L206-L208) | `getChecklist` calls `collect()` then `getReadinessScore()`, which calls `collect()` again — every query runs twice per request. |
| **M-23** | Access token in localStorage | [auth.store.ts:50-53](apps/web/src/stores/auth.store.ts#L50-L53) | Persisted to `localStorage`, readable by any XSS. The refresh token is correctly httpOnly, so the pattern is inconsistent. |
| **M-24** | No login rate limiting | [app.module.ts:24-29](apps/api/src/app.module.ts#L24-L29) | Only a global 100 req/min throttle. **Verified:** 5 consecutive failed logins all returned 401 with no lockout or backoff. Password brute-forcing is limited only by the global bucket. |

---

## Low Priority

| ID | Area | Location | Problem |
|---|---|---|---|
| **L-01** | Demo identity fallback | [sidebar.tsx:48-49](apps/web/src/components/layout/sidebar.tsx#L48-L49) | `user?.name \|\| "Ahmed Ali"`, `user?.email \|\| "ahmed.dev@example.com"`. If the store is empty the sidebar shows a fabricated person's name and email as the signed-in user. |
| **L-02** | Rounding inconsistency | [invoices.service.ts:141-153](apps/api/src/modules/invoices/invoices.service.ts#L141-L153) | `totalPKR` is computed from the **unrounded** float total, while `total` is rounded by the column. **Verified:** stored `total 1236.99 × 280.5 = 346,975.70` but stored `totalPKR = 346,975.22` — a 0.48 discrepancy. Values are stringified floats (`99.99000000000001`) and left to Postgres to round. |
| **L-03** | Frontend/backend total mismatch | [invoices/new/page.tsx:120-136](apps/web/src/app/(dashboard)/invoices/new/page.tsx#L120-L136) | The form sends `subtotal`, `total`, `totalPKR`; the server accepts them into the DTO and then ignores them (correctly recomputing). The preview the user approves can differ from what is stored. |
| **L-04** | Losses hidden | [tax.service.ts:68](apps/api/src/modules/tax/tax.service.ts#L68) | `netProfitPKR = Math.max(0, …)` — a loss-making year displays Rs 0 profit rather than the loss. |
| **L-05** | Hardcoded deadline string | [tax.service.ts:107](apps/api/src/modules/tax/tax.service.ts#L107) | `fbrFilingDeadline: \`September 30, ${taxYear}\`` — a statutory date as a template literal; FBR routinely extends it. |
| **L-06** | Hardcoded reconciliation tolerance | [wealth.service.ts:133](apps/api/src/modules/wealth/wealth.service.ts#L133) | `toleranceThresholdPKR = 50000` literal; not configurable and not scaled to wealth size. |
| **L-07** | Export classification heuristic | [tax.service.ts:56-57](apps/api/src/modules/tax/tax.service.ts#L56-L57) | Export = non-PKR currency **or** platform ∈ {upwork, fiverr, freelancer}. A foreign client paying in PKR is misclassified as local income and taxed on slabs instead of s.154A. |
| **L-08** | Front-end FX fallbacks | [use-exchange-rate.ts:12,19,21](apps/web/src/hooks/use-exchange-rate.ts#L12), [clients/page.tsx:79,320](apps/web/src/app/(dashboard)/clients/page.tsx#L79), [invoices/new:37,96](apps/web/src/app/(dashboard)/invoices/new/page.tsx#L37), [invoices/[id]/edit:48,71,193](apps/web/src/app/(dashboard)/invoices/%5Bid%5D/edit/page.tsx#L48) | `280.50` / `280.5` hardcoded in 9 places as a silent fallback. |
| **L-09** | Static rate in UI copy | [clients/page.tsx:236](apps/web/src/app/(dashboard)/clients/page.tsx#L236) | *"Auto-converted at ~280.50 PKR"* is fixed text under a live figure — it will misstate the rate as soon as FX moves. |
| **L-10** | Mislabelled KPI | [clients/page.tsx:209-214](apps/web/src/app/(dashboard)/clients/page.tsx#L209-L214) | "Active Clients" counts **all** clients including archived. |
| **L-11** | Mixed-currency USD total | [clients/page.tsx:78, 224](apps/web/src/app/(dashboard)/clients/page.tsx#L78) | "Lifetime Revenue (USD)" sums client totals across USD/EUR/GBP/PKR and formats the result as USD. |
| **L-12** | Mislabelled CTA | [dashboard/page.tsx:42-46](apps/web/src/app/(dashboard)/dashboard/page.tsx#L42-L46) | "New Payment" navigates to `/invoices/new`. Creating an invoice is not recording a payment. |
| **L-13** | Dead row action | [dashboard/page.tsx:228-234](apps/web/src/app/(dashboard)/dashboard/page.tsx#L228-L234) | A per-row "…" menu button that is just a link to `/transactions` — identical for every row. |
| **L-14** | Dead link | [login/page.tsx:74](apps/web/src/app/(auth)/login/page.tsx#L74) | "Forgot password?" → `href="#"`. There is no password-reset flow anywhere in the codebase. |
| **L-15** | Misleading landing CTA | [app/page.tsx:82-86](apps/web/src/app/page.tsx#L82-L86) | Button labelled "Demo Login" goes to the normal `/login`; no demo credentials are provided. |
| **L-16** | Growth label with no value | [dashboard/page.tsx:94-101, 118-125](apps/web/src/app/(dashboard)/dashboard/page.tsx#L94-L101) | "Since Last Month" renders unconditionally; the percentage only renders when non-null, leaving a dangling label for new users. |
| **L-17** | Migration history gap | [migrations/meta/_journal.json](apps/api/src/database/migrations/meta/_journal.json) | Journal indices jump 0,1,**3**,4…9 — `0002` is missing. Consistent for Drizzle today, but indicates a hand-edited journal, which undermines reproducible deploys. |
| **L-18** | Hardcoded year defaults in UI | [settings/page.tsx:40](apps/web/src/app/(dashboard)/settings/page.tsx#L40) `"FH-2026-"`, [tax-rules-tab.tsx:24,31](apps/web/src/components/features/tax-rules-tab.tsx#L24) `"2026-27"`, [schema/users.ts](apps/api/src/database/schema/users.ts) `invoicePrefix.default('FH-2026-')` | Year literals that go stale on 1 January / 1 July. The schema default means every account created in 2027 gets a `FH-2026-` prefix. |

### Dead code / unused assets

| Item | Location | Note |
|---|---|---|
| `ThemeProvider` | [providers/theme-provider.tsx](apps/web/src/providers/theme-provider.tsx) | Imported by 0 files; `next-themes` is a dependency; the root layout never renders it. No dark-mode toggle exists despite the CSS tokens supporting it. |
| `useClientBreakdownReport` | [use-reports.ts:26](apps/web/src/hooks/use-reports.ts#L26) | 0 usages. |
| `usePlatformBreakdownReport` | [use-reports.ts:46](apps/web/src/hooks/use-reports.ts#L46) | 0 usages. |
| `useRecentActivity` | [use-dashboard.ts:24](apps/web/src/hooks/use-dashboard.ts#L24) | 0 usages. |
| `useFilingChecklist` | [use-filing.ts:25](apps/web/src/hooks/use-filing.ts#L25) | 0 usages. |
| Duplicate `useTaxEstimate` | [use-reports.ts:86](apps/web/src/hooks/use-reports.ts#L86) **and** [use-tax.ts:5](apps/web/src/hooks/use-tax.ts#L5) | Two hooks, same name, different signatures, **colliding `["tax-estimate", …]` query key prefix**. |
| `GET /dashboard/recent-activity` | [dashboard.controller.ts:16-19](apps/api/src/modules/dashboard/dashboard.controller.ts#L16-L19) | Dead endpoint — no caller. |
| `GET /reports/client-breakdown` | [reports.controller.ts:16](apps/api/src/modules/reports/reports.controller.ts#L16) | Dead endpoint. |
| `GET /reports/platform-breakdown` | [reports.controller.ts:21](apps/api/src/modules/reports/reports.controller.ts#L21) | Dead endpoint. |
| `GET /filing/checklist` | [filing.controller.ts:16](apps/api/src/modules/filing/filing.controller.ts#L16) | Dead endpoint (and the most expensive one — it runs `collect()` twice). |
| `POST /auth/logout` | [auth.controller.ts:56](apps/api/src/modules/auth/auth.controller.ts#L56) | Dead endpoint — see C-09. |
| `GET /auth/me` | [auth.controller.ts:63](apps/api/src/modules/auth/auth.controller.ts#L63) | Dead endpoint (`/users/profile` is used instead). |
| `packages/shared` | [packages/shared](packages/shared) | Declared as a dependency of **both** apps; imported by **0** files. Its `types/api.ts`, `types/auth.ts`, `types/dashboard.ts` and `validators` duplicate types that are re-declared inline in each app. |
| `packages/eslint-config` | [packages/eslint-config](packages/eslint-config) | Referenced by nothing (see H-02). |
| `RefreshDto` | [auth.dto.ts:37-41](apps/api/src/modules/auth/dto/auth.dto.ts#L37-L41) | Unused — refresh reads the cookie. |
| Unused deps (web) | package.json | `html2canvas`, `recharts`, `react-hook-form`, `zod`, `@hookform/resolvers` — 0 imports each. (`recharts` is notable: charts are hand-rolled with divs.) |
| Dead ternary | [csv.service.ts:137](apps/api/src/modules/csv/csv.service.ts#L137) | `category: isUpworkStatement ? 'other' : 'other'`. |
| Unused import | [invoice.dto.ts:1](apps/api/src/modules/invoices/dto/invoice.dto.ts#L1) | `Max` imported, never used — the missing validator from C-10. |
| `console.*` in shipped code | 10 sites in `apps/web/src` | `wealth/page.tsx` ×6, `use-profile.ts`, `use-transactions.ts`, `income/page.tsx`, `csv-import-modal.tsx` — all are error paths where the user sees nothing. |

---

## Static / Hardcoded Data Findings

Every value below was found by exhaustive grep across `apps/*/src`. "Verdict" distinguishes legitimate configuration/UI copy from values that should come from the database or an API.

### Financial values that should be dynamic — **BUGS**

| File | Line / component | Hardcoded value | Should come from | Verdict |
|---|---|---|---|---|
| [apps/api/.../invoices.service.ts](apps/api/src/modules/invoices/invoices.service.ts#L137) | `:137` `create()` | `280` (FX rate) | `ExchangeRateService.getRate(currency,'PKR')` | 🔴 **BUG — C-05.** Verified 12.8% error on EUR. |
| [apps/api/.../exchange-rate.service.ts](apps/api/src/modules/exchange-rate/exchange-rate.service.ts#L12-L17) | `:12-17` `cachedRates` | `USD 280.50, EUR 302.10, GBP 356.40` | Live FX API | 🟠 **Partial** — acceptable as a cold-start seed, but served silently and indefinitely on failure (H-06). |
| [apps/api/.../exchange-rate.service.ts](apps/api/src/modules/exchange-rate/exchange-rate.service.ts#L29) | `:29` `getRate` | `\|\| 280.50` for unknown currency | FX API | 🔴 **BUG** — an unrecognised currency converts at the USD rate rather than erroring. |
| [apps/api/.../exchange-rate.service.ts](apps/api/src/modules/exchange-rate/exchange-rate.service.ts#L69-L70) | `:69-70` | `302.10` / `356.40` derivation fallbacks | FX API | 🔴 **BUG** — same silent-stale problem. |
| [apps/api/.../clients.service.ts](apps/api/src/modules/clients/clients.service.ts#L41) | `:41` `findAll` | `280.50` | `income.amountPKR` (stored per row) | 🔴 **BUG — M-02.** |
| [apps/api/.../tax.service.ts](apps/api/src/modules/tax/tax.service.ts#L113-L125) | `:113-125` `calculateLocalTaxSlabs` | `600000 / 1200000 / 2400000 / 3600000` and `2.5% / 12.5% / 22.5% / 35%` | `tax_rules` table (which exists for this purpose) | 🔴 **BUG — H-05.** Cannot be updated without a deploy; not year-aware. |
| [apps/api/.../tax.service.ts](apps/api/src/modules/tax/tax.service.ts#L137) | `:137` `getExportTaxRate` | `0.0025` / `0.01` | `tax_rules` | 🟠 **Partial** — reasonable defaults, but written into the shared table by a GET (H-03). |
| [apps/api/.../tax.service.ts](apps/api/src/modules/tax/tax.service.ts#L107) | `:107` | `"September 30, ${taxYear}"` | Config / `tax_rules` | 🟡 **Bug (minor) — L-05.** |
| [apps/api/.../wealth.service.ts](apps/api/src/modules/wealth/wealth.service.ts#L133) | `:133` | `toleranceThresholdPKR = 50000` | Config | 🟡 **Minor** — should be configurable. |
| [apps/web/.../use-exchange-rate.ts](apps/web/src/hooks/use-exchange-rate.ts#L12) | `:12, :19, :21` | `280.50` ×3 | `/exchange-rate/convert` | 🔴 **BUG** — a failed FX call silently produces a wrong PKR preview. |
| [apps/web/.../clients/page.tsx](apps/web/src/app/(dashboard)/clients/page.tsx#L79) | `:79, :320` | `280.50` ×2 | `client.totalEarningsPKR` | 🔴 **BUG — L-08.** |
| [apps/web/.../clients/page.tsx](apps/web/src/app/(dashboard)/clients/page.tsx#L236) | `:236` KPI caption | `"Auto-converted at ~280.50 PKR"` | Live rate | 🔴 **BUG — L-09.** Static text presented as the applied rate. |
| [apps/web/.../invoices/new/page.tsx](apps/web/src/app/(dashboard)/invoices/new/page.tsx#L37) | `:37, :96` | `280.5` initial + fallback | `useExchangeRate(currency)` | 🟠 **Partial** — overwritten by the live rate on load, but is the value used if FX fails. |
| [apps/web/.../invoices/[id]/edit/page.tsx](apps/web/src/app/(dashboard)/invoices/%5Bid%5D/edit/page.tsx#L48) | `:48, :71, :193` | `280.5` ×3 | Stored `invoice.exchangeRate` | 🟠 **Partial.** |
| [apps/web/.../reports/page.tsx](apps/web/src/app/(dashboard)/reports/page.tsx#L103-L108) | `:103-108` | `"0.25%"` and `totalRevenuePKR * 0.0025` | `/tax/estimate` | 🔴 **BUG — H-08.** Renders a **fabricated tax liability** when the estimate fails, visually identical to a real one. |

### Date / tax-year values

| File | Line | Hardcoded value | Should come from | Verdict |
|---|---|---|---|---|
| [apps/api/src/common/tax-year.ts](apps/api/src/common/tax-year.ts#L8) | `:8` | `DEFAULT_TAX_YEAR = 2026` | `getCurrentTaxYear(new Date())` | 🔴 **BUG — C-06.** Already stale. |
| [apps/api/.../wealth.controller.ts](apps/api/src/modules/wealth/wealth.controller.ts#L12) | `:12,17,22,42,62` | `year: string = '2026'` ×5 | Current tax year | 🔴 **BUG — C-06.** |
| [apps/api/.../schema/users.ts](apps/api/src/database/schema/users.ts) | `invoicePrefix` | `.default('FH-2026-')` | Computed at account creation | 🟡 **Bug (minor)** — every 2027 signup gets a 2026 prefix. |
| [apps/web/.../settings/page.tsx](apps/web/src/app/(dashboard)/settings/page.tsx#L40) | `:40` | `useState("FH-2026-")` | `profile.invoicePrefix` | 🟡 **Minor** — overwritten once the profile loads; visible during the first render. |
| [apps/web/.../tax-rules-tab.tsx](apps/web/src/components/features/tax-rules-tab.tsx#L24) | `:24, :31` | `"2026-27"` | Current tax-year label | 🟡 **Minor.** |
| [apps/web/src/app/page.tsx](apps/web/src/app/page.tsx#L175) | `:175` | `"© 2026"` | `new Date().getFullYear()` | 🟢 **Cosmetic.** |

### Identity / demo data

| File | Line | Hardcoded value | Verdict |
|---|---|---|---|
| [apps/web/.../sidebar.tsx](apps/web/src/components/layout/sidebar.tsx#L48-L49) | `:48-49` | `"Ahmed Ali"`, `"ahmed.dev@example.com"`, `"AA"` | 🔴 **BUG — L-01.** A fabricated identity shown as the logged-in user. |
| [apps/api/src/database/seed.ts](apps/api/src/database/seed.ts) | `:16-32` | `adnan@gmail.com`, `password123`, `PSEB-2026-98765`, `PK36MEZN0001020304050607`, `isAdmin: true` | 🔴 **BUG — C-08.** Demo data, but the script applies it to real accounts and creates a known-password admin. |
| [apps/api/src/database/seed.ts](apps/api/src/database/seed.ts) | throughout | Clients (`TechFlow Inc.`), invoices `FH-2026-0001..3`, rates `280.50`/`280.00` | 🟢 **Intentional** demo fixtures — the danger is the script's scope, not the values. |
| [apps/web/.../csv-import-modal.tsx](apps/web/src/components/features/csv-import-modal.tsx#L88-L101) | `:88-101` | Sample Upwork CSV (TechFlow Labs, Acme Corp, dated 08/2026) | 🟢 **Intentional** — an explicit "try a sample" affordance. Note it writes real rows into the user's ledger. |

### UI content — intentional

| File | Value | Verdict |
|---|---|---|
| [apps/web/.../guide/page.tsx](apps/web/src/app/(dashboard)/guide/page.tsx) | Entire `guideSections` array (~120 lines of manual copy) | 🟢 **Intentional** — it is a user manual. Two figures inside it (`0.25%`, `280.50`) will go stale and would be better interpolated. |
| [apps/web/src/app/page.tsx](apps/web/src/app/page.tsx) | Landing-page feature cards and marketing copy | 🟢 **Intentional.** |
| [apps/web/.../use-expenses.ts](apps/web/src/hooks/use-expenses.ts#L6-L17) | `EXPENSE_CATEGORIES` labels | 🟢 **Intentional** — mirrors the pg enum; the comment says so. Ideally exposed by the API to prevent drift. |
| [apps/web/.../sidebar.tsx](apps/web/src/components/layout/sidebar.tsx#L10-L23) | `navItems` | 🟢 **Intentional.** |
| [apps/api/.../income.service.ts](apps/api/src/modules/income/income.service.ts#L71) | SBP purpose code `'9100'` | 🟢 **Intentional** — the correct SBP code for IT-services export; user-overridable in the UI. |
| Platform / status / asset-type enums | various | 🟢 **Intentional** — mirror DB enums. |

**Summary:** 32 hardcoded findings — **14 genuine bugs**, 6 partial (acceptable seed, dangerous fallback), 12 intentional.
**No fake API responses, mock data layers, or static arrays rendered as real records were found.** Every table and metric in the app is fed by a real API call. The problem is not fabricated data; it is *real data converted, scoped, or bounded by hardcoded constants*.

---

## Toast Notification Findings

### Root cause: there is no toast system

The reported symptom — "toasts appear for client deletion and about two other actions" — is exactly right, and the cause is structural.

`Toast` ([apps/web/src/components/ui/toast.tsx](apps/web/src/components/ui/toast.tsx)) is a **presentational component only**. There is:

- ❌ **No provider.** [app/layout.tsx](apps/web/src/app/layout.tsx) renders only `QueryProvider`. No `ToastProvider`, no `<Toaster />`, no portal.
- ❌ **No hook.** There is no `useToast()`. Grep for `useToast` across `apps/web`: **0 results**.
- ❌ **No queue.** The component renders itself at `fixed bottom-6 right-6`. Two simultaneous toasts stack in the same position and overlap.
- ❌ **No global error handling.** `QueryProvider` sets no `QueryCache`/`MutationCache` `onError`, so React Query failures are never routed anywhere.
- ❌ **No mutation-level defaults.** Not one hook in `apps/web/src/hooks/` has an `onError`. Every hook defines only `onSuccess` for cache invalidation.

Consequently a toast exists **only** where a developer manually declared `const [toast, setToast] = useState(...)`, manually called `setToast(...)` at the right moment, **and** manually rendered `{toast && <Toast … />}` in that page's JSX. All three steps, per page, per action. Nine files do this independently.

The component itself is fine — the `onCloseRef` pattern at [toast.tsx:18-26](apps/web/src/components/ui/toast.tsx#L18-L26) correctly avoids the stuck-toast bug. The problem is entirely that nothing coordinates it.

### Why deletes work and creates don't

Deletion handlers were written in a `try/catch` that reports **both** branches:

```ts
// clients/page.tsx:140-157 — the pattern that works
try {
  await deleteClientMutation.mutateAsync({ id, force });
  setToast({ type: "success", title: "Client Deleted", … });   // ✅ success
} catch (err) {
  setToast({ type: "error", title: "Delete Client Failed", … }); // ✅ error
}
```

Save handlers on the very same pages report only failure:

```ts
// clients/page.tsx:121-135 — the pattern that doesn't
try {
  await createClientMutation.mutateAsync(payload);
  setIsAddOpen(false);          // ❌ closes the modal, says nothing
} catch (err) {
  setToast({ type: "error", … }); // only the error branch exists
}
```

So creating a client succeeds silently: the modal closes, the row appears in the table, and the user gets no confirmation. Deleting a client announces itself. **The asymmetry is per-handler, not per-page** — which is why it looks arbitrary from the outside.

A secondary cause affects navigation-away flows. In [invoices/new/page.tsx:138-147](apps/web/src/app/(dashboard)/invoices/new/page.tsx#L138-L147) the success path calls `router.push('/invoices')` immediately. Even if a success toast were set there, the component unmounts on navigation and the toast disappears with it — a page-local toast **cannot** survive a route change. This alone makes a provider mandatory rather than optional.

A third cause is H-01: because query hooks swallow errors, load failures never even reach a place where a toast could be raised.

### Complete coverage matrix

**✅ Working — success + error (9 operations)**

| Operation | File |
|---|---|
| Delete client (single) | [clients/page.tsx:147,154](apps/web/src/app/(dashboard)/clients/page.tsx#L147) |
| Delete clients (bulk) | [clients/page.tsx:174,176](apps/web/src/app/(dashboard)/clients/page.tsx#L174) |
| Delete invoice (single) | [invoices/page.tsx:64,66](apps/web/src/app/(dashboard)/invoices/page.tsx#L64) |
| Delete invoices (bulk) | [invoices/page.tsx:82](apps/web/src/app/(dashboard)/invoices/page.tsx#L82) |
| Delete expense (single) | [expenses/page.tsx:58,60](apps/web/src/app/(dashboard)/expenses/page.tsx#L58) |
| Delete expenses (bulk) | [expenses/page.tsx:76](apps/web/src/app/(dashboard)/expenses/page.tsx#L76) |
| Delete income (single) | [income/page.tsx:81,90](apps/web/src/app/(dashboard)/income/page.tsx#L81) |
| Delete income (bulk) | [income/page.tsx:70](apps/web/src/app/(dashboard)/income/page.tsx#L70) |
| Delete transactions (bulk) | [transactions/page.tsx:134](apps/web/src/app/(dashboard)/transactions/page.tsx#L134) |

Every one is a **delete**. Plus two non-delete cases:

| Operation | File | Note |
|---|---|---|
| Save profile settings | [settings/page.tsx:123,125](apps/web/src/app/(dashboard)/settings/page.tsx#L123) | ✅ success + error (rendered outside the tab, so it survives tab switches) |
| Bulk delete assets / liabilities | [wealth/page.tsx:144,196](apps/web/src/app/(dashboard)/wealth/page.tsx#L144) | ✅ success + error |

**⚠️ Error only — silent on success (5 operations)**

| Operation | File | Missing |
|---|---|---|
| Create client | [clients/page.tsx:128-134](apps/web/src/app/(dashboard)/clients/page.tsx#L128-L134) | success |
| Update client | [clients/page.tsx:128-134](apps/web/src/app/(dashboard)/clients/page.tsx#L128-L134) | success |
| Create invoice | [invoices/new/page.tsx:141-147](apps/web/src/app/(dashboard)/invoices/new/page.tsx#L141-L147) | success (also unmounts on redirect) |
| Create income / Update income | [add-income-modal.tsx:85-87](apps/web/src/components/features/add-income-modal.tsx#L85-L87) | success; uses an inline banner, not a toast |
| Create expense / Update expense | [add-expense-modal.tsx](apps/web/src/components/features/add-expense-modal.tsx) | success; inline banner |

**❌ No notification at all — success or failure (21 operations)**

| Operation | File | Current behaviour |
|---|---|---|
| **Mark invoice as paid** | [invoices/[id]/page.tsx:85-87](apps/web/src/app/(dashboard)/invoices/%5Bid%5D/page.tsx#L85-L87) | `mutate()` with no `onSuccess`/`onError` — a failure is completely invisible |
| Update invoice (edit page) | [invoices/[id]/edit/page.tsx:240-256](apps/web/src/app/(dashboard)/invoices/%5Bid%5D/edit/page.tsx#L240-L256) | has toasts ✅ — *this one is fine* |
| Update opening wealth | [wealth/page.tsx:82-91](apps/web/src/app/(dashboard)/wealth/page.tsx#L82-L91) | `console.error` only |
| Add asset | [wealth/page.tsx:93-111](apps/web/src/app/(dashboard)/wealth/page.tsx#L93-L111) | `console.error` only |
| Delete asset (single) | [wealth/page.tsx:113-120](apps/web/src/app/(dashboard)/wealth/page.tsx#L113-L120) | `console.error` only |
| Add liability | [wealth/page.tsx:151-165](apps/web/src/app/(dashboard)/wealth/page.tsx#L151-L165) | `console.error` only |
| Delete liability (single) | [wealth/page.tsx:167-174](apps/web/src/app/(dashboard)/wealth/page.tsx#L167-L174) | `console.error` only |
| Wealth page data load | [wealth/page.tsx:71-75](apps/web/src/app/(dashboard)/wealth/page.tsx#L71-L75) | `console.error`; page renders as empty |
| Login (success) | [login/page.tsx:26-33](apps/web/src/app/(auth)/login/page.tsx#L26-L33) | redirect only; errors use an inline banner |
| Login (error) | [login/page.tsx:34-37](apps/web/src/app/(auth)/login/page.tsx#L34-L37) | inline banner, not a toast |
| Register (success/error) | [register/page.tsx:27-41](apps/web/src/app/(auth)/register/page.tsx#L27-L41) | inline banner only |
| **Logout** | [sidebar.tsx:36-39](apps/web/src/components/layout/sidebar.tsx#L36-L39) | no feedback (and no API call — C-09) |
| Change password (success) | [settings/page.tsx:134-139](apps/web/src/app/(dashboard)/settings/page.tsx#L134-L139) | sets `passwordSuccess` → inline, not a toast |
| Change password (error) | [settings/page.tsx:140-142](apps/web/src/app/(dashboard)/settings/page.tsx#L140-L142) | inline |
| Create tax rule | [tax-rules-tab.tsx:50-68](apps/web/src/components/features/tax-rules-tab.tsx#L50-L68) | no `try/catch` — unhandled rejection |
| Update tax rule | [tax-rules-tab.tsx:50-68](apps/web/src/components/features/tax-rules-tab.tsx#L50-L68) | unhandled rejection |
| Delete tax rule | [tax-rules-tab.tsx:70-75](apps/web/src/components/features/tax-rules-tab.tsx#L70-L75) | native `confirm()`; no result feedback |
| Upload evidence (success) | [evidence-vault-modal.tsx:45-48](apps/web/src/components/features/evidence-vault-modal.tsx#L45-L48) | list refresh only |
| Upload evidence (error) | [evidence-vault-modal.tsx:49-52](apps/web/src/components/features/evidence-vault-modal.tsx#L49-L52) | native `alert("Failed to upload file")` |
| Delete evidence | [evidence-vault-modal.tsx:55-62](apps/web/src/components/features/evidence-vault-modal.tsx#L55-L62) | no `onError` at all |
| CSV import (success/error) | [csv-import-modal.tsx:67-84](apps/web/src/components/features/csv-import-modal.tsx#L67-L84) | in-modal state; error message resolves to the wrong field (H-20) |
| Run tax simulation | [tax-simulator/page.tsx:35-38](apps/web/src/app/(dashboard)/tax-simulator/page.tsx#L35-L38) | inline error banner only |
| Generate filing package | [use-generate-package.ts:301-303](apps/web/src/hooks/use-generate-package.ts#L301-L303) | sets `generateError` string; no success feedback on a long-running download |

**Five distinct notification mechanisms coexist:** local-state `Toast`, inline error banners, native `alert()`, native `confirm()`, and `console.error`.

### Recommended fix (for approval — not applied)

1. Add a `ToastProvider` + `useToast()` (context + reducer + queue) and mount `<Toaster />` once in [app/layout.tsx](apps/web/src/app/layout.tsx), outside the route tree so toasts survive navigation.
2. Give `QueryProvider` a `MutationCache({ onError })` and `QueryCache({ onError })` that raise an error toast via `apiErrorMessage()` by default — this alone fixes every "silent failure" row above.
3. Add an optional `successMessage` to each mutation hook's `meta` so success toasts are declared once per hook rather than per call site.
4. Remove H-01's `catch → return []` so load failures reach the cache handler.
5. Replace the two `alert()`/`confirm()` sites with `Toast`/`ConfirmModal`.
6. Delete the per-page toast state from all nine files.

---

## Final Test Matrix

Legend: **PASS** works as intended · **PARTIAL** works but with defects · **FAIL** broken or incorrect · **NOT TESTED** out of reach in this session

### Authentication & session

| Feature | Result | Notes |
|---|---|---|
| Register (happy path) | PASS | 201, tokens + user returned, refresh cookie set |
| Register — duplicate email | PASS | 409 "Email address is already registered" |
| Register — weak password | PASS | 400, both rule violations listed |
| Login (happy path) | PASS | |
| Login — wrong password | PASS | 401, no user enumeration |
| Login — brute force protection | FAIL | M-24: 5 failed attempts, no lockout |
| Logout | FAIL | C-09: token not revoked; UI never calls the endpoint |
| Protected route — no token | PASS | 401 |
| Protected route — garbage token | PASS | 401 |
| Refresh token rotation | PASS | Old token revoked, new issued |
| Refresh token reuse detection | PASS | 401 on replay of a rotated token |
| Zustand hydration / page refresh | PASS | `onFinishHydration` guard is correct; no logout flash |
| Redirect when unauthenticated | PASS | |
| Concurrent 401 refresh queue | FAIL | H-18: hangs forever if refresh fails |
| Password change + session revoke | PASS | Verified in code; revokes all refresh tokens |
| Password reset | NOT TESTED | Feature does not exist (L-14) |

### Clients

| Feature | Result | Notes |
|---|---|---|
| List / search / platform filter | PARTIAL | M-16 no debounce, M-17 filters duplicated client-side |
| Create | PARTIAL | Works; no success toast |
| Validation (blank name, bad email, unknown field) | PASS | 400 with clear messages |
| Update | PARTIAL | Works; no success toast |
| Delete — two-step force confirm | PASS | Excellent UX; 409 carries counts and `requiresForce` |
| Delete — impact count accuracy | FAIL | C-02: reports 0 invoices while destroying another tenant's |
| Bulk delete | PARTIAL | M-18: force-deletes with no per-client warning |
| Sorting / pagination / select-all | PASS | |
| KPI accuracy | FAIL | M-01 earnings conflation, L-10 label, L-11 currency mixing |
| Tenant isolation (read) | PASS | 404 on another user's client |

### Invoices

| Feature | Result | Notes |
|---|---|---|
| Create + calculation | PARTIAL | Math correct; L-02 `totalPKR` rounding drift |
| Create — FX conversion | FAIL | C-05: hardcoded 280 for all currencies |
| Create — negative tax / discount | FAIL | C-10 |
| Create — numeric overflow | FAIL | H-11: 500 instead of 400 |
| Invoice number generation | FAIL | H-16: random, non-sequential |
| Invoice prefix from settings | PASS | Verified `ACME-2026-0003` after changing the prefix |
| Auto-create client by name | PASS | |
| Edit (draft) | PASS | Recalculates correctly |
| Paid-invoice edit lock | FAIL | C-03: bypassable via `/status` |
| Status transitions | FAIL | C-03: no validation on `/status` |
| Mark as paid → income | FAIL | C-04: no income created; no toast |
| Delete | PARTIAL | Works for owner; C-01 for non-owner |
| Detail page + error state | PASS | Best error handling in the app |
| Print / PDF export | NOT TESTED | Browser print dialog |
| List / search / filter / sort / pagination / bulk | PASS | |
| Pending metric | PARTIAL | M-14: disagrees with dashboard |
| Tenant isolation (read) | PASS | 404 |
| Tenant isolation (delete) | FAIL | C-01 |

### Income / Expenses

| Feature | Result | Notes |
|---|---|---|
| Create income + FX | PASS | Uses live rate (277.96) correctly |
| PKR income rate = 1 | PASS | |
| Create income — client ownership | FAIL | C-11 |
| Update income + PKR recompute | PASS | Correctly recomputes on amount/currency/rate change |
| Update — empty body | FAIL | H-10: 500 |
| Delete income | PASS | |
| Create expense | PARTIAL | H-09: `paymentMethod` silently dropped |
| Update / delete expense | PARTIAL | H-10 on empty body |
| Expenses error state | PASS | The only list page with a real error state |
| Income error state | FAIL | H-01: swallowed |
| Filters / sorting / pagination / bulk | PASS | |
| Income search | PARTIAL | No search box (other tables have one) |
| Evidence attach / delete | PARTIAL | Works; H-19 public URLs, M-19/M-20 alert + silent delete |

### Dashboard / Reports / Tax / Wealth / Filing

| Feature | Result | Notes |
|---|---|---|
| Dashboard KPIs | FAIL | C-07: lifetime, unscoped, drafts counted as pending |
| Month-over-month growth | FAIL | C-07: partial month vs full month |
| Recent transactions | PASS | |
| Income consolidation card | PARTIAL | Correct data, different period from the KPIs above it |
| Readiness banner | PARTIAL | Correct logic, wrong default year (C-06) |
| Dashboard dead controls | FAIL | M-11 select, M-13 bell, L-13 row menu |
| Reports trend chart | PASS | Tax-year buckets correct |
| Reports KPIs | FAIL | H-08: lifetime while chart is tax-year |
| Reports tax card | FAIL | H-08 fabricated fallback, H-04 hardcoded PSEB |
| Reports date filter | PASS | |
| `/reports/client-breakdown` | FAIL | H-07 unscoped — and unused by the UI |
| `/reports/platform-breakdown` | FAIL | H-07 unscoped — and unused by the UI |
| Tax estimate | FAIL | C-06 wrong default year, H-04 PSEB, H-05 hardcoded slabs |
| Tax simulator | PASS | Correct year, correct s.154A treatment of expenses |
| Tax rules — admin gating | PASS | 403 verified for non-admin |
| Tax rules — auto-seed on GET | FAIL | H-03 |
| Tax rules — admin CRUD UI | PARTIAL | M-08 no invalidation, M-09 no error handling |
| Wealth assets/liabilities CRUD | PARTIAL | Works; H-13 zero feedback |
| Wealth reconciliation | PASS | Math correct and period-scoped |
| Wealth default year | FAIL | C-06 hardcoded `'2026'` |
| Filing readiness (9 checks) | PASS | All 9 checks fire correctly; verified 5/9 = 56% |
| Filing checklist endpoint | NOT TESTED | Dead endpoint — no UI caller |
| Filing package (PDF + CSV zip) | NOT TESTED | Requires a browser download; code reviewed, derives from live API |

### Cross-cutting

| Feature | Result | Notes |
|---|---|---|
| CSV import (file + text) | PARTIAL | H-17 dedupe/date/transaction, H-20 wrong error path & cache keys |
| CSV upload size/MIME limit | FAIL | H-17: enforced only in the browser |
| Evidence upload validation | PASS | MIME + extension + 5 MB at both interceptor and service |
| Toast notifications | FAIL | H-12 — see dedicated section |
| Loading states | PASS | Present on every list and detail page |
| Empty states | PASS | Present, but indistinguishable from errors (H-01) |
| Error states | FAIL | H-01: only `/expenses` and invoice detail have real ones |
| Response envelope consistency | PARTIAL | M-04: `/transactions` double-wraps |
| Tenant isolation (overall) | FAIL | C-01, C-02, C-11 |
| Responsive — desktop | PASS | |
| Responsive — tablet | PASS | `md:` breakpoints applied consistently |
| Responsive — mobile | PASS | Sidebar drawer + backdrop, mobile search toggle, tables wrap in `overflow-auto`, headers/actions stack via `flex-col md:flex-row` |
| Horizontal overflow | PASS | `Table` wraps in `relative w-full overflow-auto`; no page-level x-scroll found |
| Modal overflow on mobile | PASS | `max-h-[92vh] overflow-y-auto` on the tall modals |
| Print stylesheet | PASS | `print:hidden` on sidebar/header/actions; layout has print overrides |
| Dark mode | NOT TESTED | `ThemeProvider` exists but is never mounted — no toggle exists |
| Type-check | PASS | 0 errors across 3 packages |
| Lint | PARTIAL | Exit 0 — but web config has no rules (H-02) |
| Build | PASS | Both apps; 20 static pages |
| Unit tests | PASS | 86/86 across 14 suites |
| E2E tests | NOT TESTED | None exist in the repo |

---

## Recommended Priority Order

1. **Stop the bleeding — tenant isolation and data destruction.** C-01, C-02, C-11, C-08. These can destroy customer data today, silently, through normal use. C-08 additionally means nobody should run `db:seed` against anything real until it is fixed.
2. **Financial correctness.** C-05 (FX), C-10 (negative rates/discounts), C-04 (paid → income), C-03 (invoice lock bypass). These produce wrong numbers on documents users file with FBR.
3. **Tax-year correctness.** C-06 then C-07, H-07, H-08. One shared `getCurrentTaxYear()` in `packages/shared` plus a period parameter on `/dashboard/summary` resolves most of the reporting contradictions at once.
4. **Toast + error visibility.** H-12 and H-01 together. Provider, global mutation `onError`, and removing the swallow-catches — this is one focused change that fixes 21 silent operations and every missing error state.
5. **Security hardening.** C-09 (logout revocation), H-15 (JWT fallbacks), H-14 (helmet), H-19 (blob ACL), M-24 (login throttle), H-11 (leaked DB errors).
6. **Tax engine integrity.** H-03 (GET writes / duplicate rules), H-04 (PSEB from DB), H-05 (slabs into the database). Have a tax professional verify the slab schedule before the next filing season.
7. **API contract hygiene.** H-09, H-10, H-20, M-04, M-05. Small, low-risk fixes that remove whole classes of silent failure.
8. **Restore the safety net.** H-02 — wire up `@freelancerhisab/eslint-config`, drop `--fix` from the API lint script. This should arguably move earlier, since it will surface issues in categories 1–7 automatically.
9. **UX consistency.** H-13, H-16, H-17, M-14 through M-20.
10. **Cleanup.** Dead endpoints, dead hooks, `packages/shared`, unused dependencies, `console.*`, and the remaining Low items.

**Suggested first commit:** items 1 and 2 only. They are independent of each other, individually small, and each has a reproduction in this document to verify against.
