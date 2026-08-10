# FreelancerHisab — End-to-End QA Test Report

**Date:** 2026-08-10
**Tester:** Claude (automated)
**Scope:** Full application — registration through every module, with emphasis on calculation accuracy (tax, income, expenses, wealth, reports).

## Methodology & limitations

No browser-automation tool was available in this session, so testing was done in two layers:

1. **Live black-box API testing** — a brand-new user was registered via `POST /auth/register`, and every backend endpoint (16 controllers, 60+ routes) was exercised with `curl` against the running server (`localhost:3002/api/v1`), including a second user to verify cross-account data isolation. Every calculation (tax, currency conversion, invoice totals, wealth reconciliation, tax slab boundaries) was independently hand-computed and checked against the API's response.
2. **Static code review** — for how the frontend consumes each endpoint (response unwrapping, hardcoded values, field-name matching), since this determines whether a correct backend calculation actually reaches the screen correctly.

**Not covered:** literal browser click-through (visual layout, toast timing, drag/drop, keyboard nav). Anything in that category is called out explicitly below as "needs manual verification."

No fixes were applied as part of this pass. Two items below (`#3`, `#4`) are pre-existing findings from earlier in this session that **were already fixed** before this test run started; they're listed for completeness under a separate section.

---

## Summary

| Severity | Count |
|---|---|
| High | 2 |
| Medium | 3 |
| Low | 3 |
| Unconfirmed / transient | 1 |

---

## New findings

### 1. [HIGH] Reports page and Dashboard's "Income Consolidation" widget always show zero for current data

**Page/feature:** Reports → "Monthly gross income vs operating expenses" chart; Dashboard → "Income Consolidation" card.

**Steps to reproduce:**
1. As any user with income/expenses dated after 2026-06-30 (i.e. any normal usage right now, since today is 2026-08-10), open **Reports**.
2. Observe the "Monthly gross income vs operating expenses, current tax year" chart.
3. Open **Dashboard** and look at the "Income Consolidation" card.

**Expected result:** Both should reflect the user's actual current income/expenses (confirmed via API to be PKR 330,000 income / 38,000 expenses for the test account).

**Actual result:** Both show **PKR 0** for every month / total. Verified directly against the API:
- `GET /reports/income-vs-expenses` → every month `{income:0, expenses:0, profit:0}`.
- `GET /reports/income-consolidation` → `{totalPKR:0, byPlatform:[]}`.

**Root cause:** Both endpoints accept an optional `?year=` query param and default to `DEFAULT_TAX_YEAR` (`apps/api/src/common/tax-year.ts:8`, hardcoded to `2026` → tax year label "2025-26", i.e. 2025-07-01–2026-06-30) when omitted. The frontend never sends a `year`:
- `apps/web/src/hooks/use-reports.ts:13` — `apiClient.get("/reports/income-vs-expenses")`, no param, despite the page copy claiming "current tax year" (`apps/web/src/app/(dashboard)/reports/page.tsx:247`).
- `apps/web/src/app/(dashboard)/dashboard/page.tsx:19` — `useIncomeConsolidation()` called with no `year` argument.

Since today's date is already past the 2025-26 cutoff, any data dated in the actual current tax year (2026-27) is silently excluded, and these two widgets look broken/empty for essentially every real user right now. This is the same root-cause class as two bugs already fixed earlier in this session on the Filing and Wealth pages (see "Previously fixed" section) — those pages have since been updated to compute the real current tax year, but the Reports page and the Dashboard's consolidation widget were not part of that earlier fix and are still broken.

**Severity:** High — a primary reporting page renders as empty/broken for real data, with no way for the user to select a different year to work around it (no year selector exists on this widget/page).

---

### 2. [HIGH] Tax Simulator page hardcodes the comparison year to 2026, and generated Tax Summary PDF always shows blank filer/business info

Two independent High findings, grouped for the same underlying "hardcoded/stale config" pattern:

**2a. Tax Simulator "current" baseline uses the wrong tax year**

