# FreelancerHisab — Testing Guide

**Audience:** QA tester with no prior codebase knowledge
**How to use:** Work top to bottom. Sections are ordered by importance — core money flow (Auth → Clients → Invoices → Income/Expenses) first, compliance features (Tax → Wealth → Filing → Evidence) second, everything else last. Set up the test data in Section 2 once; every later section reuses it.

`[ ] Pass  [ ] Fail  [ ] Blocked`

---

## 1. Setup

```bash
cd apps/api && npm run db:migrate && npm run dev   # http://localhost:3001/api/v1
cd apps/web && npm run dev                          # http://localhost:3000
```

Required in `apps/api/.env`: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `BLOB_READ_WRITE_TOKEN` (for Evidence Vault).

⚠️ Don't run `npm run db:seed` if you have data worth keeping — it wipes income/expenses/invoices/clients for every user in the database.

| # | Check | Expected | Result |
|---|---|---|---|
| 1 | Open `http://localhost:3000` | Landing page loads, no console errors | |
| 2 | Open `http://localhost:3001/api/docs` | Swagger UI lists all endpoints | |

---

## 2. Test data (create once, reuse everywhere)

**Account:** `qa@hisabtest.pk` / `TestPass123!` — Name `Adnan Niaz`, Business `Apex Tech Solutions`

**Clients:**
| Name | Platform | Currency |
|---|---|---|
| TechFlow Labs | Upwork | USD |
| Horizon Media | Direct | USD |
| Lahore Digital | Other | PKR |

