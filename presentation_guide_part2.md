# FreelancerHisab — Presentation Guide (Part 2: Cheat Sheet & Demo)

## SECTION D: WORKED EXAMPLE (Use This On Stage)

### Meet "Ahmed" — A Pakistani Freelance Developer

**Profile:**
- Works on Upwork and has one direct client in Dubai
- PSEB-registered (PSEB ID: PSEB-2026-12345)
- Banks with Meezan Bank (IBAN: PK36MEZN...)
- Tax Year 2026 (July 2025 – June 2026)

**His income this tax year:**

| Source | Platform | Currency | Amount | Rate | PKR Amount |
|--------|----------|----------|--------|------|------------|
| Upwork client (TechFlow) | Upwork | USD | $1,200 | 280.50 | ₨336,600 |
| Fiverr client (Jane Smith) | Fiverr | USD | $650 | 280.00 | ₨182,000 |
| Direct client (Global Soft Dubai) | Direct wire | USD | $2,500 | 279.50 | ₨698,750 |
| Local client (Khadim & Sons) | Direct | PKR | — | 1.0 | ₨200,000 |
| **Total** | | | | | **₨1,417,350** |

**His expenses:**

| Expense | Amount PKR |
|---------|------------|
| Nayatel Internet | ₨5,500 |
| Adobe Creative Cloud | ₨18,500 |
| GitHub Copilot + Vercel | ₨8,200 |
| Co-working space | ₨25,000 |
| **Total** | **₨57,200** |

### Step-by-Step Tax Calculation

**Step 1: Classify income**
- Export income: ₨336,600 + ₨182,000 + ₨698,750 = **₨1,217,350** (all foreign currency)
- Local income: **₨200,000** (PKR from Khadim & Sons)

**Step 2: Export tax (Section 154A)**
- Ahmed is PSEB-registered → rate = **0.25%**
- Export tax = ₨1,217,350 × 0.0025 = **₨3,043**
- If he WASN'T PSEB-registered: ₨1,217,350 × 0.01 = ₨12,174
- **PSEB saves him: ₨12,174 - ₨3,043 = ₨9,131** ← great demo moment

**Step 3: Local tax (progressive slabs)**
- Local taxable income = ₨200,000 - ₨57,200 = **₨142,800**
- This is below the ₨600,000 threshold → **₨0 local tax**

**Step 4: Total**
- Total tax liability = ₨3,043 + ₨0 = **₨3,043**
- Effective tax rate = ₨3,043 / ₨1,417,350 = **0.21%**

**Key talking point:** "Ahmed earned over ₨14 lakh and pays just ₨3,043 in tax — legally — because PSEB registration gives him the lowest IT export rate in Pakistan."

### Wealth Reconciliation

| Line Item | Amount |
|-----------|--------|
| Opening wealth (July 1, 2025) | ₨500,000 |
| + Total income | ₨1,417,350 |
| - Total expenses | ₨57,200 |
| + Other adjustments | ₨0 |
| = **Expected closing wealth** | **₨1,860,150** |

Ahmed declares these assets:
- Meezan Bank savings: ₨1,400,000
- Cash at home: ₨100,000  
- Laptop + equipment: ₨350,000

Liabilities: ₨0

**Declared net wealth = ₨1,850,000**

**Difference = ₨1,850,000 - ₨1,860,150 = -₨10,150**

Since |₨10,150| < ₨50,000 tolerance → **✅ RECONCILED**

---

## SECTION E: PRESENTATION SCRIPTS

### E1. 30-Second Elevator Pitch

> "Pakistani freelancers earning through Upwork and Fiverr face a unique problem: FBR requires them to file taxes using Pakistani-specific rules — Section 154A export tax rates, SBP remittance codes, and wealth reconciliation — but there's no tool designed for this. They use spreadsheets, overpay taxes, or skip filing entirely.
>
> FreelancerHisab is a financial operating system that takes a freelancer from receiving a payment to being ready to file on FBR IRIS — with automated USD-to-PKR conversion, real-time tax simulation showing exactly what they owe, and a wealth reconciliation engine that catches the same mismatches FBR auditors look for. Built with NestJS, Next.js, and PostgreSQL."

