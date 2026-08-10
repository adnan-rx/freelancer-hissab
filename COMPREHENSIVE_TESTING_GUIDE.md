# FreelancerHisab — Comprehensive Manual Testing Guide

**Version:** 2.0
**Applies to branch:** `feat/wealth-tax-simulators-evidence-vault`
**Audience:** QA tester / reviewer with no prior knowledge of this codebase
**Estimated time for a full pass:** 4–6 hours

---

## How to use this document

1. Work through the sections **in order**. Section 2 (Setup) and Section 4 (Master Test Data) must be completed first — every later section depends on the data created there.
2. Each test case has a fixed ID (e.g. `CLI-03`). Record results in the Pass/Fail box on the row.
3. **Expected results in this guide describe what the application actually does today**, not what it ideally should do. Where the current behaviour is wrong or incomplete, it is marked:
   - 🐞 **KNOWN BUG** — confirmed defect in the code. The test *passes* if you observe the described faulty behaviour, and should be logged as a defect.
   - ⚠️ **LIMITATION** — works as built, but narrower than the docs/plan imply.
   - 🚧 **NOT IMPLEMENTED** — UI exists but is inert, or feature is planned only.
4. A consolidated list of every 🐞/⚠️/🚧 is in **Appendix A** — use it as the defect backlog.
5. Anything you cannot reproduce, mark **BLOCKED** and note why; do not silently skip.

**Legend:** `[ ] Pass  [ ] Fail  [ ] Blocked`

---

## Table of contents

| # | Section |
|---|---|
| 1 | Scope: what exists vs what is planned |
| 2 | Environment setup and smoke test |
| 3 | Test accounts |
| 4 | Master test data set (create this first) |
| 5 | Landing page |
| 6 | Authentication & session management |
| 7 | Dashboard |
| 8 | Clients |
| 9 | Invoices |
| 10 | Income |
| 11 | CSV import |
| 12 | Expenses |
| 13 | Transactions / Unified ledger |
| 14 | Wealth management |
| 15 | Tax simulator & FBR tax engine |
| 16 | Filing simulator & readiness score |
| 17 | Evidence vault |
| 18 | Reports & exports |
| 19 | Settings |
| 20 | User guide page |
| 21 | Header, notifications & global error handling |
| 22 | Integrations to verify |
| 23 | Security, permissions & data isolation |
| 24 | Performance & bulk data |
| 25 | Cross-browser / responsive / print |
| 26 | Future-plan coverage matrix |
| A | Appendix A — Known bugs, limitations, not-implemented |
| B | Appendix B — API reference for direct testing |
| C | Appendix C — Sign-off sheet |

---

## 1. Scope: what exists vs what is planned

Verified against the codebase on this branch.

### Implemented and testable through the UI

| Area | Route | Backend module |
|---|---|---|
| Landing page | `/` | — |
| Register / Login | `/register`, `/login` | `auth` |
| Dashboard | `/dashboard` | `dashboard`, `filing`, `reports`, `transactions` |
| Clients | `/clients` | `clients` |
| Invoices list / create / detail | `/invoices`, `/invoices/new`, `/invoices/[id]` | `invoices` |
| Transactions (unified ledger) | `/transactions` | `transactions` |
| Income | `/income` | `income`, `csv` |
| Expenses | `/expenses` | `expenses` |
| Reports | `/reports` | `reports`, `tax` |
| Wealth management | `/wealth` | `wealth` |
| Tax simulator | `/tax-simulator` | `tax` |
| Filing simulator | `/filing` | `filing`, `wealth` |
| User guide | `/guide` | — |
| Settings | `/settings` | `users` |
| Evidence vault | modal on `/income` and `/expenses` | `evidence` |
| Exchange rate | used by invoice form | `exchange-rate` |

### Planned but NOT built (from `future-plan/`)

| Plan doc | Feature | Status in code |
|---|---|---|
| 17 | Tax Rules Engine — admin CRUD for rates | Partial: `tax_rules` table exists and is auto-seeded, but **no** `GET/POST /tax/rules` endpoint and no admin UI |
| 21 | Financial Audit — `GET /filing/audit` | Not built. Some checks folded into `/filing/readiness` instead |
| 22 | Filing Package Generator — server-side `GET /filing/package` returning a zip of PDFs | Not built. Replaced by a **client-side** zip (screenshot PDF + 2 CSVs) |
| 23 | Filing Checklist UI (staged view) | API `GET /filing/checklist` exists; **no page consumes it** |
| 20 | Evidence coverage indicators / "which records lack documents" | Not built |
| — | Invoice email delivery, tax deadline reminders, AI receipt OCR, bank webhooks | Not built (P2/P3 in `PROJECT_STATUS.md`) |
| — | Forgot password, password change | Not built (see `SET-06`) |

Section 26 maps every future-plan item to its test case or to "not testable".

---

## 2. Environment setup and smoke test

### 2.1 Prerequisites

- Node.js ≥ 18, npm 11
- A reachable PostgreSQL database
- `apps/api/.env` present with at minimum:
  - `DATABASE_URL`
  - `JWT_SECRET`, `JWT_REFRESH_SECRET`
  - `BLOB_READ_WRITE_TOKEN` (required for Evidence Vault — Section 17)
  - `CORS_ORIGIN=http://localhost:3000`
- `apps/web/.env.local` present with:
  - `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`

> ⚠️ **Do not run `npm run db:seed`** if you have test data you want to keep. The seed script deletes all income, invoices, expenses and clients for **every** user in the database, and deletes **all** `invoice_items` rows unconditionally.

### 2.2 Start the stack

```bash
# from the repo root
npm install

# terminal 1 — API
cd apps/api
npm run db:migrate
npm run dev          # -> http://localhost:3001/api/v1

# terminal 2 — web
cd apps/web
npm run dev          # -> http://localhost:3000
```

### 2.3 Setup smoke test

| ID | Step | Expected result | Result |
|---|---|---|---|
| ENV-01 | Open `http://localhost:3000` | Landing page renders, no console errors | `[ ] Pass [ ] Fail` |
| ENV-02 | Open `http://localhost:3001/api/v1` | JSON or 404 from Nest (server is up) | `[ ] Pass [ ] Fail` |
| ENV-03 | Open `http://localhost:3001/api/docs` | Swagger UI loads and lists auth, clients, invoices, income, expenses, wealth, tax, filing, evidence endpoints | `[ ] Pass [ ] Fail` |
| ENV-04 | `curl http://localhost:3001/api/v1/exchange-rate` | `{"success":true,"data":{"base":"PKR","rates":{...}}}` | `[ ] Pass [ ] Fail` |
| ENV-05 | Stop the API, reload `http://localhost:3000/dashboard` after logging in | App still renders; data areas show empty/zero states rather than crashing (see Section 21) | `[ ] Pass [ ] Fail` |

---

## 3. Test accounts

Create these two accounts in `AUTH-01`. Account B exists purely to prove data isolation (Section 23).

| | Account A (primary) | Account B (isolation) |
|---|---|---|
| Full name | `Adnan Niaz` | `Sara Khan` |
| Business name | `Apex Tech Solutions` | `SK Studio` |
| Email | `qa.primary@hisabtest.pk` | `qa.second@hisabtest.pk` |
| Password | `TestPass123!` | `TestPass123!` |

**Profile values for Account A** (entered in Settings, Section 19):

| Field | Value |
|---|---|
| Phone | `+92 300 1234567` |
| Bank name | `Meezan Bank Limited` |
| Account title | `Adnan Niaz` |
| IBAN | `PK36MEZN0001020304050607` |
| PSEB registration number | `PSEB-2026-98765` |
| Invoice prefix | `QA-2026-` |
| Payment terms | `Due on Receipt` |
| Invoice footer | `Wire foreign remittance to Meezan Bank IBAN under SBP Purpose Code 9100.` |

---

## 4. Master test data set — create this first

All expected totals in Sections 7–18 are computed from exactly this data. Create it in the order given, on **Account A**, and do not add anything else until Section 18 is done.

> **Important:** on the invoice form the exchange rate auto-fills from a live API. **Manually overwrite it with `280.00`** on every invoice so the PKR figures below are reproducible.

### 4.1 Clients (Section 8)

| Ref | Contact name | Company | Email | Phone | Platform | Currency |
|---|---|---|---|---|---|---|
| C1 | `TechFlow Labs` | `TechFlow Labs LLC` | `billing@techflow.example` | `+1 415 555 0199` | Upwork Escrow | USD |
| C2 | `Horizon Media` | `Horizon Media Pvt` | `accounts@horizonmedia.example` | `+44 20 7946 0102` | Direct Client (Bank / Wise) | USD |
| C3 | `Lahore Digital` | `Lahore Digital (Pvt) Ltd` | `finance@lahoredigital.example` | `+92 42 3577 1234` | Other Platform | PKR |

### 4.2 Invoices (Section 9)

| Ref | Client | Invoice # | Due date | Currency | Rate | Line item | Qty | Rate | Tax % | Discount | Total | Total PKR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| INV-A | C1 | `QA-2026-0001` | `2026-08-31` | USD | 280.00 | `Sprint 1 – Fullstack Engineering` | 40 | 50 | 0 | 0 | $2,000.00 | Rs 560,000 |
| INV-B | C2 | `QA-2026-0002` | `2026-09-15` | USD | 280.00 | `UI/UX Redesign – Phase 1` | 1 | 1200 | 5 | 100 | $1,160.00 | Rs 324,800 |
| INV-C | C3 | `QA-2026-0003` | `2026-09-01` | PKR | 1.00 | `Monthly retainer – August` | 1 | 150000 | 0 | 0 | PKR 150,000.00 | Rs 150,000 |

### 4.3 Income (Section 10)

| Ref | Date | Platform | Description | Client | Amount | Currency | SBP code | PRC ref |
|---|---|---|---|---|---|---|---|---|
| INC-1 | `2026-08-01` | Upwork Escrow | `Sprint 1 milestone – TechFlow Labs` | C1 | 2000 | USD | 9100 | `PRC-2026-0001` |
| INC-2 | `2026-08-05` | Direct Bank Transfer / Wise | `UI/UX redesign – Horizon Media` | C2 | 1160 | USD | 9100 | *(leave blank)* |

Baseline income in PKR: **884,800** (2000 × 280 + 1160 × 280).

> INC-2 is deliberately left without a PRC reference so that the filing readiness check in Section 16 has something to flag.

### 4.4 Expenses (Section 12)

| Ref | Date | Category | Description | Vendor | Amount | Currency |
|---|---|---|---|---|---|---|
| EXP-1 | `2026-08-02` | Internet & Fiber Broadband | `Nayatel Fiber – August` | `Nayatel` | 4500 | PKR |
| EXP-2 | `2026-08-04` | Software & Subscriptions | `GitHub Team subscription` | `GitHub` | 11200 | PKR |
| EXP-3 | `2026-08-06` | Co-working & Office Rent | `Co-working desk – August` | `Kickstart` | 15000 | PKR |

Baseline expenses: **Rs 30,700**.

### 4.5 Wealth, tax year 2026 (Section 14)

| Item | Type | Value |
|---|---|---|
| Opening wealth | — | `500000` |
| `Meezan Bank current account` | CASH | `1200000` |
| `Suzuki Alto 2021 (LEB-21-4477)` | VEHICLE | `2400000` |
| `Bank Alfalah car loan` | Liability | `900000` |

### 4.6 Derived baseline figures (reference table)

Once 4.1–4.5 are entered, these are the numbers every screen should agree on:

| Figure | Value | Where it appears |
|---|---|---|
| Total income | Rs 884,800 | Dashboard, Reports, Wealth reconciliation |
| Total expenses | Rs 30,700 | Dashboard, Reports, Wealth reconciliation |
| Net profit | Rs 854,100 | Dashboard, Reports |
| Pending invoices (count) | 3 | Dashboard |
| Pending invoice value | Rs 1,034,800 | Invoices page ("Outstanding Balance") |
| Total invoiced | Rs 1,034,800 | Invoices page |
| Export income (tax engine) | Rs 884,800 | Tax estimate |
| Local income (tax engine) | Rs 0 | Tax estimate |
| Tax @ 0.25% (PSEB on) | Rs 2,212 | Reports, Tax simulator |
| Tax @ 1% (PSEB off) | Rs 8,848 | Tax simulator |
| PSEB saving | Rs 6,636 | Tax estimate API |
| Declared assets | Rs 3,600,000 | Wealth |
| Declared liabilities | Rs 900,000 | Wealth |
| Net declared wealth | Rs 2,700,000 | Wealth |
| Expected closing wealth | Rs 1,354,100 | Wealth |
| Reconciliation difference | Rs +1,345,900 (NOT reconciled) | Wealth, Filing |

---

## 5. Landing page

**Route:** `/`

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| LAND-01 | Anonymous view | Open `/` in a private window | Header shows **Sign In** and **Get Started**. Hero, 6 feature cards (Multi-Currency Income, Instant Invoicing Builder, FBR Tax Simulator, Wealth Reconciliation, Financial Reports & Charts, Client Management), 3 perks, footer | `[ ] Pass [ ] Fail` |
| LAND-02 | Nav links | Click **Sign In**, then back, then **Get Started** | Routes to `/login` and `/register` | `[ ] Pass [ ] Fail` |
| LAND-03 | Authenticated view | Log in, then open `/` | Header and hero both show **Go to Dashboard** instead of Sign In / Get Started | `[ ] Pass [ ] Fail` |
| LAND-04 | "Demo Login" button | Anonymous, click **Demo Login** | Goes to `/login`. ⚠️ **LIMITATION:** it does not pre-fill or auto-log-in any demo account despite the label | `[ ] Pass [ ] Fail` |
| LAND-05 | Responsive | Resize to 375 px wide | Buttons stack vertically, grid collapses to one column, no horizontal scrollbar | `[ ] Pass [ ] Fail` |

---

## 6. Authentication & session management

**Routes:** `/register`, `/login`
**API:** `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`

Key mechanics verified in code, needed to interpret results:
- Access token lifetime is **2 minutes**; refresh token is 7 days and lives in an `httpOnly` cookie named `refreshToken`.
- The axios client auto-refreshes on any 401 and retries the request; on refresh failure it logs out and hard-redirects to `/login`.
- Auth state (`accessToken`, `user`) is persisted in `localStorage` under key `auth-storage`.
- Password rule enforced by the API: minimum **6 characters**. No complexity rule.
- Global rate limit: **100 requests per 60 seconds** per client, across all endpoints.