**Income** (log via `/income`, let the exchange rate auto-convert — don't override it):
| Client | Amount | Currency | Platform | SBP Code | PRC Ref |
|---|---|---|---|---|---|
| TechFlow Labs | 2000 | USD | upwork | 9100 | PRC-2026-0001 |
| Horizon Media | 1160 | USD | direct | 9100 | *(leave blank — used later to test the readiness check)* |

**Expenses** (`/expenses`):
| Description | Category | Amount | Currency |
|---|---|---|---|
| Nayatel Fiber | Internet | 4500 | PKR |
| GitHub Team | Software | 11200 | PKR |
| Co-working desk | Office | 15000 | PKR |

**Invoice:** Client TechFlow Labs, 1 item "Sprint 1" × 40hrs @ $50, currency USD.

---

## 3. Authentication

| # | Test | Steps | Expected | Result |
|---|---|---|---|---|
| 1 | Register | Fill the form, submit | Redirects to `/dashboard`, session persists on reload | |
| 2 | Login | Correct credentials | Redirects to `/dashboard` | |
| 3 | Wrong password | Bad password | Generic "Invalid email or password" — must not reveal whether the account exists | |
| 4 | Route guard | Log out, visit `/dashboard` directly | Redirects to `/login` | |
| 5 | Session refresh | Log in, wait 3 minutes idle, click any nav link | Page loads normally (access token auto-refreshes) | |
| 6 | Logout | Click logout in sidebar | Redirects to `/login`, protected routes no longer reachable | |
| 7 | Password rules | Register with a 5-char password | Rejected: must be ≥8 chars with a letter and a number | |
| 8 | Duplicate email | Register the same email twice | "Email address is already registered" | |

---

## 4. Dashboard

| # | Test | Steps | Expected | Result |
|---|---|---|---|---|
| 1 | Empty state | Fresh account | All KPIs show Rs 0, no crash | |
| 2 | KPI accuracy | With test data | Total Income, Expenses, Net Profit match what you logged | |
| 3 | Readiness banner | With PSEB ID saved in Settings | Shows a percentage; "Fix Issues" links to `/filing` | |
| 4 | Recent transactions | Check the table | Shows your 5 most recent income/expense entries | |
| 5 | Quick actions | Click "Create Invoice", "Log Expense", "Add Client" | Each navigates correctly | |
| 6 | API down | Stop the API, reload | Falls back to zeros/empty states, no white screen | |

---

## 5. Clients

| # | Test | Steps | Expected | Result |
|---|---|---|---|---|
| 1 | Create | Add the 3 test clients | All appear immediately in the table | |
| 2 | Edit | Change a client's company name | Updates without reload | |
| 3 | Search | Search by name, email, or company | Matches on all three fields | |
| 4 | Delete — no relations | Delete a client with no invoices/income | Confirms once, deletes | |
| 5 | Delete — has relations | Delete a client that has invoices or income | Warns exactly what will be affected before allowing it | |
| 6 | Create invoice from row | Click the invoice icon on a client row | Opens `/invoices/new` with that client pre-selected | |
| 7 | Status | Set a client to Archived | Badge updates, persists on reload | |

---

## 6. Invoices

| # | Test | Steps | Expected | Result |
|---|---|---|---|---|
| 1 | Create | Fill the form per test data, save | Redirects to list; totals in USD and PKR are correct | |
| 2 | Live exchange rate | Watch the rate field while creating | Auto-fills from live rates; editable | |
| 3 | Line items | Add/remove rows | Totals recalculate live | |
| 4 | Validation | Try to submit with a blank description, or a negative rate | Blocked with a clear message | |
| 5 | Duplicate number | Reuse an existing invoice number | Friendly error, not a raw database message | |
| 6 | View detail | Open an invoice | Shows your business name/email, client info, line items, PKR conversion | |
| 7 | Mark as paid | Click "Mark as Paid" | Status updates; if it fails, the UI does not falsely show "paid" | |
| 8 | Export PDF | Click Export/Print | Clean printable layout — no sidebar/buttons in the output | |
| 9 | Invalid invoice ID | Visit `/invoices/<random-uuid>` | Shows "not found", not a fabricated invoice | |

---

## 7. Income & Expenses (the core money ledger)

This is the most important section — every tax and compliance number downstream depends on this data being correct.

| # | Test | Steps | Expected | Result |
|---|---|---|---|---|
| 1 | Log foreign income | Log $2000 USD via Upwork | Converts to PKR at the live/cached rate (not a hardcoded number) | |
| 2 | Log local income | Log Rs 150,000 in PKR currency | Shows exactly Rs 150,000 converted — **not** multiplied by any rate | |
| 3 | Edit income | Click the pencil icon on an entry, change the amount | Saves and recalculates its PKR value | |
| 4 | Delete income | Delete an entry, confirm | Removed, dashboard totals update | |
| 5 | SBP/PRC fields | Log foreign income leaving PRC blank | Saves; will show up as a filing readiness warning later | |
| 6 | Log expense | Add all 3 test expenses across different categories | Each saves correctly, no category silently fails | |
| 7 | Edit expense | Change an expense's amount/category | Saves | |
| 8 | Delete expense | Delete with confirmation | Removed, totals update | |
| 9 | Foreign expense | Log a $45 USD expense | Converts to PKR (not treated as Rs 45) | |
| 10 | Zero/negative amount | Try amount 0 or -100 | Rejected with a visible error message | |

---

## 8. CSV Import

| # | Test | Steps | Expected | Result |
|---|---|---|---|---|
| 1 | Import demo statement | Clients → "Auto-Import" → "Import Demo Statement" | Creates income + expense rows + new clients | |
| 2 | Import Upwork CSV | Upload `sample_upwork_statement.csv` | Parses earnings as income, fees as expenses | |
| 3 | Import generic CSV | Upload `sample_generic_financial_statement.csv` | Parses correctly regardless of column order | |
| 4 | Bad file | Upload a `.txt` or empty file | Clear rejection message, no crash | |
| 5 | Currency handling | Import a file with mixed USD/PKR rows | Each currency converts at its own rate | |

---

## 9. Transactions (unified ledger)

| # | Test | Steps | Expected | Result |
|---|---|---|---|---|
| 1 | Combined feed | Open `/transactions` | Shows income and expenses together, newest first | |
| 2 | Filter by type | Filter to Income Only / Expenses Only | Correct subset shown | |
| 3 | Search | Search by description, entity, or category | Matches correctly | |
| 4 | Currency consistency | Compare an income row to an expense row | Both display PKR-normalized amounts | |

---

## 10. Tax Simulator & Tax Estimate

| # | Test | Steps | Expected | Result |
|---|---|---|---|---|
| 1 | Tax estimate | Check `/reports` tax card with test data | ~Rs 2,212 (0.25% of $2000+$1160 @ ~280) | |
| 2 | PSEB toggle | Toggle PSEB off in the simulator | Export rate jumps from 0.25% to 1% | |
| 3 | Export vs local | Simulate with both export and local income + expenses | Expenses only reduce the local-income tax, never the export tax (this is the correct FBR rule) | |
| 4 | Zero/negative input | Try a negative income figure | Rejected or clamped, never a negative tax result | |

---

## 11. Wealth Management

| # | Test | Steps | Expected | Result |
|---|---|---|---|---|
| 1 | Add assets/liabilities | Add a bank account and a loan | Totals update | |
| 2 | Reconciliation | Set opening wealth so assets ≈ income − expenses | Shows "Wealth Reconciled" | |
| 3 | Mismatch | Set opening wealth to something far off | Shows the gap amount and "Wealth Mismatch" | |
| 4 | Tax year scoping | Switch tax year | Only that year's income/expenses count toward reconciliation | |
| 5 | Delete asset/liability | Delete one | Removed, totals update | |

---

## 12. Filing Simulator & Readiness Score

| # | Test | Steps | Expected | Result |
|---|---|---|---|---|
| 1 | Score with clean data | Save a PSEB ID, add a PRC to every foreign income entry, reconcile wealth, attach evidence | Score reaches 100% | |
| 2 | Missing PSEB | Clear the PSEB field in Settings | "Personal Information" step goes incomplete | |
| 3 | Missing PRC | Leave a foreign income entry without a PRC reference | "Financial Audit" step flags it, links to `/income` | |
| 4 | Wealth gap | Un-reconcile wealth (Section 11) | "Wealth Reconciliation" step goes incomplete | |
| 5 | Download package | Click "Download Tax Package" | Downloads a ZIP with a tax summary, income/expense reports, and a CSV ledger | |
| 6 | Session survives | Wait past token expiry, click Refresh | Still loads correctly (doesn't silently fail) | |

---

## 13. Evidence Vault

| # | Test | Steps | Expected | Result |
|---|---|---|---|---|
| 1 | Upload | Click "Evidence" on an income/expense row, upload a PDF | Appears in the document list | |
| 2 | Open document | Click the uploaded file | Opens correctly | |
| 3 | Delete document | Remove it | Gone from the list | |
| 4 | Oversized file | Upload a file >5MB | Rejected | |
| 5 | Wrong file type | Try to upload a `.exe` renamed to `.pdf` | Rejected | |
| 6 | Cross-account isolation | Log in as a second account, try to fetch the first account's evidence via direct API call | Returns nothing — not accessible | |

---

## 14. Reports

| # | Test | Steps | Expected | Result |
|---|---|---|---|---|
| 1 | P&L accuracy | Open `/reports` | Income, expenses, net profit match test data | |
| 2 | Monthly trend | Check the trend chart | Shows the correct tax-year months with data | |
| 3 | Platform breakdown | Check the platform distribution | Percentages match your logged platforms | |
| 4 | Empty state | Fresh account | Empty-state message, no crash | |

---

## 15. Settings

| # | Test | Steps | Expected | Result |
|---|---|---|---|---|
| 1 | Profile save | Update name/phone, save | Persists on reload, sidebar name updates | |
| 2 | Bank & PSEB | Save bank name, IBAN, PSEB ID | Persists; invalid IBAN format is rejected with a message | |
| 3 | Invoicing prefs | Change invoice prefix/footer, then create a new invoice | The new invoice uses your saved prefix and footer | |
| 4 | Password change | Enter current + new password, submit | Changes successfully; old password no longer works | |
| 5 | Wrong current password | Enter an incorrect current password | Rejected with a clear message | |

---

## 16. Known limitations (not bugs — not built)

Don't file these as defects, just be aware they don't exist yet:

- No email delivery (invoices aren't emailed to clients)
- No Google OAuth login
- No "forgot password" flow
- No real-time notifications (the bell is a placeholder)
- No global search (header search box is not wired up)
- No CSV export button on the Reports page
- No date-range filter or pagination on Transactions/Reports
- Evidence Vault only attaches to income/expenses, not invoices
- Tax rate changes require an admin account and are API-only (no admin UI page)

---

## Sign-off

| | |
|---|---|
| Tested by | |
| Date | |
| Verdict | ☐ Release ☐ Release with known issues ☐ Do not release |
