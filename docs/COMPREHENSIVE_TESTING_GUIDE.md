# FreelancerHisab — Core Testing Guide

This guide focuses on verifying the core, high-priority features of FreelancerHisab. Execute these test cases to ensure the primary user journey is functioning correctly.

---

## 1. Master Test Data
To ensure connected features work seamlessly, use this test data:
*   **User:** Adnan Niaz (`adnan.test@example.com` / `SecurePass123!`) - *PSEB Registered*
*   **Clients:** 
    *   `TechNova US` (USD, Foreign/Export)
    *   `Local Biz PK` (PKR, Local)
*   **Transactions:** 
    *   Income: $2,500 via Upwork (SBP: 9151)
    *   Expense: Rs. 4,500 (Internet)

---

## 2. Core Test Cases (Prioritized)

### P0: Authentication & Onboarding
| Test | Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- |
| **Register** | Register a new account using the Master Test Data. | Account is created, user is redirected to the Dashboard, and a JWT is stored. | [ ] |
| **Login** | Log out, then log back in using the created credentials. | Successful login redirects to Dashboard. Invalid passwords show a clear error. | [ ] |

### P0: Income & Expense Management (The Ledger)
| Test | Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- |
| **Log Foreign Income** | Navigate to `/income`. Add $2,500 from Upwork (SBP: 9151, PRC Ref: PRC-123). | Income is saved. USD is automatically converted to PKR using live rates. | [ ] |
| **Log Expense** | Navigate to `/expenses`. Add Rs. 4,500 for Internet (Nayatel). | Expense is saved. Total expenses metric on Dashboard updates. | [ ] |
| **CSV Import** | Click "Import CSV" on the Income page and upload an Upwork CSV. | Earnings and fees are successfully split into Income and Expenses automatically. | [ ] |

### P0: Client Management & Invoicing
| Test | Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- |
| **Add Client** | Navigate to `/clients`. Add `TechNova US` (USD). | Client is listed in the directory and appears in the invoice client dropdown. | [ ] |
| **Create Invoice** | Navigate to `/invoices/new`. Select `TechNova US`. Add an item for $1,000. Save. | Invoice is created with "Sent" or "Pending" status. Totals calculate correctly. | [ ] |
| **Export PDF & Pay**| View the invoice, click "Export PDF", then click "Mark as Paid". | PDF downloads cleanly. Invoice status changes to "Paid". | [ ] |

### P0: Tax Simulation & Reporting (The "Hisab")
| Test | Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- |
| **FBR Export Tax** | Go to `/tax-simulator`. With PSEB enabled, check the tax on the $2,500 income. | Tax engine strictly applies the 0.25% IT Export tax rate, calculating the exact PKR liability. | [ ] |
| **Dashboard KPIs** | Navigate to `/dashboard`. Verify the top KPI cards. | Total Income, Expenses, and Net Savings match the sum of transactions exactly. | [ ] |
| **P&L Report** | Navigate to `/reports` and select "Year to Date". | Profit & Loss table accurately reflects income minus expenses. | [ ] |

---

## 3. Secondary Features (P1)
If the core workflows pass, quickly verify these secondary flows:
1.  **Settings Profile:** Update the IBAN and PSEB number in `/settings` and ensure they reflect on freshly generated invoice PDFs.
2.  **Wealth Reconciliation (If enabled):** Add a Bank Asset and verify the Net Worth accurately sums PKR and converted USD balances.
3.  **Global Error Handling:** Briefly turn off your internet/backend and try to save a client to ensure a graceful error toast appears instead of a crash.
