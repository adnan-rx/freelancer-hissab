# FreelancerHisab — Complete Master Test Data Set

This document contains a comprehensive set of realistic mock data. Use this data across all modules (Clients → Invoices → Income → Wealth) to ensure that relationships work correctly and dashboard metrics calculate accurately.

---

## 1. User Accounts & Profiles
Use these to test registration, login, and multi-tenant data isolation.

| Profile Type | Full Name | Business Name | Email | Password | PSEB Status | Bank / IBAN |
|---|---|---|---|---|---|---|
| **Primary** | Adnan Niaz | Apex Tech Solutions | `qa.primary@hisabtest.pk` | `TestPass123!` | Registered (0.25%) | Meezan Bank (`PK36MEZN0001020304050607`) |
| **Secondary** | Sara Khan | SK Studio | `qa.second@hisabtest.pk` | `TestPass123!` | Unregistered (1.0%)| Standard Chartered (`PK12SCBL0001`) |

---

## 2. Client Directory
Populate these clients first so they can be referenced in Invoices and Income.

| Ref | Contact Name | Company Name | Email | Phone | Platform | Currency |
|---|---|---|---|---|---|---|
| **C1** | TechFlow Labs | TechFlow Labs LLC | `billing@techflow.example` | `+1 415 555 0199` | Upwork Escrow | USD |
| **C2** | Horizon Media | Horizon Media Pvt | `accounts@horizonmedia.example` | `+44 20 7946 0102` | Direct Client (Bank) | USD |
| **C3** | Lahore Digital | Lahore Digital (Pvt) Ltd | `finance@lahoredigital.example` | `+92 42 3577 1234` | Direct | PKR |

---

## 3. Invoices
Create these invoices by selecting the clients created in Step 2.

| Ref | Client | Invoice # | Due Date | Currency | Line Item | Qty | Unit Price | Tax | Discount |
|---|---|---|---|---|---|---|---|---|---|
| **INV-A** | TechFlow Labs (C1) | `QA-2026-0001` | `2026-08-31` | USD | `Sprint 1 – Fullstack Engineering` | 40 | 50 | 0% | 0 |
| **INV-B** | Horizon Media (C2) | `QA-2026-0002` | `2026-09-15` | USD | `UI/UX Redesign – Phase 1` | 1 | 1200 | 5% | 100 |
| **INV-C** | Lahore Digital (C3) | `QA-2026-0003` | `2026-09-01` | PKR | `Monthly retainer – August` | 1 | 150000 | 0% | 0 |

---

## 4. Income (Ledger)
Log these foreign and local remittances to test the FBR tax calculator and SBP purpose codes.

| Ref | Date | Platform | Description | Client | Amount | Currency | SBP Code | PRC Ref |
|---|---|---|---|---|---|---|---|---|
| **INC-1** | `2026-08-01` | Upwork | `Sprint 1 milestone – TechFlow Labs` | TechFlow Labs | 2000 | USD | 9100 | `PRC-2026-0001` |
| **INC-2** | `2026-08-05` | Direct Bank | `UI/UX redesign – Horizon Media` | Horizon Media | 1160 | USD | 9100 | *(leave blank to test errors)* |
| **INC-3** | `2026-08-10` | Fiverr | `Logo Design` | TechFlow Labs | 500 | USD | 9151 | `PRC-2026-0002` |
| **INC-4** | `2026-08-15` | Direct | `Local App Development` | Lahore Digital | 150000 | PKR | N/A | N/A |

---

## 5. Expenses (Ledger)
Log these business operating expenses to test categorizations and P&L calculations.

| Ref | Date | Category | Description | Vendor | Amount | Currency | Payment Method |
|---|---|---|---|---|---|---|---|
| **EXP-1** | `2026-08-02` | Utility | `Nayatel Fiber – August` | `Nayatel` | 4500 | PKR | Credit Card |
| **EXP-2** | `2026-08-04` | Software | `GitHub Team subscription` | `GitHub` | 11200 | PKR | Bank Transfer |
| **EXP-3** | `2026-08-06` | Rent | `Co-working desk – August` | `Kickstart` | 15000 | PKR | Cash |

---

## 6. Wealth & Assets
Use these values to verify the multi-currency Net Worth reconciliations.

| Asset Name | Asset Type | Current Balance | Currency | Notes |
|---|---|---|---|---|
| **Meezan Bank Current Acc** | Bank Account | 1,200,000 | PKR | Primary checking account |
| **Payoneer** | E-Wallet | 4,500 | USD | Holds foreign income |
| **Binance** | Crypto | 1,200 | USDT | Trading funds / crypto assets |
| **Bank Alfalah Car Loan** | Liability | 900,000 | PKR | Deducts from Net Worth |
