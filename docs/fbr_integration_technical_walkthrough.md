# FBR Integration: Technical Walkthrough

This document outlines the technical implementation of the Pakistani Federal Board of Revenue (FBR) compliance features within the FreelancerHisab platform. 

> [!IMPORTANT]
> **No External APIs Used**: This platform acts as an **internal calculation and readiness engine**. It simulates tax liabilities according to FBR Section 154A rules and performs wealth reconciliation based on internal tracking data. It does **not** make live HTTP API requests to the FBR IRIS portal (as those APIs are generally closed or require specialized intermediary licenses). Instead, it prepares 100% of the numbers and validation checks required for the user to manually file on IRIS.

## 1. Overall Architecture & Data Flow

The integration bridges the gap between raw financial tracking (Income, Expenses, Invoices) and tax-season compliance (Wealth Statements, Filing Readiness, Tax Calculations). 

The data flows from the base ledgers into three new major compliance engines:
1. **Wealth Reconciliation Engine**: Computes Opening Wealth + Income - Expenses vs. Declared Assets - Liabilities.
2. **Tax Simulation Engine**: Applies Section 154A (0.25% vs 1% vs slab rates) based on PSEB registration status.
3. **Filing Readiness Engine**: Performs a deep audit of the user's profile, orphaned invoices, and missing PRC/SBP codes.

## 2. Frontend Implementation

The frontend components provide the UI for data entry and simulation visualization. They are located in `apps/web/src/app/(dashboard)/`:

### `wealth/page.tsx`
- **Purpose**: Allows users to input their assets and liabilities.
- **Key Logic**: Fetches `reconciliation` status from the backend. If `reconciled` is true, the UI turns green, indicating their tracked cash flow matches their declared wealth within a 50,000 PKR tolerance threshold.

### `tax-simulator/page.tsx`
- **Purpose**: Visualizes the impact of the Section 154A IT export rules.
- **Key Logic**: Provides a toggle for `PSEB Registered`. When toggled, it refetches the `simulateTaxScenario` endpoint to show the user their tax liability at 0.25% vs standard rates.

### `filing/page.tsx`
- **Purpose**: A pre-flight checklist.
- **Key Logic**: Hits the `/v1/filing/readiness` endpoint and renders a list of checklist items. If the `score` is 100%, the user is deemed ready to manually file on the IRIS portal.

## 3. Backend Services & APIs

The core calculation logic resides in NestJS services located in `apps/api/src/modules/`:

### `wealth.service.ts`
- **Endpoints**: `/v1/wealth/assets`, `/v1/wealth/liabilities`, `/v1/wealth/statement`
- **Core Function**: `getReconciliation(userId, taxYear)`
  - Calculates `expectedClosingWealthPKR = openingWealthPKR + totalIncomePKR - totalExpensesPKR + otherAdjustmentsPKR`.
  - Compares it to `netDeclaredWealthPKR = declaredAssetsPKR - declaredLiabilitiesPKR`.
  - Determines if `abs(difference) <= 50000` (the hardcoded FBR tolerance threshold).

### `tax.service.ts`
- **Endpoints**: `/v1/tax/simulate`
- **Core Function**: `calculateTaxEstimate(userId, isPsebRegistered, taxYear)`
  - Splits income into `exportIncomePKR` (using `currency !== 'PKR'` or platforms like Upwork) and `localIncomePKR`.
  - Calls `getExportTaxRate()` which retrieves or lazily seeds the `taxRules` table for the given year (0.25% for PSEB, 1% for standard export).
  - Uses `calculateLocalTaxSlabs(income)` for local income.

### `filing.service.ts`
- **Endpoints**: `/v1/filing/readiness`, `/v1/filing/checklist`
- **Core Function**: `getReadinessScore(userId, year)`
  - Runs 7 distinct checks: missing PSEB ID, unmatched platforms, uncategorized expenses, >90 days overdue invoices, fallback exchange rates, missing SBP/PRC codes on foreign income, and orphaned paid invoices.
  - Generates a weighted score out of 100 with distinct "WARNING" or "INFO" severity flags.

## 4. Database Schema

The implementation relies on several new Drizzle ORM schemas in `apps/api/src/database/schema/`:

- **`assets` & `liabilities`**: Tracks user-declared holdings. Belongs to a user and a specific `taxYear`.
- **`wealthStatements`**: Stores the high-level reconciliation modifiers like `openingWealthPKR` and `otherAdjustmentsPKR`.
- **`taxRules`**: A dynamic rule engine table. Stores `incomeType` (e.g., `IT_EXPORT_PSEB`) and `rate` (e.g., `0.0025`), effective from a specific date. This prevents hardcoding tax rates forever, allowing the app to adjust if FBR changes the 0.25% rule next year.
- **`evidenceDocuments`**: Designed for future use to store physical scans of PRC certificates.

## 5. Error Handling & Limitations

- **No FBR API**: As stated, no live sync is possible. Users must transpose the numbers from the `Tax Simulator` and `Wealth Reconciliation` pages into the FBR IRIS web portal.
- **Simplistic Local Tax Slabs**: The `calculateLocalTaxSlabs` in `tax.service.ts` is hardcoded to standard generic salaried/business individual slabs for 2024-2025. It does not account for complex localized deductions beyond standard business expenses.
- **Currency Handling**: The wealth reconciliation assumes all tracked income has already been converted to PKR via the `amountPKR` field. If the user overrides rates incorrectly during invoice creation, their wealth reconciliation will mismatch.