**Steps to reproduce:**
1. Open **Tax Simulator**, enter a hypothetical income and submit.
2. Compare the "Current" column against the "Scenario" column.

**Expected result:** "Current" should reflect the actual current tax year's real income/tax (2026-27 as of today).

**Actual result:** `apps/web/src/app/(dashboard)/tax-simulator/page.tsx:35` hardcodes `year: 2026` in the `/tax/simulate` payload. Since `year:2026` resolves to tax-year label "2025-26" (2025-07-01–2026-06-30), the "current" baseline is computed against a tax year that (for any user active today) has no data — so "Current" will show Rs 0 even for users with real, current income. Verified the field is truly hardcoded (not derived from any date/state) by reading the literal source line.

**Severity:** High (same class as the two already-fixed hardcoded-year bugs; this occurrence was missed because it lives in the tax-simulator page, not filing/wealth).

**2b. Filing package's Tax Summary PDF always shows "—" for Filer name / Business name / PSEB / Bank-IBAN, regardless of what's saved in Settings**

**Steps to reproduce:**
1. Fill in Business Name, PSEB ID, Bank Name, and IBAN in **Settings**.
2. Generate a Filing Package (Filing page → "Download Tax Package").
3. Open the Tax Summary PDF.

**Expected result:** "Filer name", "Business name", "PSEB registration", and "Bank / IBAN" should show the values just saved.

**Actual result:** All four fields always render as "—" / "Not registered", even with a fully populated profile. **Reproduced live**: created a test user, set `businessName`, `psebId`, `bankName`, `iban` via `PATCH /users/profile` (confirmed saved via `GET /users/profile`), then simulated the exact unwrap logic used by the filing-package generator — it resolves to `{success:true, data:{...profile}}` instead of the profile object itself, so every field reads as `undefined`.

**Root cause:** `GET /users/profile` and `PATCH /users/profile` (`apps/api/src/modules/users/users.controller.ts:23-26,37-41`) manually wrap their return value in `{success, data}`. The global `TransformInterceptor` (`apps/api/src/common/interceptors/transform.interceptor.ts`) wraps *every* controller response in `{success, data, error}` again — so these two endpoints end up **double-wrapped**: `{success, data:{success, data:{...actual profile}}}`.
Most frontend callers compensate for this (`apps/web/src/hooks/use-profile.ts:16` explicitly checks `resData?.data?.data || resData?.data`), which is why the Settings page itself displays and saves correctly. But `apps/web/src/hooks/use-generate-package.ts`'s local `unwrap()` helper (line 14-16) only strips **one** level (`res.data?.data ?? res.data`), so specifically the filing-package PDF generator gets the wrong object.

**Severity:** High — this is a real deliverable (the tax filing package) silently omitting the filer's identity on every generation, for every user, unconditionally.

---

### 3. [MEDIUM] Marking an invoice "Paid" never sets `paidAt`

**Steps to reproduce:**
1. Create an invoice, then `PATCH /invoices/:id/status` with `{"status":"paid"}` (or use the equivalent UI action).
2. Inspect the returned/stored invoice.

**Expected result:** `paidAt` should be stamped with the time the invoice was marked paid.

**Actual result:** `paidAt` stays `null` forever. `InvoicesService.updateStatus` (`apps/api/src/modules/invoices/invoices.service.ts:161-172`) only updates `status` and `updatedAt`, never `paidAt`.

**Impact today:** Low-visible — nothing in the current frontend reads `paidAt` (confirmed via full-repo search, zero matches in `apps/web/src`), and the "pending invoices" dashboard count and the "orphaned paid invoice" filing check both key off `status`, not `paidAt`, so they're unaffected. This is latent/dead data corruption that will surface the moment any "paid on {date}" display or date-scoped invoice reporting is built.

**Severity:** Medium (real bug, currently invisible to users).

---

### 4. [MEDIUM] Income creation always tags `sbpPurposeCode` with a foreign-remittance code, even for local PKR income