### E2. 2-Minute Product Explanation

> "Let me walk you through what happens when a freelancer uses FreelancerHisab.
>
> First, they import their Upwork or Fiverr earnings statement — just upload the CSV. The system automatically separates earnings from platform fees, creates client records, converts everything to PKR using live exchange rates, and logs it all as proper income and expense entries.
>
> Every transaction gets tagged with Pakistan-specific compliance fields — the SBP purpose code 9100 for software exports, and a slot for the PRC reference number from their bank.
>
> Now here's where it gets interesting. The Tax Simulator shows them exactly what they owe FBR under Section 154A. Export income is taxed at a flat 0.25% if they're PSEB-registered — just 0.25% on gross proceeds, final tax, done. If they also have local clients paying in PKR, those go through progressive tax slabs after deducting business expenses.
>
> The Wealth Reconciliation page does something most freelancers never do proactively — it checks whether their declared assets minus liabilities match their opening wealth plus income minus expenses. This is exactly what FBR checks during audits. We flag the mismatch before FBR does.
>
> Finally, the Filing Readiness Score runs 9 automated checks — missing PSEB ID, export payments without PRC references, invoices marked paid without income records — and gives them a percentage. At 100%, they have everything they need to log into IRIS and file.
>
> The whole thing runs as a Turborepo monorepo — NestJS 11 API with Drizzle ORM on PostgreSQL, Next.js 15 frontend with TanStack Query and Zustand, deployed on Vercel plus Railway."

### E3. 5-Minute Technical Walkthrough

Use this order:

1. **Open the Dashboard** (30s) — Show total income, expenses, net profit. Point out these are real PKR values, not mocked.

2. **Import a CSV** (45s) — Upload `sample_upwork_statement.csv`. Show how it creates income entries with correct exchange rates and separates platform fees as expenses.

3. **Navigate to Income page** (30s) — Show PRC reference number and SBP purpose code fields on an income entry. "These are Pakistan-specific compliance fields."

4. **Open Tax Simulator** (60s) — Toggle PSEB on/off to show the rate change (0.25% → 1%). Show PSEB savings amount. Run a "what-if" scenario: "What if I take a $15,000 project?" Show how tax changes. Explain: "Export tax is on gross — expenses don't reduce it. That's the actual Section 154A rule."

5. **Open Wealth page** (45s) — Show assets and liabilities. Point to the reconciliation: "Expected closing wealth based on income minus expenses vs declared assets. Green means it reconciles within ₨50,000 tolerance."

6. **Open Filing Readiness** (45s) — Show the checklist and score. Point to any warnings. "Each issue links directly to where to fix it. At 100%, you're ready for IRIS."

7. **Close with architecture** (45s) — "Turborepo monorepo, NestJS 11, Drizzle ORM, Next.js 15 App Router. Tax rates stored in a rules engine table, not hardcoded, so when FBR changes rates in the next Finance Act, we update one database row. All calculations filter by Pakistan's July–June tax year. Every query is scoped by userId — this is built for multi-tenant from day one."

---

## SECTION F: TERMINOLOGY CHEAT SHEET

| Term | Plain English | Where in Our App |
|------|-------------|------------------|
| Section 154A | The law that gives IT exporters a flat tax rate | `tax.service.ts` → `getExportTaxRate()` |
| PSEB | "Verified IT exporter" badge → unlocks 0.25% rate | `users.isFiler` + `users.psebId` |
| PRC | Bank receipt proving foreign money arrived legally | `income.prcReferenceNumber` |
| SBP Purpose Code | Code telling the central bank WHY money entered Pakistan | `income.sbpPurposeCode` (default: 9100) |
| Tax Year 2026 | July 1, 2025 – June 30, 2026 | `tax-year.ts` → `taxYearRange()` |
| Wealth Statement | "Prove your net worth matches your earnings" | `wealth.service.ts` → `getReconciliation()` |
| IRIS | FBR's web portal where you actually file | We prepare data; user files there manually |
| Final Tax | "This percentage IS your total tax — nothing more to pay" | Export tax under 154A |
| Progressive Slabs | Higher income = higher percentage (in brackets) | `calculateLocalTaxSlabs()` |
| NTN | National Tax Number — your FBR ID | Not stored in our app (user brings this to IRIS) |

