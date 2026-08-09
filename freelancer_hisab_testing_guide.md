# FreelancerHisab Comprehensive Testing Guide

This guide outlines the step-by-step procedures for testing each feature in the FreelancerHisab application. It includes the expected behavior, necessary test data, and user flows.

## Test Data Preparation

For a smooth testing experience, you can use the following mock data. 

### 1. User Accounts (Authentication)
* **Freelancer User (Active)**
  * **Email:** `test.freelancer@example.com`
  * **Password:** `StrongPass123!`
  * **Name:** `Ahmed Khan`
* **New User (For Registration Test)**
  * **Email:** `new.user@example.com`
  * **Password:** `Test@1234`
  * **Name:** `Sara Ali`

### 2. Clients
| Client Name | Email | Country | Currency | Status |
| :--- | :--- | :--- | :--- | :--- |
| TechNova LLC | billing@technova.com | USA | USD | Active |
| DesignStudio UK | accounts@designstudio.co.uk | UK | GBP | Active |
| Local Biz PK | local@biz.pk | Pakistan | PKR | Inactive |

### 3. Income & Invoices
| Invoice # | Client | Amount | Date | Status | SBP Remittance Code |
| :--- | :--- | :--- | :--- | :--- | :--- |
| INV-2026-001 | TechNova LLC | $2,500 | 2026-08-01 | Paid | IT/Software (9151) |
| INV-2026-002 | DesignStudio UK | £1,200 | 2026-08-05 | Pending | IT/Software (9151) |
| INV-2026-003 | Local Biz PK | Rs. 150,000| 2026-08-08 | Draft | N/A |

### 4. Expenses
| Date | Category | Description | Amount (PKR) | Payment Method |
| :--- | :--- | :--- | :--- | :--- |
| 2026-08-02 | Internet | Nayatel Monthly Bill | 4,500 | Bank Transfer |
| 2026-08-04 | Software | GitHub Pro | 1,120 | Credit Card |
| 2026-08-07 | Hardware | New Monitor | 45,000 | Cash |

### 5. Wealth / Assets
| Asset Name | Type | Current Balance | Currency |
| :--- | :--- | :--- | :--- |
| Meezan Bank | Bank Account | 1,250,000 | PKR |
| Payoneer | E-Wallet | 3,450 | USD |
| Binance | Crypto | 1,200 | USDT |
| Al Meezan | Mutual Fund | 500,000 | PKR |

---

## Testing Workflows

### 1. Authentication (`/login`, `/register`)
* **Test Registration:** Go to the register page. Enter the New User data. 
  * *Expected:* Success message, redirect to the dashboard, and a JWT token should be stored.
* **Test Login:** Go to the login page. Enter the Freelancer User data.
  * *Expected:* Successful login, redirect to `/dashboard`.
* **Test Invalid Login:** Enter wrong credentials.
  * *Expected:* Error toast/message indicating invalid credentials.

### 2. Dashboard (`/dashboard`)
* **Test Overview Cards:** Verify that Total Income, Total Expenses, and Net Savings show up correctly.
  * *Expected:* Values should match the sum of the dummy data added in later steps.
* **Test Charts:** Check if the Monthly Income/Expense chart renders properly.
  * *Expected:* Visual data representation should exist without crashing.

### 3. Client Management (`/clients`)
* **Test Adding a Client:** Click "Add Client". Enter `TechNova LLC` data.
  * *Expected:* Client appears in the list.
* **Test Editing:** Click edit on `TechNova LLC`, change status to Inactive.
  * *Expected:* Client list reflects the change.

### 4. Invoices (`/invoices`)
* **Test Creating Invoice:** Create `INV-2026-001` using the test data.
  * *Expected:* Invoice is saved, total calculates correctly based on quantity and rate.
* **Test PDF Generation:** Click the download/PDF button on the invoice.
  * *Expected:* A well-formatted PDF is downloaded.
* **Test Status Update:** Mark `INV-2026-002` as "Paid".
  * *Expected:* Status changes to Paid, and it is logged as Income.

### 5. Income Tracking (`/income`)
* **Test Logging Income Manually:** Add an income entry that is NOT tied to an invoice (e.g., direct Upwork transfer).
  * *Expected:* Income reflects in the total balance.
* **Test SBP Remittance Filter:** Filter income by PRC/Remittance status.
  * *Expected:* Only foreign transactions should appear.

### 6. Expense Tracking (`/expenses`)
* **Test Adding Expenses:** Add the expenses from the test data table.
  * *Expected:* Total expenses amount updates.
* **Test Categorization:** Filter expenses by "Software" or "Hardware".
  * *Expected:* Only related expenses show up.

### 7. Wealth Management (`/wealth`)
* **Test Asset Creation:** Add a new asset (e.g., `Meezan Bank`).
  * *Expected:* The asset appears in the list and the Total Net Worth updates.
* **Test Multi-Currency:** Ensure `Payoneer (USD)` is converted to PKR in the total net worth calculation (based on an assumed or live exchange rate).
* **Test Value Update:** Update the `Al Meezan` mutual fund balance to `550,000`.
  * *Expected:* Net worth increases by 50,000.

### 8. Tax Simulator & Filing (`/tax-simulator`, `/filing`)
* **Test FBR Calculation:** Enter total local income and total foreign income (IT export).
  * *Expected:* The simulator correctly applies the 1% (or 0.25% if registered) tax rule on IT exports, and standard slab rates on local income.
* **Test Tax Report Generation:** Generate a tax report for the year 2026.
  * *Expected:* A summary suitable for FBR Iris filing is produced.

### 9. Reports (`/reports`)
* **Test Profit & Loss:** Generate a P&L statement for August 2026.
  * *Expected:* Income minus Expenses should equal Net Profit.
* **Test Exporting:** Export the report as CSV/PDF.
  * *Expected:* The downloaded file contains the correct tabular data.

### 10. Settings (`/settings`)
* **Test Profile Update:** Change the user's name or business name.
  * *Expected:* Changes persist and reflect across the app (e.g., on newly generated invoices).
* **Test Currency Preference:** Change default currency.
  * *Expected:* Dashboard metrics update to reflect the new currency (if supported).