**Steps to reproduce:**
1. Create an income record with `currency: "PKR"` and a local platform (e.g. `"direct"`), with no `sbpPurposeCode` supplied.
2. Inspect the created record.

**Expected result:** A local PKR payment (not a foreign remittance) shouldn't be tagged with an SBP purpose code — those codes exist specifically for State Bank of Pakistan foreign-inflow reporting.

**Actual result:** `sbpPurposeCode` defaults to `'9100'` unconditionally (`apps/api/src/modules/income/income.service.ts:71`: `sbpPurposeCode: dto.sbpPurposeCode || '9100'`), regardless of currency. Verified live: a `PKR`/`"direct"` income entry created with no `sbpPurposeCode` in the payload came back with `sbpPurposeCode: "9100"`.

**Impact:** The Income Report and filing package will show an SBP purpose code against local income that never actually had one, which is factually wrong data on a document meant to support an FBR filing. It also means the "Financial Audit" filing-readiness check (which flags *missing* SBP codes) can never catch this, because a code is always present.

**Severity:** Medium — incorrect data on a compliance-facing document, though it doesn't affect the tax liability calculation itself.

---

### 5. [LOW] Confusing/empty validation error messages

**5a. Invalid invoice status shows an empty list of valid values**

**Steps to reproduce:** `PATCH /invoices/:id/status` with `{"status":"bogus_status"}`.

**Expected:** Error message listing the valid statuses (draft/sent/viewed/paid/overdue/cancelled).

**Actual:** `"status must be one of the following values: "` — nothing after the colon. The request is still correctly rejected (400), only the message is broken. Root cause: `@IsEnum(['draft','sent',...])` in `apps/api/src/modules/invoices/dto/update-invoice-status.dto.ts:82` uses a plain array literal rather than a TS enum object, and class-validator's default message interpolation doesn't render array literals the same way.

**5b. Missing-required-field errors report the wrong constraint**

**Steps to reproduce:** `POST /clients` with `{}` (no `name`), or `POST /expenses` with no `description`.

**Expected:** A clear "name is required" / "description is required" message.

**Actual:** `"name must be shorter than or equal to 255 characters"` / `"description must be shorter than or equal to 500 characters"` — technically true (undefined "satisfies" a length check oddly) but misleading; the real problem (missing value) isn't the message shown first. Affects at least the Clients and Expenses create DTOs.

**Severity:** Low — functionally correct rejection, just a confusing message if a user (or the frontend) surfaces it verbatim.

---

### 6. [LOW] `JWT_EXPIRATION` env var is dead config; access-token lifetime is very short

**Steps to reproduce:** Inspect `apps/api/.env` (`JWT_EXPIRATION=2m`) vs. `apps/api/src/modules/auth/auth.service.ts:105`.

**Actual:** The access-token sign call hardcodes `expiresIn: '2m'` literally, never reading `process.env.JWT_EXPIRATION` — so the env var is decorative and changing it has no effect. Separately, a 2-minute access-token lifetime is unusually aggressive; it's not user-visible (the frontend's `apiClient` silently refreshes on 401), but it does mean a refresh round-trip on almost every burst of activity. Confirmed operationally during this test: multiple test sequences hit `401 Unauthorized` mid-run purely from the token expiring.

**Severity:** Low — no user-facing breakage found (refresh flow works), but worth confirming this lifetime is intentional for production.

---

## Unconfirmed / could not reproduce

### 7. Evidence upload 500 error (reported earlier this session) did not reproduce on retest

Earlier in this session, uploading a file via the Evidence Vault modal failed in the browser with an HTTP 500 ("Failed to upload file"). Retesting the identical endpoint (`POST /evidence/upload`, multipart, valid PNG, against a fresh income record) against the currently-running API instance **succeeded** (`201 Created`, file stored in Vercel Blob at a real `blob.vercel-storage.com` URL, then correctly listed via `GET /evidence/income/:id`). File-type rejection (`.txt`) and oversized-file rejection (>5MB → `413`) both worked correctly too.