---

## SECTION G: KEY FORMULAS TO KNOW

```
Export Tax = exportIncomePKR × (0.25% or 1.0%)

Local Taxable Income = max(0, localIncomePKR - totalExpensesPKR)
Local Tax = slab_calculation(Local Taxable Income)

Total Tax = Export Tax + Local Tax

PSEB Savings = exportIncomePKR × (1.0% - 0.25%)

Expected Closing Wealth = Opening Wealth + Income - Expenses + Adjustments
Declared Wealth = Total Assets - Total Liabilities
Wealth Difference = Declared Wealth - Expected Closing Wealth
Reconciled = |difference| ≤ ₨50,000
```

---

## SECTION H: JUDGE QUESTIONS & ANSWERS

### H1. Likely Product Questions

**Q: "How is this different from QuickBooks or Wave?"**
> "Those are general accounting tools designed for US/Canadian businesses. They don't know about Section 154A, PSEB registration, SBP purpose codes, PRC tracking, or Pakistan's July–June tax year. A freelancer using QuickBooks still has to manually calculate their FBR tax liability and wealth statement. We do that automatically."

**Q: "What's your target market size?"**
> "Pakistan has over 2 million registered freelancers on Upwork alone, with the country ranking 4th globally in freelancing. The IT export industry earned $3.2 billion in FY2024-25. Every one of these freelancers faces this exact tax filing problem."

**Q: "How do you make money?"**
> "Freemium model. Free tier for basic tracking, premium for tax simulation, wealth reconciliation, filing readiness scoring, and the evidence vault. The pain point is acute at tax season — September deadline — which creates natural conversion pressure."

**Q: "Does this actually file taxes for the user?"**
> "No, and that's intentional. FBR's IRIS portal doesn't have public APIs for third-party filing. We prepare 100% of the numbers, do the compliance checks, and generate the documentation. The user then enters these numbers into IRIS. Think of us as TurboTax for Pakistan — TurboTax doesn't file directly with the IRS either."

### H2. Likely Technical Questions

**Q: "How do you handle exchange rate accuracy?"**
> "We fetch live rates from ExchangeRate-API and cache for 24 hours. Users can also override the rate per transaction — important because bank rates differ from market rates. The PKR amount is computed and stored at creation time, so reports are always consistent."

**Q: "What if FBR changes the tax rate?"**
> "Tax rates are stored in a `tax_rules` database table, not hardcoded. An admin can update the rate for any tax year via a protected API endpoint. The tax engine reads from this table at calculation time. When the Finance Act 2027 changes rates, we update one database row."

**Q: "How do you ensure multi-tenant data isolation?"**
> "Every database query includes a `userId` filter. There's no endpoint that returns data without scoping by the authenticated user's ID. The JWT auth guard extracts the user from the token, and services always filter: `where(eq(table.userId, userId))`."

**Q: "What's your testing strategy?"**
> "10 unit tests across tax calculation, CSV parsing, and service logic. The tax tests specifically verify PSEB vs non-PSEB rates, tax year filtering, expense deduction rules (expenses reduce local but NOT export tax), slab boundaries, and edge cases like empty ledgers."

### H3. Difficult Tax/Compliance Questions (Answer Honestly)

**Q: "Are your tax slab rates accurate for the current Finance Act?"**
> HONEST ANSWER: "The slab rates in our implementation are based on standard individual/business rates from the Income Tax Ordinance. FBR updates these annually through the Finance Act. Our architecture handles this — rates are in a configurable rules engine — but the specific slab numbers should be verified against the latest Finance Act before production use. For the hackathon, the calculation logic and architecture are correct; the specific threshold numbers would be updated during a tax professional review."

