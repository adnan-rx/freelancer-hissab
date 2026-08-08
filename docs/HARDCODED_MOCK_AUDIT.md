# FreelancerHisab — Hardcoded & Mocked Data Audit

| Feature / Location | Mocked / Hardcoded Data | Real Data Source | Current Status | Remediation Plan |
| :--- | :--- | :--- | :--- | :--- |
| **CSV Import Modal** (`csv-import-modal.tsx`) | `handleSimulateCSV` uses `setTimeout(1500ms)` and hardcodes `setParsedCount(4)`. | None | 🔵 100% Mocked | Connect to `POST /api/v1/csv/import` endpoint |
| **Dashboard Growth Rate** (`dashboard.service.ts`) | `monthlyGrowth: 12.5` | Historical monthly calculation | 🟡 Hardcoded | Calculate growth dynamically from previous month's income |
| **Exchange Rate Fallback** (`income.service.ts`, `invoices.service.ts`) | `exchangeRate = 280` fallback when rate is missing. | SBP / Currency API | 🟡 Hardcoded | Integrate `ExchangeRateService` with 24h caching |
| **Dashboard Page UI** (`dashboard/page.tsx`) | `totalIncome = 280500`, `totalExpenses = 4500` fallbacks when query array is empty. | `useDashboardSummary` API | 🔵 Mocked Fallback | Replace with empty state illustrations & onboarding cards |
| **Client List Page UI** (`clients/page.tsx`) | `defaultClients` array (TechFlow Inc., Jane Smith, Global Soft LLC). | `useClients` API | 🔵 Mocked Fallback | Render empty state when database returns 0 clients |
| **Expense List Page UI** (`expenses/page.tsx`) | Default fallback items (Nayatel Broadband 4500, Adobe Creative 15000). | `useExpenses` API | 🔵 Mocked Fallback | Render empty state when database returns 0 expenses |
| **Income List Page UI** (`income/page.tsx`) | Default fallback items (TechFlow $1000, Jane Smith $500). | `useIncome` API | 🔵 Mocked Fallback | Render empty state when database returns 0 income rows |
| **Invoice Detail Page UI** (`invoices/[id]/page.tsx`) | Fallback invoice object (Web Dev $800, Postgres $200). | `useInvoice(id)` API | 🔵 Mocked Fallback | Show 404 / Loading error if invoice ID does not exist in DB |
| **Financial Reports Page UI** (`reports/page.tsx`) | Hardcoded platform breakdown (Upwork 65%, Direct Bank 25%, Fiverr 10%) & static P&L table rows. | `usePlatformBreakdownReport` API | 🔵 Mocked Fallback | Group real transactions by platform from PostgreSQL |
| **Settings Page UI** (`settings/page.tsx`) | Form values ("Ahmed Ali", "Ahmed Web Solutions", "PK36MEZN...") stored only in local component state. | `POST /api/v1/users/profile` | ⚠️ UI Only | Wire form submission to user profile update endpoint |