This looks like it was a transient issue tied to the duplicate/stale Next.js and Nest processes discovered running on conflicting ports earlier in this session (see below), rather than a reproducible code defect. **Recommendation:** if this recurs, check the API server's console output at the moment of failure — the original diagnosis pointed at a possible `BLOB_READ_WRITE_TOKEN` config issue, but the token is present and does work against the current process.

---

## Previously fixed this session (for context, not new findings)

These were found and fixed earlier in this conversation, before this end-to-end pass began:

1. **Filing and Wealth pages defaulted their "Tax Year" selector to a hardcoded `"2026"`**, with a dropdown that only ever offered 2024/2025/2026 — meaning the actual current tax year (2027, as of today) wasn't even selectable. Fixed via a shared `apps/web/src/lib/tax-year.ts` helper (`getCurrentTaxYear()`, `taxYearOptions()`) now used by both pages. **Finding #1 and #2a above show this same bug pattern still exists on the Reports page, Dashboard, and Tax Simulator, which were not touched by that fix.**
2. **Seed script expense rows had `amountPKR` silently defaulting to `0.00`** (`apps/api/src/database/seed.ts`) because the raw seed insert bypassed the normal expense-creation logic that computes `amountPKR = amount × exchangeRate`. Fixed by adding explicit `exchangeRate`/`amountPKR` values to the seed data. (Any already-seeded accounts with the old zeroed rows still need those specific rows re-saved once via the UI, or the seed re-run, to pick up the fix.)

---

## Verified correct (no issue found)

Confirmed working correctly, with specific test evidence:

- **Tax calculation engine** — export tax (0.25% PSEB / 1% standard), local tax slabs at all four bracket boundaries (600,000 / 1,200,000 / 2,400,000 / 3,600,000, including off-by-one values just above each), PSEB savings, and effective tax rate all hand-verified against the API and matched exactly, including rounding behavior.
- **Currency conversion** on income/expense creation — explicit exchange rates and PKR 1:1 default both compute `amountPKR` correctly.
- **Invoice totals** — subtotal/tax/discount/total/totalPKR are always recomputed server-side from line items; a client attempting to inject a fake `total`/`totalPKR` is silently ignored.
- **Wealth reconciliation tolerance** — the ±Rs 50,000 threshold is correctly inclusive on both boundaries (tested at exactly +50,000/-50,000 and one Rupee past each).
- **Cross-user data isolation** — a second test account could not read, edit, or delete the first account's income records (404 on all three, not a 403 that would leak existence).
- **CSV import** — correctly classifies income vs. expense rows (by sign and by type keyword), skips unparseable rows, and reports accurate counts.
- **Pagination** (`GET /transactions`) — correctly clamps out-of-range page numbers instead of erroring or returning garbage.
- **Auth** — duplicate email, weak password, invalid email format, wrong password, and non-existent-user login all rejected with correct status codes and non-leaking messages.
- **Dashboard month-over-month growth** — correctly returns `null` (not `0%` or `Infinity`) when there's no prior-month data to compare against, and the frontend correctly hides the badge in that case.
- **Filing readiness checklist** — all 4 tested conditions (missing PRC/SBP, orphaned paid invoice, wealth not reconciled, missing evidence) fired accurately against known test data.
- **Admin-gated Tax Rules tab** (Settings) — correctly hidden for non-admin users and backed by a real `AdminGuard` (403 confirmed for a non-admin token attempting to write a rule).

---

## Needs manual browser verification (not covered by this pass)

No browser automation was available, so the following should be spot-checked visually:
- Form field-level validation messages actually rendering in the UI (vs. just being present in the API response).
- Loading states, toasts, and animation/transition behavior across all pages.
- The evidence upload flow specifically in-browser, since finding #7 could not be conclusively ruled out as a UI-only issue (e.g. a stale service worker or cached bundle on the client side).
- Responsive/mobile layout — not assessed at all in this pass.