**Q: "Is the 0.25% PSEB rate still current?"**
> HONEST ANSWER: "Section 154A has provided reduced rates for PSEB-registered IT exporters. The specific rate has been 0.25% in recent years. However, it can change with each Finance Act. Our system stores this in a database table precisely so it can be updated without code changes. Before going live, we'd confirm the current rate with FBR or a tax advisor."

**Q: "What about GST/Sales Tax?"**
> HONEST ANSWER: "Our current implementation focuses on income tax under Section 154A. IT exports are generally exempt from sales tax in Pakistan, but there are edge cases with provincial sales tax on services. This would be a future module — the architecture supports adding it."

**Q: "Does your wealth reconciliation match exactly what FBR expects?"**
> HONEST ANSWER: "Our reconciliation formula — opening wealth plus income minus expenses equals closing wealth — follows the standard wealth statement logic. The ₨50,000 tolerance threshold is our product decision for flagging mismatches early. FBR doesn't publish a specific tolerance — they look at the absolute and relative size of discrepancies. Our tool catches the same kind of issue FBR would flag, proactively."

**Q: "What about advance tax already deducted by banks/platforms?"**
> HONEST ANSWER: "Currently, we don't track withholding tax that banks deduct when foreign remittances arrive. In practice, the 0.25% under Section 154A is often deducted at source by the bank. A production version would need to reconcile actual tax deducted vs calculated liability. This is a planned enhancement."

---

## SECTION I: RISKS & SIMPLIFICATIONS AUDIT

### What's Real Tax Law vs Our Product Logic

| Item | Based on Real Law? | Our Implementation | Risk Level |
|------|-------------------|-------------------|------------|
| 0.25% PSEB export rate | ✅ Yes (Section 154A) | Stored in `tax_rules` table, rate 0.0025 | LOW — rate is configurable |
| 1.0% non-PSEB rate | ✅ Yes (Section 154A) | Stored in `tax_rules` table, rate 0.01 | LOW |
| Export = gross tax (no expense deduction) | ✅ Yes (s.154A is final tax on gross) | Correct in code | NONE |
| Local income slab rates | ⚠️ Based on standard rates | Hardcoded in `calculateLocalTaxSlabs()` | MEDIUM — needs annual update |
| Tax year July–June | ✅ Yes | Correct in `tax-year.ts` | NONE |
| SBP Purpose Code 9100 | ✅ Yes (Software Services) | Default value in income schema | LOW |
| Filing deadline Sept 30 | ✅ Yes (standard deadline) | Hardcoded string | LOW — extensions happen |
| ₨50,000 reconciliation tolerance | ❌ Our product decision | Hardcoded in `wealth.service.ts` | LOW — FBR has no published threshold |
| Export detection by currency/platform | ⚠️ Simplified heuristic | `currency !== 'PKR'` or platform check | MEDIUM — edge cases exist |
| No withholding tax tracking | ❌ Omitted | Not implemented | MEDIUM — banks may already deduct |
| No provincial sales tax | ❌ Omitted | Not implemented | LOW — IT exports usually exempt |

---

## SECTION J: DEMO FLOW (Step-by-Step)

1. **Landing Page** → Click "Get Started" or login with `adnan@gmail.com` / `password123`
2. **Dashboard** → Point out real aggregated numbers (income, expenses, net profit)
3. **Clients** → Show 4 seeded clients across platforms (Upwork, Fiverr, Direct, Local)
4. **Income** → Show entries with PRC references and SBP codes. Highlight the PKR conversion.
5. **CSV Import** → Upload sample CSV → Show success message with counts
6. **Expenses** → Show categorized expenses
7. **Invoices** → Show a professional invoice with line items and PKR total
8. **Reports** → Show monthly income vs expenses chart (July–June)
9. **Tax Simulator** → Toggle PSEB, show savings. Run a what-if scenario.
10. **Wealth** → Show assets, liabilities, reconciliation status
11. **Filing Readiness** → Show score and checklist. Walk through any warnings.
12. **Settings** → Show user profile with PSEB ID, bank details, invoice prefix

**Demo time: ~4-5 minutes for full walkthrough**