### 6.1 Registration

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| AUTH-01 | Happy path — create Account A and Account B | `/register` → enter name, business name, email, password from Section 3 → **Create Account** | Redirects to `/dashboard`. Sidebar footer shows the name and email. `localStorage.auth-storage` contains `accessToken` and `user`. A `refreshToken` cookie exists (Application → Cookies) | `[ ] Pass [ ] Fail` |
| AUTH-02 | Required fields | Submit with Full Name blank | Browser-native "please fill out this field" on Name; no network request sent | `[ ] Pass [ ] Fail` |
| AUTH-03 | Invalid email format | `not-an-email` + valid password | Browser email validation blocks submit. If bypassed via API: `400` with message `email must be an email` | `[ ] Pass [ ] Fail` |
| AUTH-04 | Short password | Email `qa.short@hisabtest.pk`, password `12345` | Red error banner: `password must be longer than or equal to 6 characters` | `[ ] Pass [ ] Fail` |
| AUTH-05 | Weak but long password | Password `aaaaaa` | ⚠️ **LIMITATION:** account is created. There is no complexity requirement | `[ ] Pass [ ] Fail` |
| AUTH-06 | Duplicate email | Register `qa.primary@hisabtest.pk` again | Red banner: `Email address is already registered` (HTTP 409). No second account created | `[ ] Pass [ ] Fail` |
| AUTH-07 | Business name optional | Register `qa.nobiz@hisabtest.pk` leaving Business Name blank | Succeeds; dashboard loads | `[ ] Pass [ ] Fail` |
| AUTH-08 | Whitespace-only name | Name = three spaces | ⚠️ Accepted by the API (`IsNotEmpty` passes on `"   "`). Sidebar initials render blank/odd. Log as minor defect | `[ ] Pass [ ] Fail` |
| AUTH-09 | 500-character business name | Paste 500 chars into Business Name | Expect `500` from the database (column is 255 chars) surfaced as an error banner. 🐞 **KNOWN BUG:** no length validation on the DTO or the input | `[ ] Pass [ ] Fail` |

### 6.2 Login

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| AUTH-10 | Happy path | `/login` with Account A credentials | Button shows "Signing in…", then redirect to `/dashboard` | `[ ] Pass [ ] Fail` |
| AUTH-11 | Wrong password | Correct email, password `WrongPass123!` | Banner: `Invalid email or password` (HTTP 401). Stays on `/login` | `[ ] Pass [ ] Fail` |
| AUTH-12 | Unknown email | `nobody@hisabtest.pk` | Same generic message `Invalid email or password` — must **not** reveal whether the account exists | `[ ] Pass [ ] Fail` |
| AUTH-13 | Case sensitivity of email | Log in with `QA.PRIMARY@hisabtest.pk` | ⚠️ Expect failure — emails are stored and compared exactly as entered. Log as usability defect | `[ ] Pass [ ] Fail` |
| AUTH-14 | Forgot password link | Click **Forgot password?** | 🚧 **NOT IMPLEMENTED** — the link is `href="#"` and does nothing | `[ ] Pass [ ] Fail` |
| AUTH-15 | Rate limiting | Run `for i in $(seq 1 120); do curl -s -o /dev/null -w "%{http_code} " -X POST http://localhost:3001/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"bad"}'; done` | First ~100 return `401`, the remainder return `429` | `[ ] Pass [ ] Fail` |

### 6.3 Session, refresh and logout

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| AUTH-16 | Route guard | Log out, then navigate directly to `/dashboard`, `/invoices`, `/wealth`, `/settings` | Each redirects to `/login` | `[ ] Pass [ ] Fail` |
| AUTH-17 | No flash of content | Hard-refresh `/dashboard` while logged in | Brief blank frame while the store rehydrates, then the dashboard. You must **not** see a redirect to `/login` and back | `[ ] Pass [ ] Fail` |
| AUTH-18 | Silent token refresh | Log in, wait **3 minutes** without interacting, then click **Clients** | Page loads normally. In Network you see one `401`, a `POST /auth/refresh` returning 200, and the original request retried successfully | `[ ] Pass [ ] Fail` |
| AUTH-19 | Refresh token rotation | Perform AUTH-18 twice | Each refresh issues a new token and revokes the previous one; both cycles succeed | `[ ] Pass [ ] Fail` |
| AUTH-20 | Refresh token reuse detection | Copy the `refreshToken` cookie value, trigger a refresh (AUTH-18), then replay the **old** value: `curl -i -X POST http://localhost:3001/api/v1/auth/refresh --cookie "refreshToken=<old value>"` | `401`. All of that user's refresh tokens are revoked — the browser session is logged out on its next refresh attempt | `[ ] Pass [ ] Fail` |
| AUTH-21 | Corrupted token | In DevTools set `localStorage.auth-storage` accessToken to `garbage`, reload `/dashboard` | The 401→refresh path recovers the session; if refresh also fails you are redirected to `/login` | `[ ] Pass [ ] Fail` |
| AUTH-22 | Logout | Click the logout icon in the sidebar footer | Redirects to `/login`; `localStorage.auth-storage` no longer contains a token; `/dashboard` is no longer reachable | `[ ] Pass [ ] Fail` |
| AUTH-23 | Logout does not clear the cookie | After AUTH-22, check Application → Cookies | 🐞 **KNOWN BUG:** the sidebar logout is client-side only — it never calls `POST /auth/logout`, so the `refreshToken` cookie and its database row survive | `[ ] Pass [ ] Fail` |
| AUTH-24 | Unauthenticated API call | `curl -i http://localhost:3001/api/v1/clients` | `401 Unauthorized` with the `{"success":false,"error":{...}}` envelope | `[ ] Pass [ ] Fail` |
| AUTH-25 | Deleted-user token | Not applicable unless you can delete a user directly in the DB. If you can: delete the row and retry a request with its token | `401 User no longer exists` | `[ ] Pass [ ] Fail` |

---

## 7. Dashboard

**Route:** `/dashboard`
**API:** `GET /dashboard/summary`, `GET /transactions`, `GET /invoices`, `GET /reports/income-consolidation`, `GET /filing/readiness`

> Run this section **twice**: once on a brand-new account (empty state, `DASH-01`), and once after the master data set exists (`DASH-02` onward).

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| DASH-01 | Empty state | Log in as a freshly registered account with no data | All four KPI cards show `Rs 0` (Pending Invoices shows `0 total`). Transactions table: "No recent transactions found." Income Consolidation shows `Rs 0`, Tracked 0%, Unmatched 0%. Readiness banner shows a score with issues listed | `[ ] Pass [ ] Fail` |
| DASH-02 | KPI accuracy | Account A with master data | Total Income `Rs 884,800`; Total Expenses `Rs 30,700`; Net Profit `Rs 854,100`; Pending Invoices `3 total` | `[ ] Pass [ ] Fail` |
| DASH-03 | Growth badges | Inspect the "+12.5%" and "-3.2%" chips | 🐞 **KNOWN BUG:** both are hardcoded in the page and never change. `monthlyGrowth: 12.5` is also hardcoded in `DashboardService` | `[ ] Pass [ ] Fail` |
| DASH-04 | Recent transactions | Look at the Transactions card | Shows the 5 most recent ledger rows (date-descending), income prefixed `+`, expenses prefixed `-`, entity avatar = first two letters of client/vendor | `[ ] Pass [ ] Fail` |
| DASH-05 | Transactions period selector | Change the dropdown from **Monthly** to **Weekly** | 🚧 **NOT IMPLEMENTED:** the select has no handler; nothing changes | `[ ] Pass [ ] Fail` |
| DASH-06 | Row action | Hover a transaction row and click the `…` button | Navigates to `/transactions` | `[ ] Pass [ ] Fail` |
| DASH-07 | Quick actions | Click each of **Create New Invoice**, **Log an Expense**, **Add New Client** | Routes to `/invoices/new`, `/expenses`, `/clients` respectively | `[ ] Pass [ ] Fail` |
| DASH-08 | New Payment button | Click **New Payment** (top right) | Routes to `/invoices/new`. ⚠️ Label is misleading — it creates an invoice, not a payment | `[ ] Pass [ ] Fail` |
| DASH-09 | Income consolidation card | With master data | Total `Rs 884,800`; Tracked `100%`; Unmatched `0%`; two platform bars: `upwork` 63.3%, `direct` 36.7% | `[ ] Pass [ ] Fail` |
| DASH-10 | Readiness banner | With master data and PSEB ID saved in Settings | Amber banner, score **71%**, text "You have 2 issues remaining…", button **Fix Issues** → `/filing`. (Derivation in Section 16) | `[ ] Pass [ ] Fail` |
| DASH-11 | Readiness banner — ready variant | Not achievable with current code (see `FIL-08`) | ⚠️ The green/100% variant cannot be reached because the exchange-rate check always fails for income logged through the UI | `[ ] Pass [ ] Fail` |
| DASH-12 | Large-value formatting | Temporarily add an income of `9,999,999` USD (delete it afterwards) | Amount renders as `Rs 2,799,999,720` with thousands separators and no layout overflow | `[ ] Pass [ ] Fail` |
| DASH-13 | API failure resilience | Stop the API, reload `/dashboard` | KPIs fall back to `Rs 0`, tables show empty states, no white screen and no unhandled exception in console. ⚠️ There is **no** error banner telling the user the data failed to load | `[ ] Pass [ ] Fail` |
| DASH-14 | Responsive | 375 px width | KPI cards stack to one column; transaction table scrolls horizontally inside its container; sidebar collapses behind the hamburger | `[ ] Pass [ ] Fail` |

---

## 8. Clients

**Route:** `/clients`
**API:** `GET/POST /clients`, `PATCH /clients/:id`, `DELETE /clients/:id`

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| CLI-01 | Empty state | Fresh account | Table shows "No clients found matching your search."; KPI cards show 0 / $0.00 / Rs 0 | `[ ] Pass [ ] Fail` |
| CLI-02 | Create C1, C2, C3 | **Add New Client** → fill Section 4.1 → **Save Client** | Modal closes, all three rows appear immediately, "Active Clients" reads `3`, each row's Status badge reads `active` | `[ ] Pass [ ] Fail` |
| CLI-03 | Required field | Open the modal, leave Client Contact Name blank, submit | Native validation blocks submit | `[ ] Pass [ ] Fail` |
| CLI-04 | Invalid email | Name `Bad Email Co`, email `not-an-email` | Native email validation blocks. If bypassed via API: `400 email must be an email` | `[ ] Pass [ ] Fail` |
| CLI-05 | Empty email accepted | Create `No Email Client` with email blank | Saves. Row shows `No email` | `[ ] Pass [ ] Fail` |
| CLI-06 | Duplicate email | Create a second client with `billing@techflow.example` | ⚠️ **LIMITATION:** succeeds — there is no unique constraint on client email. (Contradicts earlier documentation.) Delete the duplicate afterwards | `[ ] Pass [ ] Fail` |
| CLI-07 | Duplicate name | Create a second client named exactly `TechFlow Labs` | Succeeds. ⚠️ Note the side effect: `POST /invoices` matches clients by **name**, so an invoice created without an explicit client selection will bind to whichever duplicate is found first. Delete the duplicate afterwards | `[ ] Pass [ ] Fail` |
| CLI-08 | Edit | Click the pencil on C2, change Company to `Horizon Media Group`, **Update Client** | Row updates immediately without reload | `[ ] Pass [ ] Fail` |
| CLI-09 | Search — name | Type `tech` in the search box | Only TechFlow Labs is listed. (Search is applied both server-side on name and client-side on name/email/company) | `[ ] Pass [ ] Fail` |
| CLI-10 | Search — email/company | Type `horizonmedia` | ⚠️ Expect **no rows**: the server filters on name only and returns nothing, so the client-side email/company match never gets a chance to run. Log as defect | `[ ] Pass [ ] Fail` |
| CLI-11 | Search — no match | Type `zzzzzz` | "No clients found matching your search." | `[ ] Pass [ ] Fail` |
| CLI-12 | Platform tabs | Click each of `all / upwork / fiverr / direct / freelancer` | Filters correctly. ⚠️ There is **no tab for `other`**, so C3 (Lahore Digital) is only visible under `all` | `[ ] Pass [ ] Fail` |
| CLI-13 | Lifetime revenue KPIs | With master data and invoices created | "Lifetime Revenue (USD)" sums each client's income/invoice totals in their **original currency** — C3's PKR 150,000 is added to USD figures, giving `$153,160.00`. 🐞 **KNOWN BUG:** mixed-currency summation | `[ ] Pass [ ] Fail` |
| CLI-14 | Per-row totals | Check the "Total Billed" column | Shows the client's income total when income exists, otherwise the invoice total; PKR line beneath | `[ ] Pass [ ] Fail` |
| CLI-15 | Create invoice from row | Click the file+ icon on C1 | Navigates to `/invoices/new?client=<id>`. 🐞 **KNOWN BUG:** the new-invoice page ignores the `client` query parameter — the Select Client dropdown is still empty and the form shows the hardcoded `TechFlow Inc.` default | `[ ] Pass [ ] Fail` |
| CLI-16 | Delete — confirmation | Click the trash icon on the throwaway client from CLI-06 | Modal "Delete Client Profile?" with the client's name and a **Delete Client** button | `[ ] Pass [ ] Fail` |
| CLI-17 | Delete — cancel | Click Cancel / outside | Modal closes; client still present | `[ ] Pass [ ] Fail` |
| CLI-18 | Delete — confirm | Confirm the deletion | Row disappears; count decrements | `[ ] Pass [ ] Fail` |
| CLI-19 | Delete cascade ⚠️ **destructive** | Create a throwaway client, create an invoice for it, log income against it, then delete the client | The **invoice is deleted too** (FK cascade), while the income row survives with its client set to null and shows as `Direct` in the ledger. There is **no warning** in the confirm dialog about the invoice deletion. Log as a high-severity defect. Do **not** run this on C1/C2/C3 | `[ ] Pass [ ] Fail` |
| CLI-20 | Status editing | Look for an Active/Archived control in the Add/Edit modal | 🚧 **NOT IMPLEMENTED:** the API supports `status: active|archived` but the UI has no control; every client displays `active` | `[ ] Pass [ ] Fail` |
| CLI-21 | Long values | Create a client with a 300-character company name | Expect a database error (255-char column) shown as a red toast titled `Client Save Failed (500)`. 🐞 No max-length validation | `[ ] Pass [ ] Fail` |
| CLI-22 | Unicode / RTL | Create client `احمد علی ٹریڈرز` with company `شرکت` | Saves and renders correctly in the table without breaking alignment | `[ ] Pass [ ] Fail` |
| CLI-23 | Error toast | Stop the API, try to save a client | Red toast `Client Save Failed (400)` / network message; the modal stays open so input is not lost | `[ ] Pass [ ] Fail` |

---

## 9. Invoices

**Routes:** `/invoices`, `/invoices/new`, `/invoices/[id]`
**API:** `GET /invoices`, `GET /invoices/:id`, `POST /invoices`, `PATCH /invoices/:id/status`, `DELETE /invoices/:id`

Mechanics to know:
- Newly created invoices are always saved with status **`sent`**, regardless of what the form sends.
- `invoice_number` is unique **per user**; a duplicate causes a database error.
- The client is resolved by `clientId` if a valid 36-character id is supplied, otherwise **by client name** — creating a new client if the name is unknown.

### 9.1 Creating invoices

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| INV-01 | Prefilled defaults | Open `/invoices/new` | Client Name `TechFlow Inc.`, email `billing@techflow.com`, an auto invoice number `FH-2026-####`, due date = today + 14 days, currency USD, exchange rate auto-fetched, one line item `Full Stack Web Development & API Integration` @ 1 × 1000, and a notes block containing a hardcoded Meezan IBAN. ⚠️ These are demo defaults, not user data | `[ ] Pass [ ] Fail` |
| INV-02 | Live exchange rate | Watch the rate field on load, then switch currency USD → EUR → GBP → PKR | Label shows "Fetching live rate…" then "Live Market Rate"; the value updates per currency; PKR gives `1` | `[ ] Pass [ ] Fail` |
| INV-03 | Create INV-A | Select client `TechFlow Labs`, set number `QA-2026-0001`, due `2026-08-31`, currency USD, **overwrite rate with 280.00**, replace the line item with `Sprint 1 – Fullstack Engineering` qty 40 rate 50 → **Save & Generate Invoice** | Redirects to `/invoices`. New row: total `$2,000.00`, PKR `Rs 560,000`, status **sent** | `[ ] Pass [ ] Fail` |
| INV-04 | Live totals | While editing, watch the summary box | Subtotal, Tax (%), Discount, Total Billed and Total PKR Conversion all recalculate on every keystroke | `[ ] Pass [ ] Fail` |
| INV-05 | Create INV-B with tax + discount | Per Section 4.2 (tax 5%, discount 100) | Subtotal `$1,200.00`, total `$1,160.00`, PKR `Rs 324,800` | `[ ] Pass [ ] Fail` |
| INV-06 | Create INV-C in PKR | Per Section 4.2, currency PKR, rate 1 | Total shows `PKR 150000.00`, PKR conversion `Rs 150,000` | `[ ] Pass [ ] Fail` |
| INV-07 | Multiple line items | Add 3 rows: `Discovery workshop` 1×500, `API build` 20×45, `Handover docs` 1×150 | Subtotal `$1,550.00`; each row shows its own amount | `[ ] Pass [ ] Fail` |
| INV-08 | Remove line item | Click the trash on a row | Row removed and totals recalculate. With only one row left the trash button is disabled — you can never submit zero items | `[ ] Pass [ ] Fail` |
| INV-09 | Item description required | Blank the description of a row and submit | Native validation blocks submit | `[ ] Pass [ ] Fail` |
| INV-10 | Zero-value invoice | One item, qty 1, rate 0 | ⚠️ Saves with total `$0.00`. There is no minimum-total validation | `[ ] Pass [ ] Fail` |
| INV-11 | Negative rate | Set rate `-500` | ⚠️ The `min="0"` attribute does not block typed values; a negative total is saved. Log as defect | `[ ] Pass [ ] Fail` |
| INV-12 | Discount larger than subtotal | Subtotal 100, discount 500 | ⚠️ Total becomes `-$400.00` and saves | `[ ] Pass [ ] Fail` |
| INV-13 | Duplicate invoice number | Create another invoice with number `QA-2026-0001` | Red toast `Validation Error (500)` from the unique index. 🐞 The error text is a raw database message, not a friendly one | `[ ] Pass [ ] Fail` |
| INV-14 | Unknown client name | Clear the client selection, type client name `Brand New Client Ltd`, save | Invoice is created **and a new client is auto-created** with platform `direct`. Verify on `/clients` | `[ ] Pass [ ] Fail` |
| INV-15 | Very long description | 1,000-character item description | Expect a 500 (column limit) or a broken layout. Record which | `[ ] Pass [ ] Fail` |
| INV-16 | Large amounts | qty 1, rate `99999999` | Totals format with separators; PKR value does not overflow the card | `[ ] Pass [ ] Fail` |
| INV-17 | Past due date | Due date `2020-01-01` | ⚠️ Accepted with no warning. Note that status does **not** auto-change to `overdue` — nothing in the codebase ever sets that status | `[ ] Pass [ ] Fail` |
| INV-18 | Cancel | Click **Cancel** | Returns to `/invoices` with nothing saved | `[ ] Pass [ ] Fail` |
| INV-19 | Settings prefix ignored | Set Invoice Prefix to `QA-2026-` in Settings, then open `/invoices/new` | 🐞 **KNOWN BUG:** the form still generates `FH-<year>-####` and the backend fallback also hardcodes `FH-2026-####`. The saved Settings prefix is never used | `[ ] Pass [ ] Fail` |

### 9.2 Invoice list

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| INV-20 | Metrics banner | With INV-A/B/C created | Total Invoiced `Rs 1,034,800`; Collected `Rs 0`; Outstanding `Rs 1,034,800` | `[ ] Pass [ ] Fail` |
| INV-21 | Status tabs | Click `all / draft / sent / paid / overdue` | `sent` shows all three; `draft`, `paid` and `overdue` show "No invoices match your filter criteria." | `[ ] Pass [ ] Fail` |
| INV-22 | Search by number | Type `0002` | Only INV-B listed | `[ ] Pass [ ] Fail` |
| INV-23 | Search by client | Type `Horizon` | ⚠️ Expect **no results** — the server filters on invoice number only. Log as defect | `[ ] Pass [ ] Fail` |
| INV-24 | Currency display | Compare INV-A and INV-C rows | USD rows format as `$2,000.00`; the PKR row renders as raw `PKR 150000.00` (unformatted). Minor defect | `[ ] Pass [ ] Fail` |
| INV-25 | Missing due date | Create an invoice via Swagger without `dueDate`, then view the list | 🐞 The list falls back to a hardcoded literal `2026-08-30` rather than showing a blank | `[ ] Pass [ ] Fail` |

### 9.3 Invoice detail, status and PDF

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| INV-26 | Open detail | Click INV-A's number | Full printable invoice: your name/business/email from the auth store, client block, SBP exchange-rate line, line items, totals, PKR conversion, SBP remittance note | `[ ] Pass [ ] Fail` |
| INV-27 | Header identity | Confirm the "from" block | Uses the logged-in user's name, business name and email. ⚠️ The address line `Lahore, Punjab, Pakistan 54000` and the footer `Meezan Bank IBAN: PK36MEZN…` are **hardcoded** and ignore your Settings values | `[ ] Pass [ ] Fail` |
| INV-28 | Mark as paid | Click **Mark as Paid** | Badge switches to `paid`, the payment box shows "PAID IN FULL", and the button disappears. Return to `/invoices`: Collected `Rs 560,000`, Outstanding `Rs 474,800` | `[ ] Pass [ ] Fail` |
| INV-29 | Paid does NOT create income | After INV-28, open `/income` | ⚠️ **LIMITATION:** no income record is created. Marking an invoice paid and logging income are entirely separate actions. (Contradicts earlier documentation.) This is what triggers `ORPHANED_PAID_INVOICE` in Section 16 | `[ ] Pass [ ] Fail` |
| INV-30 | Status persists | Reload the detail page | Still `paid` | `[ ] Pass [ ] Fail` |
| INV-31 | Optimistic status on failure | Stop the API, click **Mark as Paid** on INV-B | 🐞 **KNOWN BUG:** the badge flips to `paid` in the UI even though the request failed (error is only logged to console). Reload to confirm it was never saved. Restart the API afterwards | `[ ] Pass [ ] Fail` |
| INV-32 | Export PDF | Click **Export PDF / Print** | Browser print dialog opens; the print preview hides the sidebar, header and all buttons and shows only the invoice on white; the suggested filename is the invoice number | `[ ] Pass [ ] Fail` |
| INV-33 | PDF with Unicode | Create an invoice for the Urdu client from CLI-22 and print it | Urdu characters render correctly in the preview | `[ ] Pass [ ] Fail` |
| INV-34 | Fabricated line item | Via Swagger create an invoice with `"items": []`, then open its detail page | 🐞 **KNOWN BUG:** the page invents a fake line item `Full Stack Web Application Development & API Integration` for the invoice total instead of showing an empty table | `[ ] Pass [ ] Fail` |
| INV-35 | Invalid invoice id | Open `/invoices/00000000-0000-0000-0000-000000000000` | 🐞 **KNOWN BUG:** instead of a 404 the page renders a **placeholder invoice** built entirely from fallback values ($1,000 line item, today's date). Log as high-severity | `[ ] Pass [ ] Fail` |
| INV-36 | Another user's invoice | Log in as Account B and open Account A's invoice URL | Same placeholder as INV-35 (the API correctly returns 404; the UI hides it). No Account A data leaks | `[ ] Pass [ ] Fail` |
| INV-37 | Delete invoice | Look for a delete control | 🚧 **NOT IMPLEMENTED** in the UI. Verify via API: `curl -X DELETE http://localhost:3001/api/v1/invoices/<id> -H "Authorization: Bearer <token>"` → `200`, invoice and its items removed | `[ ] Pass [ ] Fail` |

---

## 10. Income

**Route:** `/income`
**API:** `GET /income`, `POST /income`, `DELETE /income/:id`

> **Critical mechanic:** the "Log Income" modal does **not** send an exchange rate. The backend then defaults to **280** and computes `amountPKR = amount × 280` — *including when the currency is PKR*. Tests `INC-06` and `INC-07` exercise this.

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| INC-01 | Empty state | Fresh account | Illustrated empty state: "No income entries recorded yet" with a hint about logging manual income or uploading statements | `[ ] Pass [ ] Fail` |
| INC-02 | Log INC-1 | **Log Income** → date `2026-08-01`, platform Upwork Escrow, description `Sprint 1 milestone – TechFlow Labs`, client TechFlow Labs, amount `2000`, USD, SBP `9100`, PRC `PRC-2026-0001` | Modal closes; row appears with Original `$2,000.00` and Converted `Rs 560,000`; platform badge `upwork` | `[ ] Pass [ ] Fail` |
| INC-03 | Log INC-2 | Per Section 4.3, PRC left blank | Row shows `Rs 324,800`, badge `direct` | `[ ] Pass [ ] Fail` |
| INC-04 | Required fields | Submit with description blank | Native validation blocks submit | `[ ] Pass [ ] Fail` |
| INC-05 | Zero / negative amount | Amount `0`, then `-500` | Both are silently rejected by the modal (guard: `amount <= 0` returns early). 🐞 **Defect:** no error message is shown — the modal just does nothing | `[ ] Pass [ ] Fail` |
| INC-06 | 🐞 PKR income inflated ×280 | Log income: date `2026-08-10`, platform "Local PKR Client", description `Local retainer – Lahore Digital`, client Lahore Digital, amount `150000`, currency **PKR** | 🐞 **KNOWN BUG — high severity:** Converted Amount shows **Rs 42,000,000** instead of Rs 150,000. **Delete this row immediately** so it does not corrupt later sections | `[ ] Pass [ ] Fail` |
| INC-07 | 🐞 EUR/GBP also use 280 | Log 1000 EUR | Converted shows `Rs 280,000` — the live EUR rate is never applied to income (only the invoice form uses live rates). Delete this row afterwards | `[ ] Pass [ ] Fail` |
| INC-08 | SBP purpose code default | Log income leaving the SBP field at its default | Stored as `9100`. Clearing the field entirely also results in `9100` (server-side default) | `[ ] Pass [ ] Fail` |
| INC-09 | SBP code not validated | Enter SBP code `NOT-A-CODE` | ⚠️ Accepted as free text — there is no code list or format check | `[ ] Pass [ ] Fail` |
| INC-10 | Source filter — Foreign | Set the dropdown to "Foreign / Remittance" | Shows INC-1 (platform ≠ direct) but **not** INC-2. ⚠️ The filter classifies "foreign" as *has a PRC reference OR platform ≠ direct*, so a genuine USD Wise payment logged as `direct` without a PRC is mis-classified as Local | `[ ] Pass [ ] Fail` |
| INC-11 | Source filter — Local | Set to "Local Income" | Shows INC-2 only | `[ ] Pass [ ] Fail` |
| INC-12 | Source filter — All | Set to "All Sources" | Both rows | `[ ] Pass [ ] Fail` |
| INC-13 | Delete — confirm dialog | Trash icon on a throwaway income row | "Delete Income Record?" modal quoting the description | `[ ] Pass [ ] Fail` |
| INC-14 | Delete — cancel | Cancel | Row remains | `[ ] Pass [ ] Fail` |
| INC-15 | Delete — confirm | Confirm | Row disappears; green toast "Income Entry Deleted"; dashboard totals drop accordingly | `[ ] Pass [ ] Fail` |
| INC-16 | Edit income | Look for an edit control | 🚧 **NOT IMPLEMENTED** — there is no edit path (no `PATCH /income/:id`). To correct a mistake you must delete and re-create | `[ ] Pass [ ] Fail` |
| INC-17 | Link income to an invoice | Via Swagger: `POST /income` with `"invoiceId": "<INV-B id>"` | Income is created **and** INV-B's status flips to `paid` automatically. This is the only path that links the two records | `[ ] Pass [ ] Fail` |
| INC-18 | Future date | Log income dated `2030-01-01` | ⚠️ Accepted with no warning; appears at the top of the ledger | `[ ] Pass [ ] Fail` |
| INC-19 | Very old date | Log income dated `1990-01-01` | Accepted; excluded from the current-year Reports trend chart (Section 18) | `[ ] Pass [ ] Fail` |
| INC-20 | Evidence button | Click **Evidence** on a row | Evidence Vault modal opens — see Section 17 | `[ ] Pass [ ] Fail` |

---

## 11. CSV import

**Entry points:** "Auto-Import CSV" on `/income`, "Auto-Import Clients via CSV" on `/clients`
**API:** `POST /csv/import` (multipart `file`, or JSON `{ csvText }`)
**Sample files:** repo root — `sample_upwork_statement.csv`, `sample_generic_financial_statement.csv`, `sample_1000_transactions.csv`

Parser behaviour (verified): the file is treated as **Upwork format** if the header row contains `ref id` **or** the word `type`; otherwise the generic format `Date,Description,Amount,Type,Currency` is used. Positive amounts whose Type does not contain "fee" become income; everything else becomes an expense. Conversion always uses **280.50**.

> Run these tests on a **throwaway account**, then return to Account A. CSV import adds many rows and auto-creates clients.

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| CSV-01 | Modal contents | Open the import modal | Drag-and-drop zone, "Only .csv files up to 5MB", **Download Sample CSV**, **Import Demo Statement**, and a "what happens automatically" panel | `[ ] Pass [ ] Fail` |
| CSV-02 | Download sample | Click **Download Sample CSV** | `freelancerhisab_sample_statement.csv` downloads, containing 4 Upwork-format rows | `[ ] Pass [ ] Fail` |
| CSV-03 | Import demo statement | Click **Import Demo Statement** | Success screen: "Successfully extracted **4** real transactions". `/income` gains 2 rows ($1,450 and $850); `/expenses` gains 2 rows tagged `software` and vendor `Upwork Global Inc.`; `/clients` gains `TechFlow Labs` and `Acme Corp` | `[ ] Pass [ ] Fail` |
| CSV-04 | Upload the Upwork sample file | Drag `sample_upwork_statement.csv` onto the drop zone | 6 transactions parsed: 3 income (1450, 850, 1200 USD), 3 fee expenses (145, 85, 120); clients `TechFlow Labs`, `Acme Corp`, `Horizon Media` auto-created; PKR values = amount × 280.50 | `[ ] Pass [ ] Fail` |
| CSV-05 | Click-to-select upload | Click the drop zone and pick the same file via the file dialog | Identical result to CSV-04 | `[ ] Pass [ ] Fail` |
| CSV-06 | 🐞 Generic-format file is mis-detected | Upload `sample_generic_financial_statement.csv` | 🐞 **KNOWN BUG — high severity:** the success screen reads "**0** real transactions" and nothing is imported. The header contains the word `Type`, so the file is parsed with the Upwork column layout, where the amount column is empty. The generic format is effectively unreachable | `[ ] Pass [ ] Fail` |
| CSV-07 | No duplicate detection | Import `sample_upwork_statement.csv` a second time | ⚠️ **LIMITATION:** all 6 rows are imported **again**, doubling income and expenses. Existing clients are reused (matched by name) so no duplicate clients appear. (Contradicts earlier documentation claiming duplicate prevention) | `[ ] Pass [ ] Fail` |
| CSV-08 | Wrong file extension | Rename a CSV to `.txt` and upload | Inline red error: `Invalid file format: "<name>". Please upload a valid .csv file.` No request is sent | `[ ] Pass [ ] Fail` |
| CSV-09 | PDF / EXE upload | Try to select a `.pdf` or `.exe` | The file dialog filters to `.csv`; if forced through by drag-and-drop, the same "Invalid file format" error appears | `[ ] Pass [ ] Fail` |
| CSV-10 | Empty file | Create a 0-byte `empty.csv` and upload | `Selected CSV file is empty (0 bytes). Please upload a valid statement.` | `[ ] Pass [ ] Fail` |
| CSV-11 | Header only | A file containing just the header line | Server rejects: `CSV file must contain a header and at least one data row` | `[ ] Pass [ ] Fail` |
| CSV-12 | Over 5 MB | Generate a >5 MB CSV | `File size exceeds 5MB limit…`; no upload attempted | `[ ] Pass [ ] Fail` |
| CSV-13 | Malformed rows | A file with the Upwork header and rows containing missing columns and the text `abc` in the amount column | Rows with unparseable/zero amounts are silently skipped; the count reflects only valid rows. No 500 | `[ ] Pass [ ] Fail` |
| CSV-14 | Bad dates | Row with date `not-a-date` | Falls back to today's date rather than failing | `[ ] Pass [ ] Fail` |
| CSV-15 | Quoted commas | Row with `"Invoice for Acme, Inc. - Phase 2"` | Quoted commas are handled; the description stays intact | `[ ] Pass [ ] Fail` |
| CSV-16 | Client-name extraction | Inspect the auto-created clients from CSV-04 | Names are extracted from `for <X>` / `from <X>` in the description. Rows with no match become `Upwork Client` | `[ ] Pass [ ] Fail` |
| CSV-17 | Cache invalidation | After a successful import, without reloading, visit `/income`, `/expenses`, `/clients`, `/dashboard` | All four reflect the new data immediately | `[ ] Pass [ ] Fail` |
| CSV-18 | Bulk import | Import `sample_1000_transactions.csv` (999 data rows) on the throwaway account | Completes without timing out; record the elapsed time. ~500 income + ~499 expenses created. See also Section 24 | `[ ] Pass [ ] Fail` |
| CSV-19 | Import while logged out | Log out mid-import (or clear the token then retry) | Request returns 401 and the modal shows an error rather than a false success | `[ ] Pass [ ] Fail` |
| CSV-20 | Imported income lacks PRC | After any import, check `/income` rows | ⚠️ Imported income has no PRC reference and its exchange rate is the 280.50 fallback — both will be flagged by filing readiness (Section 16) | `[ ] Pass [ ] Fail` |

---

## 12. Expenses

**Route:** `/expenses`
**API:** `GET /expenses`, `POST /expenses`, `DELETE /expenses/:id`

Valid category values in the database: `software, hardware, internet, office, travel, food, marketing, education, tax, other`.

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| EXP-01 | Empty state | Fresh account | 🐞 **Defect:** the table renders with headers and **no empty-state message** — just a blank body (unlike Income/Clients) | `[ ] Pass [ ] Fail` |
| EXP-02 | Add EXP-1 | **Add Expense** → date `2026-08-02`, category "Internet & Fiber Broadband", description `Nayatel Fiber – August`, vendor `Nayatel`, amount `4500`, PKR | Row appears; amount shown in red as `Rs 4,500`; badge `internet` | `[ ] Pass [ ] Fail` |
| EXP-03 | Add EXP-2 | Category "Software & Subscriptions", `GitHub Team subscription`, `GitHub`, `11200`, PKR | Row appears; badge `software` | `[ ] Pass [ ] Fail` |
| EXP-04 | Add EXP-3 | Category "Co-working & Office Rent", `Co-working desk – August`, `Kickstart`, `15000`, PKR | Row appears; badge `office` | `[ ] Pass [ ] Fail` |
| EXP-05 | 🐞 "Hardware & Laptops" category fails | Add an expense with category **Hardware & Laptops**, description `Dell XPS 15`, amount `385000` | 🐞 **KNOWN BUG — high severity:** the save silently fails and the modal stays open. The dropdown sends the value `equipment`, which is not one of the database's allowed categories. Confirm the 500 in the Network tab. No error is shown to the user | `[ ] Pass [ ] Fail` |
| EXP-06 | 🐞 "FBR Taxes & Accounting" category fails | Same test with category **FBR Taxes & Accounting** | Same failure — the dropdown sends `taxes` but the database expects `tax` | `[ ] Pass [ ] Fail` |
| EXP-07 | 🐞 Filter lists an unreachable category | Set the category filter to **Hardware** | Always empty — nothing can ever be saved with category `hardware` because the Add modal sends `equipment` | `[ ] Pass [ ] Fail` |
| EXP-08 | Filter — Software | Filter to **Software** | Only EXP-2 | `[ ] Pass [ ] Fail` |
| EXP-09 | Filter — Internet / Office / Other / All | Cycle through the remaining options | Each shows exactly the matching rows; **All Categories** restores everything | `[ ] Pass [ ] Fail` |
| EXP-10 | Required fields | Submit with description blank | Native validation blocks submit | `[ ] Pass [ ] Fail` |
| EXP-11 | Zero / negative amount | Amount `0`, then `-1000` | Silently rejected by the modal with no message (same defect as `INC-05`) | `[ ] Pass [ ] Fail` |
| EXP-12 | 🐞 Foreign-currency expense not converted | Add `AWS hosting`, `45`, currency **USD** | 🐞 **KNOWN BUG:** the row displays `Rs 45` and every downstream total (dashboard, reports, tax, wealth) treats it as 45 PKR. Expenses are never converted to PKR. Delete this row afterwards | `[ ] Pass [ ] Fail` |
| EXP-13 | Future date | Expense dated `2030-12-31` | ⚠️ Accepted with no warning | `[ ] Pass [ ] Fail` |
| EXP-14 | Very large amount | Amount `99999999999` | Expect a numeric-overflow error from the database (precision 12, scale 2). Record how it surfaces | `[ ] Pass [ ] Fail` |
| EXP-15 | Decimal amount | Amount `1234.56` | Saves; displays as `Rs 1,235` (the formatter rounds to whole rupees for display only) | `[ ] Pass [ ] Fail` |
| EXP-16 | Delete expense | Look for a delete control | 🚧 **NOT IMPLEMENTED** in the UI. Verify via API: `DELETE /expenses/:id` → `200` and the row disappears on reload | `[ ] Pass [ ] Fail` |
| EXP-17 | Edit expense | Look for an edit control | 🚧 **NOT IMPLEMENTED** (no `PATCH /expenses/:id`) | `[ ] Pass [ ] Fail` |
| EXP-18 | Evidence button | Click **Evidence** on a row | Evidence Vault modal opens — Section 17 | `[ ] Pass [ ] Fail` |
| EXP-19 | Totals propagate | After EXP-1..3, check `/dashboard` | Total Expenses `Rs 30,700` | `[ ] Pass [ ] Fail` |

---

## 13. Transactions / Unified ledger

**Route:** `/transactions`
**API:** `GET /transactions?search=&type=`

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| TXN-01 | Empty state | Fresh account | "No transactions found matching your criteria." | `[ ] Pass [ ] Fail` |
| TXN-02 | Combined feed | Account A with master data | 5 rows total (2 income + 3 expenses), newest first by transaction date | `[ ] Pass [ ] Fail` |
| TXN-03 | Income presentation | Inspect an income row | Down-right arrow, `+` prefix, primary colour, entity = client name, amount = the **PKR** value labelled `PKR` | `[ ] Pass [ ] Fail` |
| TXN-04 | Expense presentation | Inspect an expense row | Up-right arrow, `-` prefix, destructive colour, entity = vendor (or `General` when blank), amount in the expense's own currency | `[ ] Pass [ ] Fail` |
| TXN-05 | Type filter — Income Only | Select "Income Only" | 2 rows | `[ ] Pass [ ] Fail` |
| TXN-06 | Type filter — Expenses Only | Select "Expenses Only" | 3 rows | `[ ] Pass [ ] Fail` |
| TXN-07 | Search — description | Type `Sprint` | Only INC-1 | `[ ] Pass [ ] Fail` |
| TXN-08 | Search — entity | Type `Nayatel` | Only EXP-1 | `[ ] Pass [ ] Fail` |
| TXN-09 | Search — category | Type `internet` | Only EXP-1 | `[ ] Pass [ ] Fail` |
| TXN-10 | Search — case insensitive | Type `NAYATEL` | Same single result | `[ ] Pass [ ] Fail` |
| TXN-11 | Search — no match | Type `zzzzz` | Empty-state row | `[ ] Pass [ ] Fail` |
| TXN-12 | Combined filters | "Income Only" + search `Nayatel` | No rows | `[ ] Pass [ ] Fail` |
| TXN-13 | Search debounce | Type quickly | ⚠️ Every keystroke fires a request (no debounce). Watch the Network tab and note the request count | `[ ] Pass [ ] Fail` |
| TXN-14 | Date range filter | Look for one | 🚧 **NOT IMPLEMENTED** — despite being listed as delivered (TASK-008) in `PROJECT_STATUS.md` | `[ ] Pass [ ] Fail` |
| TXN-15 | Long description | Add income with a 400-character description, then view the ledger | Truncated with ellipsis at ~200 px; layout intact. Delete the row afterwards | `[ ] Pass [ ] Fail` |
| TXN-16 | Mixed-currency clarity | Compare a USD income row with a USD expense row (recreate `EXP-12` temporarily) | ⚠️ Income shows converted PKR while the expense shows the raw USD figure — both labelled with a currency code but not comparable. Log as a clarity defect | `[ ] Pass [ ] Fail` |
| TXN-17 | Pagination | With 1,000+ rows (throwaway account from CSV-18) | 🚧 No pagination — every row is rendered at once. Record the page load time | `[ ] Pass [ ] Fail` |

---

## 14. Wealth management

**Route:** `/wealth`
**API:** `GET/PATCH /wealth/statement`, `GET/POST /wealth/assets`, `PATCH/DELETE /wealth/assets/:id`, `GET/POST /wealth/liabilities`, `PATCH/DELETE /wealth/liabilities/:id`, `GET /wealth/reconciliation`

Reconciliation formula:
```
Expected Closing Wealth = Opening Wealth + Total Income − Total Expenses + Other Adjustments
Difference              = (Declared Assets − Declared Liabilities) − Expected Closing Wealth
Reconciled              = |Difference| ≤ 50,000
```

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| WLT-01 | Empty state | Fresh tax year | Assets table: "No assets declared yet."; Liabilities: "No liabilities declared yet."; totals `Rs 0` | `[ ] Pass [ ] Fail` |
| WLT-02 | Auto-created statement | Open `/wealth` for the first time | A wealth statement row is created automatically with opening wealth `0`; no error | `[ ] Pass [ ] Fail` |
| WLT-03 | Set opening wealth | Enter `500000` in Opening Balance and **click outside the field** | Saves on blur (there is no Save button) and the reconciliation card recalculates | `[ ] Pass [ ] Fail` |
| WLT-04 | Opening wealth without blur | Type a value and immediately switch tax year | ⚠️ The value is lost — saving depends entirely on the blur event. Log as a defect | `[ ] Pass [ ] Fail` |
| WLT-05 | Add asset — cash | **Add Asset** → CASH, `Meezan Bank current account`, `1200000` | Row appears; Total Assets `Rs 1,200,000` | `[ ] Pass [ ] Fail` |
| WLT-06 | Add asset — vehicle | VEHICLE, `Suzuki Alto 2021 (LEB-21-4477)`, `2400000` | Total Assets `Rs 3,600,000` | `[ ] Pass [ ] Fail` |
| WLT-07 | Add liability | **Add Liability** → `Bank Alfalah car loan`, `900000` | Total Liabilities `Rs 900,000`; Net Declared Wealth `Rs 2,700,000` | `[ ] Pass [ ] Fail` |
| WLT-08 | All asset types | Add one asset of each of PROPERTY, INVESTMENT, OTHER (value `1` each), then delete them | Each saves and displays its type label correctly | `[ ] Pass [ ] Fail` |
| WLT-09 | Reconciliation — mismatch | With master data and the values above | Red left border, ❌ **Wealth Mismatch**, text quoting a gap of `Rs 1,345,900` and the `Rs 50,000` tolerance. Formula strip reads: Opening `Rs 500,000` + Income `Rs 884,800` − Expenses `Rs 30,700` = Expected `Rs 1,354,100` | `[ ] Pass [ ] Fail` |
| WLT-10 | Reconciliation — success | Change Opening Balance to `1845900` and blur | Green left border, ✅ **Wealth Reconciled**, Expected = Declared = `Rs 2,700,000`. **Leave this value in place** — Section 16 depends on it | `[ ] Pass [ ] Fail` |
| WLT-11 | Tolerance boundary — inside | Set opening wealth to `1895900` (difference −50,000 exactly) | Still **reconciled** (the check is `≤` tolerance) | `[ ] Pass [ ] Fail` |
| WLT-12 | Tolerance boundary — outside | Set opening wealth to `1895901` | Flips to **mismatch**. Restore `1845900` afterwards | `[ ] Pass [ ] Fail` |
| WLT-13 | Negative asset value | Add an asset with value `-5000` | Rejected: `400` (`valuePKR must not be less than 0`). 🐞 **Defect:** the dialog shows no message — the error is only logged to console | `[ ] Pass [ ] Fail` |
| WLT-14 | Zero-value asset | Add an asset with value `0` | Accepted | `[ ] Pass [ ] Fail` |
| WLT-15 | Very large asset | Add an asset with value `999999999999` | Expect a numeric-overflow error (precision 14, scale 2). Record how it surfaces | `[ ] Pass [ ] Fail` |
| WLT-16 | Non-numeric value | Type letters into the value field | The `type="number"` input rejects them | `[ ] Pass [ ] Fail` |
| WLT-17 | Delete asset | Trash icon on a throwaway asset | Deleted immediately with **no confirmation dialog**. ⚠️ Inconsistent with clients/income, which do confirm. Log as a defect | `[ ] Pass [ ] Fail` |
| WLT-18 | Delete liability | Trash icon on a throwaway liability | Same — deletes immediately, no confirmation | `[ ] Pass [ ] Fail` |
| WLT-19 | Edit asset | Look for an edit control | 🚧 **NOT IMPLEMENTED** in the UI (`PATCH /wealth/assets/:id` exists in the API — verify it via Swagger) | `[ ] Pass [ ] Fail` |
| WLT-20 | Tax-year isolation for assets | Switch to Tax Year 2025 | Assets and liabilities lists are empty — they are correctly scoped per year | `[ ] Pass [ ] Fail` |
| WLT-21 | ⚠️ Income/expenses are NOT year-scoped | While on Tax Year 2025, read the reconciliation formula strip | ⚠️ **LIMITATION — high impact:** Income `Rs 884,800` and Expenses `Rs 30,700` are still shown even though every transaction is dated 2026. The reconciliation sums **all-time** income and expenses regardless of the selected year, so any year other than the current one reconciles incorrectly | `[ ] Pass [ ] Fail` |
| WLT-22 | Other adjustments | Look for an input | 🚧 **NOT IMPLEMENTED** in the UI. Verify via API: `PATCH /wealth/statement?year=2026` with `{"otherAdjustmentsPKR": 100000}` → Expected Closing Wealth increases by 100,000. Reset it to 0 afterwards | `[ ] Pass [ ] Fail` |
| WLT-23 | Year switch reload | Switch 2026 → 2024 → 2026 | Loading spinner each time; data reloads correctly | `[ ] Pass [ ] Fail` |
| WLT-24 | API failure | Stop the API and reload `/wealth` | 🐞 **Defect:** the page hangs on "Loading wealth data…" is avoided (loading clears), but the reconciliation card disappears entirely with no error message. Record exact behaviour | `[ ] Pass [ ] Fail` |
| WLT-25 | Cross-user isolation | As Account B, add an asset, then return to Account A | Account A's assets are unaffected | `[ ] Pass [ ] Fail` |

---

## 15. Tax simulator & FBR tax engine

**Route:** `/tax-simulator`
**API:** `GET /tax/estimate?pseb=&year=`, `POST /tax/simulate`

Engine rules (verified in `TaxService`):
- Income is **export** if its currency ≠ PKR **or** its platform is upwork/fiverr/freelancer; otherwise **local**.
- Export tax rate comes from the `tax_rules` table, auto-seeded on first call: `0.25%` when PSEB-registered, `1.0%` otherwise.
- Local income uses FBR individual slabs (table below).
- The simulator assumes **100% of the hypothetical income is export** and **ignores hypothetical expenses entirely** in the tax maths.

Local slab reference (for `TAX-10`):

| Local income (PKR) | Tax |
|---|---|
| 600,000 | 0 |
| 1,000,000 | 10,000 |
| 2,000,000 | 115,000 |
| 3,000,000 | 300,000 |
| 5,000,000 | 925,000 |

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| TAX-01 | Initial state | Open `/tax-simulator` | Empty inputs, PSEB toggle **on**, and a dashed placeholder card: "Ready for Simulation" | `[ ] Pass [ ] Fail` |
| TAX-02 | Run button disabled | Leave income blank | **Run Simulation** is disabled | `[ ] Pass [ ] Fail` |
| TAX-03 | Basic simulation | Income `15000000`, expenses `500000`, PSEB on → **Run Simulation** | Current Trajectory: tax `Rs 2,212`, income `Rs 884,800`, expenses `Rs 30,700`. Simulated Future: tax `Rs 37,500`, income `Rs 15,000,000`, expenses `Rs 500,000`. Difference card: amber, **Tax Increase**, `+Rs 35,288` | `[ ] Pass [ ] Fail` |
| TAX-04 | PSEB off | Toggle PSEB off, re-run the same figures | Simulated tax `Rs 150,000` (1%); the footnote reads "The applied tax rate is **1.0%**"; Current Trajectory tax becomes `Rs 8,848` | `[ ] Pass [ ] Fail` |
| TAX-05 | Tax decrease path | PSEB on, income `100000`, expenses `0` | Simulated tax `Rs 250`; difference card turns **green**, **Tax Decrease**, `-Rs 1,962` | `[ ] Pass [ ] Fail` |
| TAX-06 | ⚠️ Expenses ignored | Run income `15000000` with expenses `0`, then again with expenses `14000000` | ⚠️ **LIMITATION:** the simulated tax is `Rs 37,500` in both cases. Expenses are displayed but never affect the calculation | `[ ] Pass [ ] Fail` |
| TAX-07 | Zero income | Income `0` | Run button stays disabled (empty-string check treats `0` as falsy in the guard — confirm) | `[ ] Pass [ ] Fail` |
| TAX-08 | Negative income | Income `-5000000` | ⚠️ Accepted — result shows a negative tax `-Rs 12,500`. There is no `@Min(0)` on the simulate endpoint. Log as a defect | `[ ] Pass [ ] Fail` |
| TAX-09 | Very large income | Income `999999999999` | Simulated tax `Rs 2,499,999,998`; formatting stays intact | `[ ] Pass [ ] Fail` |
| TAX-10 | Local slab verification | Via Swagger `GET /tax/estimate`: this requires local income, which is unreachable through the UI (see `INC-06`). Insert income directly with `currency: "PKR"`, `platform: "other"`, `exchangeRate: 1` and the amounts from the slab table, then call the endpoint | `localTaxLiabilityPKR` matches the slab table for each amount. Delete the test rows afterwards | `[ ] Pass [ ] Fail` |
| TAX-11 | Export/local split | `GET /tax/estimate?pseb=true` with master data | `exportIncomePKR: 884800`, `localIncomePKR: 0`, `exportTaxRatePercentage: 0.25`, `exportTaxLiabilityPKR: 2212`, `totalTaxLiabilityPKR: 2212`, `psebSavingsPKR: 6636`, `effectiveTaxRatePercentage: 0.25` | `[ ] Pass [ ] Fail` |
| TAX-12 | Deadline & disclaimer | Inspect the same response | `fbrFilingDeadline: "September 30, 2026"` and a disclaimer citing Section 154A of the Income Tax Ordinance 2001 | `[ ] Pass [ ] Fail` |
| TAX-13 | Tax rules seeding | Query the `tax_rules` table after the first `/tax/estimate` call | Two rows for tax year `2025-26`: `IT_EXPORT_PSEB` @ 0.0025 and `IT_EXPORT_STANDARD` @ 0.01 | `[ ] Pass [ ] Fail` |
| TAX-14 | Rate is DB-driven | Update the `IT_EXPORT_PSEB` rate to `0.005` directly in the database, then reload `/reports` | The displayed rate becomes `0.5%` and the liability doubles to `Rs 4,424` — proving the engine reads from the table. Restore `0.0025` afterwards | `[ ] Pass [ ] Fail` |
| TAX-15 | Different tax year | `GET /tax/estimate?year=2025` | Returns a result and auto-seeds `2024-25` rules; deadline reads `September 30, 2025`. ⚠️ Note the income totals are **not** year-filtered — the same all-time totals are used | `[ ] Pass [ ] Fail` |
| TAX-16 | Tax rules admin UI | Look for one | 🚧 **NOT IMPLEMENTED** — plan doc 17 specifies `GET /tax/rules` and an admin surface; neither exists. Rates can only be changed by editing the database | `[ ] Pass [ ] Fail` |
| TAX-17 | Unauthenticated | `curl -X POST http://localhost:3001/api/v1/tax/simulate -d '{"incomePKR":1000}' -H 'Content-Type: application/json'` | `401` | `[ ] Pass [ ] Fail` |

---

## 16. Filing simulator & readiness score

**Route:** `/filing`
**API:** `GET /filing/readiness`, `GET /filing/checklist`, `GET /wealth/reconciliation`

There are **two different scores** in the product and they legitimately differ:

**A. Backend readiness score** (`/filing/readiness`) — shown on the **dashboard banner**. Seven checks, score = passed/7:

| # | Check | Fails when |
|---|---|---|
| 1 | `MISSING_PROFILE_INFO` | PSEB ID missing from profile |
| 2 | `INCOME_UNMATCHED_PLATFORM` | Income has neither platform nor client |
| 3 | `EXPENSE_MISSING_CATEGORY` | Any expense has category `other` |
| 4 | `OVERDUE_INVOICES` | An invoice has been `sent` for > 90 days |
| 5 | `MISSING_EXCHANGE_RATE` | Non-PKR income with exchange rate exactly 1 or 280 |
| 6 | `MISSING_PRC_SBP` | Non-PKR income missing PRC ref or SBP code |
| 7 | `ORPHANED_PAID_INVOICE` | An invoice is `paid` with no linked income record |

**B. Frontend wizard score** (`/filing` page) — five steps, computed in the browser from the readiness issues plus the wealth reconciliation.

With the master data set (PSEB ID saved, INV-A marked paid in `INV-28`), expect check 5 to fail (income logged through the UI always gets rate 280), check 6 to fail (INC-2 has no PRC), and check 7 to fail (INV-A is paid with no linked income) → **4/7 = 57%**. If you have not yet marked INV-A paid, expect **5/7 = 71%**.

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| FIL-01 | Page loads | Open `/filing` | Header with tax-year selector and **Refresh**, a readiness card with a percentage and progress bar, five step cards, and a "Generate Filing Package" card | `[ ] Pass [ ] Fail` |
| FIL-02 | Step 2 — Income Ledger | With INV-A marked paid | Incomplete, with the warning `1 invoices are marked Paid but have no linked Income record` | `[ ] Pass [ ] Fail` |
| FIL-03 | Step 3 — Expenses | With EXP-1..3 (none categorised `other`) | Complete ✅ | `[ ] Pass [ ] Fail` |
| FIL-04 | Step 3 turns incomplete | Add an expense with category **Other Operational Expenses**, click **Refresh** | Step 3 goes incomplete with `1 expenses are missing a specific category`. Delete that expense via API afterwards | `[ ] Pass [ ] Fail` |
| FIL-05 | Step 4 — Financial Audit | With master data | Incomplete, with warnings for both `MISSING_PRC_SBP` (1 entry) and `MISSING_EXCHANGE_RATE` (2 entries) | `[ ] Pass [ ] Fail` |
| FIL-06 | Step 5 — Wealth | After `WLT-10` (reconciled) | Complete ✅. Set opening wealth back to `500000` and refresh → incomplete with `Wealth gap of Rs. 1,345,900 detected` and a **Go to Wealth Reconciler** link. Restore `1845900` afterwards | `[ ] Pass [ ] Fail` |
| FIL-07 | Wealth link | Click **Go to Wealth Reconciler** | Navigates to `/wealth` | `[ ] Pass [ ] Fail` |
| FIL-08 | 🐞 Step 1 can never complete | Save a PSEB ID in Settings, return to `/filing`, click **Refresh** | 🐞 **KNOWN BUG — blocker:** "Personal Information" stays incomplete with `Missing PSEB registration (loss of 0.75% tax break)`. The step reads `user.hasPseb`, a field the login/register response never returns. **Consequence: readiness can never exceed 80% and the Download Tax Package button is permanently disabled** | `[ ] Pass [ ] Fail` |
| FIL-09 | Download button disabled | Observe the Generate Filing Package card | Button disabled with the note "Please resolve all outstanding issues to enable export." — always, because of `FIL-08` | `[ ] Pass [ ] Fail` |
| FIL-10 | Package generation (workaround) | In DevTools, patch `localStorage.auth-storage` to add `"hasPseb":true` inside the `user` object, reload `/filing`, resolve the other four steps (add a PRC to income via Swagger, ensure no orphaned paid invoice, reconcile wealth), then click **Download Tax Package (ZIP)** | Downloads `FreelancerHisab-Filing-Package-2026.zip` containing `FBR-Tax-Summary-2026.pdf` (a screenshot of the page), `Income-Ledger-2026.csv`, `Expense-Ledger-2026.csv` | `[ ] Pass [ ] Fail` |
| FIL-11 | Package contents | Open the CSVs from FIL-10 | Income CSV columns: Date, Description, Platform, Currency, Original Amount, Amount PKR, PRC Reference, SBP Code. Expense CSV: Date, Description, Vendor, Category, Amount PKR. Row counts match `/income` and `/expenses` | `[ ] Pass [ ] Fail` |
| FIL-12 | ⚠️ Package differs from the plan | Compare with `future-plan/22` | ⚠️ Plan specifies a server-side `GET /filing/package` returning `01-tax-summary.pdf`, `02-income-report.pdf`, `03-expense-report.pdf`, `04-transaction-ledger.csv`. Delivered: a client-side zip whose "PDF" is a rasterised screenshot of the page. Log as a scope gap | `[ ] Pass [ ] Fail` |
| FIL-13 | 🐞 Session expiry breaks the page | Load `/filing`, wait **3 minutes**, click **Refresh** | 🐞 **KNOWN BUG:** the page uses raw `fetch` with the stored token instead of the shared API client, so it never triggers the token-refresh flow. After the 2-minute access-token expiry the requests 401, `readiness` becomes null, and every step renders as incomplete with no error shown. Navigating to another page and back restores it | `[ ] Pass [ ] Fail` |
| FIL-14 | Tax-year selector | Switch to Tax Year 2025 | The wealth call is year-scoped, but `/filing/readiness` **ignores** the `year` parameter entirely (the service accepts it and never uses it). ⚠️ Scores are identical across years | `[ ] Pass [ ] Fail` |
| FIL-15 | Dashboard vs filing score | Compare the dashboard banner percentage with the `/filing` percentage | They differ by design (7 checks vs 5 steps). Record both. ⚠️ Two different "readiness" numbers is a UX defect worth logging | `[ ] Pass [ ] Fail` |
| FIL-16 | Checklist endpoint | `GET /filing/checklist` via Swagger | Returns a `PREPARATION` stage with 8 items, `overallPercent`, and `issues`. 🚧 **No page in the app consumes this** — plan doc 23's staged checklist UI is not built | `[ ] Pass [ ] Fail` |
| FIL-17 | Financial Audit endpoint | Look for `GET /filing/audit` | 🚧 **NOT IMPLEMENTED** — plan doc 21's dedicated audit endpoint does not exist; a subset of its checks live inside `/filing/readiness` | `[ ] Pass [ ] Fail` |
| FIL-18 | Overdue-invoice check | Insert an invoice with `status='sent'` and `created_at` 100 days ago directly in the database, then reload the dashboard | Readiness gains the issue `1 invoices have been Sent for >90 days without update`; the score drops. Remove the row afterwards | `[ ] Pass [ ] Fail` |

---

## 17. Evidence vault

**Entry points:** the **Evidence** button on any `/income` or `/expenses` row
**API:** `POST /evidence/upload`, `GET /evidence/income/:id`, `GET /evidence/expense/:id`, `DELETE /evidence/:id`
**Storage:** Vercel Blob — requires `BLOB_READ_WRITE_TOKEN` in `apps/api/.env`

Prepare these files before starting:
- `prc-2026-0001.pdf` — any small PDF (~100 KB)
- `bank-slip.jpg` — any JPEG (~500 KB)
- `receipt.png` — any PNG
- `large-file.pdf` — a PDF larger than 5 MB
- `malicious.exe` — any renamed binary
- `statement.docx` — any Word document

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| EVD-01 | Open the vault | Click **Evidence** on INC-1 | Dialog "Evidence Vault", subtitle naming the income description, an upload drop zone reading "Supports PDF, JPG, PNG (Max 5MB)", and "No evidence attached yet." | `[ ] Pass [ ] Fail` |
| EVD-02 | Missing blob token | If `BLOB_READ_WRITE_TOKEN` is not configured, attempt any upload | A browser `alert("Failed to upload file")`. Configure the token before continuing | `[ ] Pass [ ] Fail` |
| EVD-03 | Upload a PDF | Upload `prc-2026-0001.pdf` to INC-1 | Spinner "Uploading to secure vault…", then the file appears in "Attached Documents" with a file icon, its size in KB and today's date | `[ ] Pass [ ] Fail` |
| EVD-04 | Upload an image | Upload `bank-slip.jpg` to INC-1 | Appears with an **image** icon (icon is chosen from the MIME type) | `[ ] Pass [ ] Fail` |
| EVD-05 | Open a stored document | Click a document name | Opens the Vercel Blob URL in a new tab and renders the file | `[ ] Pass [ ] Fail` |
| EVD-06 | Persistence | Close the dialog, reload the page, reopen the vault for INC-1 | Both documents are still listed | `[ ] Pass [ ] Fail` |
| EVD-07 | Expense evidence | Open the vault on EXP-1 and upload `receipt.png` | Uploads and lists; document type is recorded as `RECEIPT` (income uploads record `PRC`) | `[ ] Pass [ ] Fail` |
| EVD-08 | Record isolation | Open the vault for INC-2 | Empty — documents are scoped to the individual record | `[ ] Pass [ ] Fail` |
| EVD-09 | Delete a document | Click the trash icon on `bank-slip.jpg` | Removed from the list **without any confirmation dialog**; the blob is deleted too (re-opening the saved URL 404s). ⚠️ No confirmation on a destructive action | `[ ] Pass [ ] Fail` |
| EVD-10 | 🐞 5 MB limit is not enforced | Upload `large-file.pdf` (> 5 MB) | 🐞 **KNOWN BUG:** the upload **succeeds** despite the "Max 5MB" label — there is no size check on the client or the server. Delete it afterwards | `[ ] Pass [ ] Fail` |
| EVD-11 | 🐞 File-type restriction is cosmetic | Rename `malicious.exe` to `malicious.pdf` and upload it | 🐞 **KNOWN BUG:** accepted and stored. The `accept` attribute only filters the file dialog; nothing validates MIME type or content server-side. Delete it afterwards | `[ ] Pass [ ] Fail` |
| EVD-12 | Unsupported extension via the dialog | Try to select `statement.docx` through the file picker | Not selectable (filtered by `accept`), but see EVD-11 for the bypass | `[ ] Pass [ ] Fail` |
| EVD-13 | Multiple files at once | Select two files in the picker | Only the **first** is uploaded — multi-select is not supported | `[ ] Pass [ ] Fail` |
| EVD-14 | Upload failure handling | Stop the API, attempt an upload | A raw browser `alert("Failed to upload file")`. ⚠️ Inconsistent with the toast pattern used elsewhere | `[ ] Pass [ ] Fail` |
| EVD-15 | 🔒 Cross-user read | As Account A note an income id with attached documents. Log in as Account B and run `curl http://localhost:3001/api/v1/evidence/income/<Account A income id> -H "Authorization: Bearer <Account B token>"` | 🐞 **SECURITY DEFECT — high severity:** Account A's document metadata (including the public blob URL) is returned. The lookup filters by record id only and ignores the requesting user | `[ ] Pass [ ] Fail` |
| EVD-16 | 🔒 Cross-user delete | As Account B, `DELETE /evidence/<Account A document id>` | Correctly refused, but with a `500` and the raw message `Document not found` rather than a `403`/`404`. Log as a defect | `[ ] Pass [ ] Fail` |
| EVD-17 | Blob URLs are public | Open a stored blob URL in a private window with no session | ⚠️ **LIMITATION:** files are uploaded with `access: 'public'` — anyone holding the URL can read the document. Note as a design risk for tax evidence | `[ ] Pass [ ] Fail` |
| EVD-18 | Evidence coverage indicators | Look for any "missing documents" indicator on the income/expense lists | 🚧 **NOT IMPLEMENTED** — plan doc 20's coverage view does not exist | `[ ] Pass [ ] Fail` |
| EVD-19 | Invoice evidence | Look for an Evidence button on an invoice | 🚧 **NOT IMPLEMENTED** — evidence attaches only to income and expenses, not invoices | `[ ] Pass [ ] Fail` |
| EVD-20 | Deleted parent record | Attach a document to a throwaway income row, then delete that income row | The document row survives with a null income link and becomes unreachable from the UI. Log as an orphaned-data defect | `[ ] Pass [ ] Fail` |

---

## 18. Reports & exports

**Route:** `/reports`
**API:** `GET /reports/income-vs-expenses`, `/reports/client-breakdown`, `/reports/platform-breakdown`, `/reports/income-consolidation`, `GET /tax/estimate`

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| RPT-01 | Empty state | Fresh account | Trend card: "No monthly trend data recorded yet."; Platform card: "No platform income logged in database yet."; P&L table: "No P&L transactions recorded in database yet."; KPIs all `Rs 0` | `[ ] Pass [ ] Fail` |
| RPT-02 | KPI cards | Account A with master data | Gross Income `Rs 884,800`; Total Expenses `Rs 30,700`; Net Profit `Rs 854,100` with `96.5% Profit Margin`; FBR Section 154A Tax Liability `Rs 2,212` at `0.25%` | `[ ] Pass [ ] Fail` |
| RPT-03 | Cross-check with dashboard | Compare against `DASH-02` | Income, expenses and net profit match exactly | `[ ] Pass [ ] Fail` |
| RPT-04 | Monthly trend | Inspect the Income vs Expense Trend card | Twelve rows Jan–Dec; only **Aug** has non-zero values (`Rs 884,800` income, `Rs 30,700` expense); bar widths scale to the largest month | `[ ] Pass [ ] Fail` |
| RPT-05 | ⚠️ Trend is current-calendar-year only | Add an income dated `2025-08-01` via the Log Income modal and reload | ⚠️ **LIMITATION:** the trend chart filters on the **current calendar year** only and has no year selector, so the 2025 entry never appears — while the KPI cards above it *do* include it. Delete the row afterwards | `[ ] Pass [ ] Fail` |
| RPT-06 | Platform distribution | Inspect the Platform Distribution card | `Upwork Escrow 63%`, `Direct Bank Transfer / Wise 37%`; bars sized to match | `[ ] Pass [ ] Fail` |
| RPT-07 | P&L table | Scroll to Profit & Loss Statement | Two income rows (green badge), three expense rows (red badge, `-` prefix), then a bold `Net Freelance Profit` row of `Rs 854,100` | `[ ] Pass [ ] Fail` |
| RPT-08 | ⚠️ P&L is unpaginated and unsorted | View this page on the throwaway 1,000-row account | ⚠️ Every income row then every expense row is rendered — no date sorting, no grouping, no pagination | `[ ] Pass [ ] Fail` |
| RPT-09 | Export P&L PDF | Click **Export P&L PDF** | Opens the browser print dialog for the whole page. ⚠️ **LIMITATION:** it is `window.print()`, not a generated PDF, and the page has **no print stylesheet** — the sidebar and header appear in the output, unlike the invoice page | `[ ] Pass [ ] Fail` |
| RPT-10 | CSV export | Look for a CSV export control | 🚧 **NOT IMPLEMENTED** on this page. (Contradicts earlier documentation.) CSV ledgers are only produced by the Filing Package in `FIL-10` | `[ ] Pass [ ] Fail` |
| RPT-11 | Date-range filter | Look for a period/date-range selector | 🚧 **NOT IMPLEMENTED** — the `period` query parameter exists on the API but is unused, and there is no UI control | `[ ] Pass [ ] Fail` |
| RPT-12 | Client breakdown endpoint | `GET /reports/client-breakdown` via Swagger | `[{ "name": "TechFlow Labs", "value": 560000 }, { "name": "Horizon Media", "value": 324800 }]`. 🚧 No page renders this data | `[ ] Pass [ ] Fail` |
| RPT-13 | Platform breakdown endpoint | `GET /reports/platform-breakdown` | `[{ "name": "upwork", "value": 560000 }, { "name": "direct", "value": 324800 }]` | `[ ] Pass [ ] Fail` |
| RPT-14 | Income consolidation | `GET /reports/income-consolidation?year=2026` | `totalPKR: 884800`, `trackedPercentage: 100`, `unmatchedPercentage: 0`, byPlatform sorted descending | `[ ] Pass [ ] Fail` |
| RPT-15 | Consolidation year filter | `GET /reports/income-consolidation?year=2025-26` | Applies a July–June Pakistani tax-year window: only income from Jul 2025–Jun 2026 is counted (so `totalPKR: 0` with the master data). Compare with `?year=2026` (calendar year) | `[ ] Pass [ ] Fail` |
| RPT-16 | Unmatched income | Create income via Swagger with no `clientId` and platform omitted, then reload the dashboard consolidation card | `unmatchedPercentage` rises above 0 and the Tracked/Unmatched split changes. Delete the row afterwards | `[ ] Pass [ ] Fail` |
| RPT-17 | Charting library | Inspect the trend and distribution visuals | ⚠️ These are CSS bar divs, not Recharts, despite what `FEATURE_MATRIX.md` claims. No tooltips, no axes, no legend | `[ ] Pass [ ] Fail` |
| RPT-18 | Reports after API failure | Stop the API and reload | All values fall back to `Rs 0`/empty states with no crash and no error message | `[ ] Pass [ ] Fail` |

---

## 19. Settings

**Route:** `/settings`
**API:** `GET /users/profile`, `PATCH /users/profile`

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| SET-01 | Tabs render | Open `/settings` | Four tabs: **Profile & Business**, **Bank & SBP Tax**, **Invoicing Prefs**, **Security**; switching tabs works without a reload | `[ ] Pass [ ] Fail` |
| SET-02 | Profile prefill | Profile tab | Full Name and Business Name are populated from the database; Email, Default Base Currency (`PKR`) and Timezone (`Asia/Karachi`) are disabled/read-only | `[ ] Pass [ ] Fail` |
| SET-03 | Save profile | Change Phone to `+92 300 1234567` → **Save Profile Changes** | Green banner "Settings updated & saved to database!" for ~3 seconds; value persists after reload | `[ ] Pass [ ] Fail` |
| SET-04 | Save bank & SBP details | Bank tab → bank `Meezan Bank Limited`, account title `Adnan Niaz`, IBAN `PK36MEZN0001020304050607`, PSEB `PSEB-2026-98765` → **Save Bank Details** | Saves and persists. The dashboard readiness score should then no longer report `MISSING_PROFILE_INFO` | `[ ] Pass [ ] Fail` |
| SET-05 | ⚠️ No IBAN validation | Save IBAN `not-an-iban-!!!` | ⚠️ Accepted — no format check exists anywhere. Restore the correct value afterwards | `[ ] Pass [ ] Fail` |
| SET-06 | 🐞 Password change does nothing | Security tab → type a current and new password → **Update Password** | 🐞 **KNOWN BUG — high severity:** the fields are unbound and the button submits the **profile** form. The password is never changed and the success banner still appears, implying it worked. Confirm by logging out and signing in with the old password | `[ ] Pass [ ] Fail` |
| SET-07 | 🐞 Session info is wrong | Security tab, read the session panel | 🐞 It states "Expires in 15 mins" — the access token actually expires in **2 minutes** | `[ ] Pass [ ] Fail` |
| SET-08 | Filer status control | Bank tab, look for a filer toggle | 🚧 The `Active Filer (0.25% Tax)` badge is a **static label**, not a control. The `isFiler` API field can only be changed via `PATCH /users/profile` | `[ ] Pass [ ] Fail` |
| SET-09 | Invoicing preferences save | Invoicing tab → prefix `QA-2026-`, terms `Net 15`, footer text → **Save Invoice Preferences** | Values save and persist | `[ ] Pass [ ] Fail` |
| SET-10 | 🐞 Invoicing preferences are never used | After SET-09, create a new invoice and open its detail page | 🐞 **KNOWN BUG:** the number still generates as `FH-<year>-####`, the payment terms are never shown, and the invoice footer uses the form's hardcoded default rather than your saved footer | `[ ] Pass [ ] Fail` |
| SET-11 | Sidebar reflects the name | Change Full Name to `Adnan N.` and save | Sidebar footer name and initials update immediately (the auth store is updated on save). Restore `Adnan Niaz` | `[ ] Pass [ ] Fail` |
| SET-12 | Cross-tab persistence | Fill Bank tab fields, switch to Invoicing, switch back | Values are retained in component state | `[ ] Pass [ ] Fail` |
| SET-13 | ⚠️ Shared save payload | Fill only the Invoicing tab and save | ⚠️ All four forms submit the **same** payload containing every field, so saving one tab rewrites the others from whatever is in state. Verify nothing is unexpectedly blanked | `[ ] Pass [ ] Fail` |
| SET-14 | Unknown field rejected | `curl -X PATCH .../users/profile -d '{"role":"admin"}'` with a valid token | `400` — `forbidNonWhitelisted` rejects properties not on the DTO | `[ ] Pass [ ] Fail` |
| SET-15 | Email cannot be changed | Attempt `PATCH /users/profile` with `{"email":"new@x.pk"}` | `400` (email is not on the DTO) — email is immutable by design | `[ ] Pass [ ] Fail` |
| SET-16 | Save failure | Stop the API, click Save | 🐞 **Defect:** the failure is only logged to the console; no error is shown to the user and the success banner does not appear (silent failure) | `[ ] Pass [ ] Fail` |
| SET-17 | Password hash never exposed | Inspect the `GET /users/profile` response | `passwordHash` is stripped from the payload | `[ ] Pass [ ] Fail` |
| SET-18 | Theme / dark mode | Look for a theme control | 🚧 A `ThemeProvider` exists in the code but there is no user-facing toggle | `[ ] Pass [ ] Fail` |
| SET-19 | Account deletion | Look for a delete-account option | 🚧 **NOT IMPLEMENTED** | `[ ] Pass [ ] Fail` |

---

## 20. User guide page

**Route:** `/guide`

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| GUI-01 | Page renders | Open `/guide` | Heading "User Manual & Feature Guide" with sectioned content cards | `[ ] Pass [ ] Fail` |
| GUI-02 | All sections present | Scroll the whole page | Sections for: Quick Start (4 steps), Creating & Exporting Invoices, Automated CSV & Statement Ingestion, FBR Section 154A & SBP Code 9100, Wealth Reconciliation (3 steps + troubleshooting), FBR Tax Simulator, Filing Readiness Audit (4 steps) | `[ ] Pass [ ] Fail` |
| GUI-03 | Accuracy check | Read each section against what you observed in Sections 8–19 | Flag any instruction that no longer matches the app — in particular anything implying features covered by Appendix A | `[ ] Pass [ ] Fail` |
| GUI-04 | Responsive | 375 px width | Text reflows, no horizontal scroll | `[ ] Pass [ ] Fail` |

---

## 21. Header, notifications & global error handling

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| NOT-01 | Notification bell | Click the bell in the header | Info toast: "Notifications — You have no new notifications at this time." 🚧 There is no real notification system; the red dot is decorative and always shown | `[ ] Pass [ ] Fail` |
| NOT-02 | Toast dismissal | Click the toast's close control | Toast disappears | `[ ] Pass [ ] Fail` |
| NOT-03 | Global search box | Type into the header search field and press Enter | 🚧 **NOT IMPLEMENTED** — the input has no handler; nothing happens | `[ ] Pass [ ] Fail` |
| NOT-04 | ⌘F hint | Press ⌘F / Ctrl+F | The displayed shortcut hint is decorative; the browser's own find opens | `[ ] Pass [ ] Fail` |
| NOT-05 | Mobile search | At 375 px, tap the search icon | Search bar expands full-width; the X collapses it. Still non-functional | `[ ] Pass [ ] Fail` |
| NOT-06 | Mobile menu | At 375 px, tap the hamburger | Sidebar slides in over a backdrop; tapping the backdrop or a nav link closes it | `[ ] Pass [ ] Fail` |
| NOT-07 | Sidebar active state | Visit each route | The matching nav item is highlighted. ⚠️ Matching is prefix-based, so `/invoices/new` highlights **Invoices** correctly | `[ ] Pass [ ] Fail` |
| NOT-08 | All nav links | Click every sidebar item | Dashboard, Clients, Invoices, Transactions, Income, Expenses, Reports, Wealth, Tax Simulator, Filing Simulator, User Guide, Settings all resolve without a 404 | `[ ] Pass [ ] Fail` |
| NOT-09 | 400 error surfaced | Try to save a client with an invalid email via the API while the form is open | Red toast titled `Client Save Failed (400)` with the API's `details` array joined into a readable message | `[ ] Pass [ ] Fail` |
| NOT-10 | 500 error surfaced | Trigger `INV-13` (duplicate invoice number) | Red toast `Validation Error (500)`. ⚠️ The message is a raw database error, not user-friendly | `[ ] Pass [ ] Fail` |
| NOT-11 | Network failure | Stop the API and exercise every page | ⚠️ **Inconsistent by design:** Clients and Invoice-create show a toast; Income, Expenses, Wealth, Settings and Evidence fail silently (console only) or use a raw `alert()`. Record which pages give no feedback | `[ ] Pass [ ] Fail` |
| NOT-12 | Error envelope shape | Inspect any failed request | `{"success": false, "data": null, "error": {"code": <status>, "message": "...", "details": [...] }}` | `[ ] Pass [ ] Fail` |
| NOT-13 | Success envelope shape | Inspect any successful request | `{"success": true, "data": <payload>, "error": null}` | `[ ] Pass [ ] Fail` |
| NOT-14 | 404 route | Open `/does-not-exist` | Next.js 404 page; the app does not crash | `[ ] Pass [ ] Fail` |
| NOT-15 | No global error boundary | Look for a custom error page | 🚧 No `error.tsx` / `not-found.tsx` — you get the framework defaults | `[ ] Pass [ ] Fail` |

---

## 22. Integrations to verify

| ID | Integration | How to verify | Expected result | Result |
|---|---|---|---|---|
| INT-01 | PostgreSQL | `npm run db:migrate` in `apps/api`, then create any record | Migrations apply cleanly; records persist across an API restart | `[ ] Pass [ ] Fail` |
| INT-02 | ExchangeRate-API (live FX) | Restart the API, watch the log, then open `/invoices/new` | Log line `Live exchange rates updated from ExchangeRate-API: 1 USD = <rate> PKR`; the invoice form's rate field matches | `[ ] Pass [ ] Fail` |
| INT-03 | FX fallback | Block outbound network (or set `EXCHANGE_RATE_API_URL` to an unreachable URL) and restart | Warning logged: `Failed to fetch primary exchange rates. Using fallback rates.` The app keeps working with USD 280.50 / EUR 302.10 / GBP 356.40. ⚠️ **No UI warning** tells the user a stale/fallback rate is in use | `[ ] Pass [ ] Fail` |
| INT-04 | FX cache | Call `GET /exchange-rate` twice within a minute | Only one outbound fetch (24-hour cache); `updatedAt` is unchanged between calls | `[ ] Pass [ ] Fail` |
| INT-05 | FX endpoint is public | `curl http://localhost:3001/api/v1/exchange-rate` with **no** Authorization header | ⚠️ Returns 200 — the exchange-rate controller has no auth guard. Low risk, but note it | `[ ] Pass [ ] Fail` |
| INT-06 | Vercel Blob | Complete `EVD-03` | File appears in the Vercel Blob store and the returned URL is publicly readable | `[ ] Pass [ ] Fail` |
| INT-07 | Vercel Blob deletion | Complete `EVD-09`, then open the previously saved blob URL | Returns 404 — the blob is genuinely deleted, not just the database row | `[ ] Pass [ ] Fail` |
| INT-08 | JWT / Passport | Any authenticated request | `Authorization: Bearer <token>` header present; removing it yields 401 | `[ ] Pass [ ] Fail` |
| INT-09 | CORS | `curl -i -H "Origin: http://evil.example" http://localhost:3001/api/v1/exchange-rate` | No `Access-Control-Allow-Origin` for the foreign origin; only `http://localhost:3000` is allowed | `[ ] Pass [ ] Fail` |
| INT-10 | Swagger | Open `/api/docs` | All modules documented. ⚠️ Only the clients DTO carries `@ApiProperty` annotations, so most request bodies are under-documented | `[ ] Pass [ ] Fail` |
| INT-11 | Resend email | Search for any email-sending code | 🚧 **NOT IMPLEMENTED** — `RESEND_API_KEY` exists in `.env` but nothing uses it. No invoice emails, no verification emails, no password reset | `[ ] Pass [ ] Fail` |
| INT-12 | Google OAuth | Look for a "Sign in with Google" button | 🚧 **NOT IMPLEMENTED** — the `auth_provider` enum and env variables exist; no flow is wired | `[ ] Pass [ ] Fail` |
| INT-13 | FBR / IRIS | Look for any direct FBR submission | 🚧 **NOT IMPLEMENTED by design** — the product only *prepares* figures. Confirm the UI never claims to file on the user's behalf | `[ ] Pass [ ] Fail` |
| INT-14 | SBP PRC | Log income with an SBP code and PRC reference | Stored and returned, and included in the filing-package CSV. ⚠️ There is **no** integration with SBP — these are free-text fields | `[ ] Pass [ ] Fail` |

---

## 23. Security, permissions & data isolation

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| SEC-01 | Clients isolation | As Account B, open `/clients` | Only Account B's clients; none of Account A's | `[ ] Pass [ ] Fail` |
| SEC-02 | Invoices isolation | As Account B, `GET /invoices/<Account A invoice id>` | `404 Invoice not found` | `[ ] Pass [ ] Fail` |
| SEC-03 | Income isolation | As Account B, `DELETE /income/<Account A income id>` | `404 Income not found`; Account A's row survives | `[ ] Pass [ ] Fail` |
| SEC-04 | Expenses isolation | As Account B, `DELETE /expenses/<Account A expense id>` | `404 Expense not found` | `[ ] Pass [ ] Fail` |
| SEC-05 | Wealth isolation | As Account B, `DELETE /wealth/assets/<Account A asset id>` | `404 Asset not found` | `[ ] Pass [ ] Fail` |
| SEC-06 | Dashboard isolation | Compare dashboards | Account B shows only its own totals | `[ ] Pass [ ] Fail` |
| SEC-07 | 🔒 Evidence isolation FAILS | Re-run `EVD-15` | 🐞 **SECURITY DEFECT:** Account A's document metadata and public blob URL are exposed to Account B | `[ ] Pass [ ] Fail` |
| SEC-08 | Password storage | Inspect the `users` table | `password_hash` is a bcrypt hash (`$2b$10$…`), never plaintext | `[ ] Pass [ ] Fail` |
| SEC-09 | Refresh token storage | Inspect the `refresh_tokens` table | Only SHA-256 hashes are stored, never raw tokens | `[ ] Pass [ ] Fail` |
| SEC-10 | httpOnly cookie | Run `document.cookie` in the console | The `refreshToken` cookie is **not** visible to JavaScript | `[ ] Pass [ ] Fail` |
| SEC-11 | ⚠️ Access token in localStorage | Inspect `localStorage.auth-storage` | ⚠️ The access token is readable by any script on the page (XSS exposure). Mitigated by its 2-minute lifetime; note as a design risk | `[ ] Pass [ ] Fail` |
| SEC-12 | SQL injection | Enter `'; DROP TABLE users; --` in the client search, income description and transactions search | Treated as literal text; nothing breaks (Drizzle parameterises queries) | `[ ] Pass [ ] Fail` |
| SEC-13 | Stored XSS | Create a client named `<img src=x onerror=alert(1)>` and view `/clients` and `/transactions` | Rendered as literal text; no alert fires (React escapes by default). Delete afterwards | `[ ] Pass [ ] Fail` |
| SEC-14 | Mass assignment | `POST /clients` with `{"name":"X","userId":"<other user id>"}` | `400` — `forbidNonWhitelisted` rejects `userId` | `[ ] Pass [ ] Fail` |
| SEC-15 | Rate limiting on data endpoints | 120 rapid `GET /clients` calls | The last ~20 return `429` | `[ ] Pass [ ] Fail` |
| SEC-16 | ⚠️ Default JWT secrets | Inspect `jwt.strategy.ts` / `auth.service.ts` | ⚠️ Both fall back to hardcoded development secrets when the env vars are unset. Confirm your `.env` defines `JWT_SECRET` and `JWT_REFRESH_SECRET`; log the fallback as a production risk | `[ ] Pass [ ] Fail` |
| SEC-17 | ⚠️ Insecure cookie outside production | Inspect the `refreshToken` cookie flags | `secure` is only set when `NODE_ENV=production`. Expected locally; confirm it is set in any deployed environment | `[ ] Pass [ ] Fail` |
| SEC-18 | Enumeration resistance | Compare login responses for an unknown email vs a wrong password | Identical message and status — no account enumeration | `[ ] Pass [ ] Fail` |

---

## 24. Performance & bulk data

Run on the throwaway account seeded by `CSV-18` (999 rows).

| ID | Test | Measurement | Target / note | Result |
|---|---|---|---|---|
| PRF-01 | CSV import of 999 rows | Wall-clock time from upload to success screen | Record it. The importer inserts rows one at a time in a loop — expect it to be slow | `[ ] Pass [ ] Fail` |
| PRF-02 | `/transactions` with 1,000+ rows | Time to interactive | No pagination or virtualisation — record the time and whether the browser stutters | `[ ] Pass [ ] Fail` |
| PRF-03 | `/reports` P&L with 1,000+ rows | Time to interactive | Every row renders in one table; record the time | `[ ] Pass [ ] Fail` |
| PRF-04 | `/dashboard` with 1,000+ rows | Time to interactive | Note that `GET /dashboard/summary` loads **all** income, expenses and invoices into memory to sum them | `[ ] Pass [ ] Fail` |
| PRF-05 | Search responsiveness | Type a 10-character query in `/transactions` | Ten requests fire (no debounce); check for out-of-order results overwriting each other | `[ ] Pass [ ] Fail` |
| PRF-06 | Clients page with 200+ clients | Time to interactive | `GET /clients` also loads all income and invoices to compute per-client totals — record the response time | `[ ] Pass [ ] Fail` |
| PRF-07 | Rate limit under bulk use | Rapidly navigate between all 12 pages several times | Watch for unexpected `429`s from the 100-req/min limit during normal use | `[ ] Pass [ ] Fail` |

---

## 25. Cross-browser, responsive & print

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| UX-01 | Chrome | Full pass over Sections 5–20 | No console errors, no layout breaks | `[ ] Pass [ ] Fail` |
| UX-02 | Firefox | Spot-check auth, invoice create, invoice print, CSV import | Equivalent behaviour | `[ ] Pass [ ] Fail` |
| UX-03 | Safari (if available) | Same spot-check, plus `<input type="date">` behaviour | Date pickers usable; print output correct | `[ ] Pass [ ] Fail` |
| UX-04 | Mobile 375 px | Every page | Sidebar behind hamburger; tables scroll horizontally inside their containers; the page body never scrolls sideways | `[ ] Pass [ ] Fail` |
| UX-05 | Tablet 768 px | Every page | Grids collapse to 1–2 columns sensibly | `[ ] Pass [ ] Fail` |
| UX-06 | Invoice print output | `INV-32` in each browser | Sidebar, header and buttons hidden; white background; single clean page | `[ ] Pass [ ] Fail` |
| UX-07 | Reports print output | `RPT-09` | ⚠️ Sidebar and header **are** included — no print stylesheet on this page | `[ ] Pass [ ] Fail` |
| UX-08 | Keyboard navigation | Tab through the login form, the client modal and the settings tabs | Every control is reachable; focus is visible | `[ ] Pass [ ] Fail` |
| UX-09 | Modal escape | Press `Esc` in the Add Client, Add Income, Add Expense and CSV modals | ⚠️ Record which close and which do not — the custom overlays (client/income/expense/CSV) do not handle `Esc`, while the Radix-style dialogs (wealth, evidence) do | `[ ] Pass [ ] Fail` |
| UX-10 | Long-session stability | Leave the app open for 30 minutes, then interact | Token refresh keeps the session alive; no forced logout (except on `/filing`, see `FIL-13`) | `[ ] Pass [ ] Fail` |

---

## 26. Future-plan coverage matrix

Every item in `future-plan/` mapped to its test coverage.

| Plan doc | Feature | Built? | Test cases | Gap |
|---|---|---|---|---|
| 17 | Tax Rules Engine | Partial | `TAX-13`, `TAX-14`, `TAX-16` | Table + lookup exist; no `GET /tax/rules`, no admin UI, no `threshold`/`effectiveTo` handling |
| 18 | Filing Simulator (wizard) | Yes | `FIL-01`–`FIL-15` | 5 steps built vs 8 planned; blocked by `FIL-08` |
| 19 | Wealth Reconciliation | Yes | `WLT-01`–`WLT-25` | No edit UI, no `otherAdjustments` UI; income/expenses not year-scoped (`WLT-21`) |
| 20 | Evidence Vault | Partial | `EVD-01`–`EVD-20` | No invoice attachments, no coverage indicators, no size/type enforcement, cross-user read leak |
| 21 | Financial Audit | No (folded in) | `FIL-05`, `FIL-17` | No `GET /filing/audit`; several planned checks (missing description, large uncategorised expense, CSV-unmatched income) not implemented |
| 22 | Filing Package Generator | Partial (client-side) | `FIL-10`–`FIL-12` | Screenshot PDF instead of generated reports; no server endpoint; no manifest/preview |
| 23 | Filing Checklist | API only | `FIL-16` | No UI consumes `GET /filing/checklist` |
| 24 | Tax Scenario Simulator | Yes | `TAX-01`–`TAX-09` | Expenses ignored in the maths (`TAX-06`); assumes 100% export income |
| 25 | Multi-Platform Income Consolidation | Yes | `RPT-14`, `RPT-15`, `DASH-09` | Fully delivered |
| 26 | "Can I File?" Readiness Score | Yes | `DASH-10`, `FIL-01`–`FIL-05`, `FIL-18` | All 5 v1 checks plus 2 extras present; `year` parameter ignored (`FIL-14`) |

---

## Appendix A — Known bugs, limitations and gaps

Use this as the defect backlog. Severity is the tester's suggested triage.

### 🐞 Bugs — high severity

| ID | Test | Defect |
|---|---|---|
| A-01 | `FIL-08` | Filing readiness can never reach 100% and the Download Package button is permanently disabled — step 1 reads `user.hasPseb`, a field the API never returns |
| A-02 | `INC-06` | Income logged in PKR is multiplied by 280 — a Rs 150,000 local payment is recorded as Rs 42,000,000 |
| A-03 | `EXP-05`, `EXP-06` | Two expense categories in the Add Expense dropdown (`equipment`, `taxes`) are not valid database values; saving with either fails silently |
| A-04 | `CSV-06` | Generic-format CSVs are mis-detected as Upwork format and import zero rows |
| A-05 | `INV-35` | An invalid or foreign invoice id renders a fabricated placeholder invoice instead of a 404 |
| A-06 | `SET-06` | The Security tab's password change does nothing but reports success |
| A-07 | `EVD-15` / `SEC-07` | Evidence documents can be read across user accounts — the lookup ignores the requesting user |
| A-08 | `CLI-19` | Deleting a client silently deletes all of that client's invoices, with no warning in the confirmation dialog |

### 🐞 Bugs — medium / low severity

| ID | Test | Defect |
|---|---|---|
| A-09 | `INC-07` | EUR/GBP income always converts at 280, ignoring live rates |
| A-10 | `EXP-12` | Foreign-currency expenses are never converted to PKR but are summed as if they were |
| A-11 | `CLI-13` | "Lifetime Revenue (USD)" adds PKR and USD amounts together |
| A-12 | `INV-31` | "Mark as Paid" updates the UI even when the API call fails |
| A-13 | `INV-34` | Invoices with no line items display a fabricated line item |
| A-14 | `INV-13`, `NOT-10` | Duplicate invoice number surfaces a raw database error as a 500 |
| A-15 | `INV-18`, `SET-10` | The saved invoice prefix and payment terms are never used |
| A-16 | `CLI-15` | `/invoices/new?client=<id>` ignores the query parameter |
| A-17 | `INC-05`, `EXP-11` | Zero/negative amounts are rejected with no message — the modal just does nothing |
| A-18 | `AUTH-23` | Sidebar logout never calls `POST /auth/logout`; the refresh cookie and DB row persist |
| A-19 | `FIL-13` | `/filing` bypasses the shared API client, so it breaks after the 2-minute token expiry |
| A-20 | `EVD-10`, `EVD-11` | The advertised 5 MB / PDF-JPG-PNG restrictions are not enforced anywhere |
| A-21 | `EXP-01` | The Expenses table has no empty state |
| A-22 | `CLI-10`, `INV-23` | Server-side search only matches one field, so the client-side multi-field search never sees the other rows |
| A-23 | `DASH-03` | Dashboard growth percentages are hardcoded |
| A-24 | `SET-07` | The Security tab states the token expires in 15 minutes; it is 2 minutes |
| A-25 | `WLT-04` | Opening wealth is lost if the field is not blurred before navigating |
| A-26 | `EXP-07` | The expenses category filter offers "Hardware", which can never match any record |
| A-27 | `AUTH-09`, `CLI-21` | No max-length validation — over-long values surface as database 500s |
| A-28 | `SET-16`, `WLT-13`, `WLT-24`, `NOT-11` | Several pages fail silently to the console with no user-visible error |

### ⚠️ Limitations (works as built, narrower than documented)

| ID | Test | Limitation |
|---|---|---|
| A-29 | `WLT-21` | Wealth reconciliation uses all-time income and expenses regardless of the selected tax year |
| A-30 | `FIL-14`, `TAX-15` | The `year` parameter is accepted but ignored by the readiness and tax-estimate services |
| A-31 | `RPT-05` | The trend chart is fixed to the current calendar year with no selector |
| A-32 | `CSV-07` | No duplicate detection on re-import |
| A-33 | `INV-29` | Marking an invoice paid does not create an income record |
| A-34 | `TAX-06` | The tax simulator ignores hypothetical expenses |
| A-35 | `INC-10` | The Income foreign/local filter uses platform + PRC, not currency |
| A-36 | `INT-03` | No UI warning when a fallback exchange rate is in use |
| A-37 | `EVD-17` | Evidence files are stored with public access |
| A-38 | `RPT-17` | Charts are CSS bars, not the charting library the docs claim |
| A-39 | `FIL-15` | Two different readiness percentages are shown in two places |

### 🚧 Not implemented (UI inert or feature absent)

`DASH-05` period selector · `NOT-03` global search · `NOT-01` notifications · `AUTH-14` forgot password · `SET-06` password change · `SET-08` filer toggle · `SET-18` theme toggle · `SET-19` account deletion · `CLI-20` client status control · `INV-37` invoice delete UI · `INC-16` income edit · `EXP-16`/`EXP-17` expense delete/edit UI · `WLT-19` asset edit UI · `WLT-22` other-adjustments UI · `TXN-14` date-range filter · `TXN-17` pagination · `RPT-10` CSV export · `RPT-11` report date range · `RPT-12` client-breakdown UI · `TAX-16` tax-rules admin · `FIL-16` checklist UI · `FIL-17` financial audit endpoint · `EVD-18` evidence coverage · `EVD-19` invoice evidence · `INT-11` email · `INT-12` Google OAuth · `NOT-15` custom error pages

---

## Appendix B — API reference for direct testing

Base URL: `http://localhost:3001/api/v1` · Swagger: `http://localhost:3001/api/docs`

Get a token:
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"qa.primary@hisabtest.pk","password":"TestPass123!"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["accessToken"])')

curl -s http://localhost:3001/api/v1/dashboard/summary -H "Authorization: Bearer $TOKEN"
```
> The token is valid for **2 minutes** — re-run the command if a call returns 401.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | — | `{email, password (min 6), name, businessName?}` |
| POST | `/auth/login` | — | Sets the `refreshToken` cookie |
| POST | `/auth/refresh` | cookie | Rotates the refresh token |
| POST | `/auth/logout` | — | Clears the cookie only |
| GET | `/auth/me` | ✔ | Returns the full user row |
| GET | `/users/profile` | ✔ | `passwordHash` stripped |
| PATCH | `/users/profile` | ✔ | Whitelisted fields only |
| GET/POST | `/clients` | ✔ | `?search=&status=&platform=` |
| GET/PATCH/DELETE | `/clients/:id` | ✔ | |
| GET/POST | `/invoices` | ✔ | `?status=&clientId=&search=` |
| GET/DELETE | `/invoices/:id` | ✔ | |
| PATCH | `/invoices/:id/status` | ✔ | `{status: draft\|sent\|viewed\|paid\|overdue\|cancelled}` |
| GET/POST | `/income` | ✔ | `?clientId=&platform=`; POST with `invoiceId` marks the invoice paid |
| DELETE | `/income/:id` | ✔ | |
| GET/POST | `/expenses` | ✔ | `?category=` |
| DELETE | `/expenses/:id` | ✔ | |
| GET | `/transactions` | ✔ | `?search=&type=INCOME\|EXPENSE` |
| GET | `/dashboard/summary`, `/dashboard/recent-activity` | ✔ | |
| GET | `/reports/income-vs-expenses`, `/client-breakdown`, `/platform-breakdown`, `/income-consolidation` | ✔ | |
| GET | `/tax/estimate` | ✔ | `?pseb=true\|false&year=2026` |
| POST | `/tax/simulate` | ✔ | `{incomePKR, expensesPKR?, year?, pseb?}` |
| GET | `/filing/readiness`, `/filing/checklist` | ✔ | `?year=` accepted but ignored |
| GET/PATCH | `/wealth/statement` | ✔ | `?year=2026` |
| GET/POST | `/wealth/assets`, `/wealth/liabilities` | ✔ | |
| PATCH/DELETE | `/wealth/assets/:id`, `/wealth/liabilities/:id` | ✔ | |
| GET | `/wealth/reconciliation` | ✔ | `?year=2026` |
| POST | `/evidence/upload` | ✔ | multipart: `file`, `documentType`, `incomeId?`, `expenseId?`, `notes?` |
| GET | `/evidence/income/:id`, `/evidence/expense/:id` | ✔ | ⚠️ not user-scoped |
| DELETE | `/evidence/:id` | ✔ | |
| POST | `/csv/import` | ✔ | multipart `file`, or JSON `{csvText, exchangeRate?}` |
| GET | `/exchange-rate`, `/exchange-rate/convert?amount=&from=` | — | No auth guard |

---

## Appendix C — Sign-off sheet

| Section | Total cases | Pass | Fail | Blocked | Notes |
|---|---|---|---|---|---|
| 2. Environment | 5 | | | | |
| 5. Landing page | 5 | | | | |
| 6. Authentication | 25 | | | | |
| 7. Dashboard | 14 | | | | |
| 8. Clients | 23 | | | | |
| 9. Invoices | 37 | | | | |
| 10. Income | 20 | | | | |
| 11. CSV import | 20 | | | | |
| 12. Expenses | 19 | | | | |
| 13. Transactions | 17 | | | | |
| 14. Wealth | 25 | | | | |
| 15. Tax | 17 | | | | |
| 16. Filing | 18 | | | | |
| 17. Evidence vault | 20 | | | | |
| 18. Reports | 18 | | | | |
| 19. Settings | 19 | | | | |
| 20. User guide | 4 | | | | |
| 21. Notifications & errors | 15 | | | | |
| 22. Integrations | 14 | | | | |
| 23. Security | 18 | | | | |
| 24. Performance | 7 | | | | |
| 25. Cross-browser & print | 10 | | | | |
| **Total** | **367** | | | | |

**Blockers found (must fix before release):**

1. ______________________________________________
2. ______________________________________________
3. ______________________________________________

| | |
|---|---|
| Tested by | ______________________ |
| Build / commit tested | ______________________ |
| Date started | ______________________ |
| Date completed | ______________________ |
| Overall verdict | ☐ Release  ☐ Release with known issues  ☐ Do not release |
| Signature | ______________________ |
