# FreelancerHisab — Presentation Guide (Part 1: Domain Knowledge)

## SECTION A: THE PROBLEM WE SOLVE

### The Pain in Plain English

Imagine you're a Pakistani developer earning $3,000/month on Upwork. Every year by September 30, Pakistan's tax authority (FBR) expects you to:

1. **Know exactly how much you earned** — in PKR, not dollars — using the exchange rate on the day you received each payment
2. **Classify each payment** as "export income" or "local income" (they're taxed differently)
3. **Have proof** that each foreign payment came through proper banking channels (a document called a PRC)
4. **Calculate your tax** using specific rules for IT exporters
5. **Declare your wealth** — list every asset you own, every loan you owe, and prove that the *change* in your wealth matches your income minus expenses
6. **File all of this** on FBR's IRIS web portal

Most freelancers track this in spreadsheets, WhatsApp screenshots, and memory. They either overpay taxes (missing the PSEB discount), underpay (risking penalties), or pay an accountant ₨50,000+ just to sort through their mess of records.

**FreelancerHisab automates steps 1–5 so the freelancer only has to do step 6.**

---

## SECTION B: PAKISTANI TAX CONCEPTS (Developer-Friendly)

### B1. Key Institutions

| Term | What It Is | Developer Analogy |
|------|-----------|-------------------|
| **FBR** (Federal Board of Revenue) | Pakistan's IRS — the government tax authority | The "server" that receives your tax "API call" |
| **IRIS** | FBR's online portal where you file taxes | The FBR's web app — like a government form UI |
| **SBP** (State Bank of Pakistan) | Central bank — regulates all money flowing in/out of Pakistan | The "gateway" all international payments must route through |
| **PSEB** (Pakistan Software Export Board) | Government body that certifies IT companies/freelancers as software exporters | A "verified badge" that unlocks a lower tax rate |
| **NTN** (National Tax Number) | Your unique tax ID (linked to your CNIC/national ID) | Like a user ID in the FBR system |

### B2. Key Financial Concepts

**Income** = Money you received for work. In our app, every payment logged in the Income module.

**Expense** = Money you spent on your business (internet, software subscriptions, co-working space). In our app, every entry in the Expenses module.

**Gross Income** = Total income before subtracting anything. Just the raw sum.

**Net Profit** = Gross Income minus Expenses. What you actually "kept."

**Taxable Income** = The portion of your income that the government charges tax on. This is NOT always the same as gross income — deductions and exemptions can reduce it.

**Tax Liability** = The actual rupee amount you owe the government. The output of applying tax rates to your taxable income.

**Tax Return** = The form you submit to FBR declaring your income, expenses, and tax. Like a "POST request" to FBR with your financial data.

### B3. Pakistani Tax Year

> **Critical:** Pakistan's tax year is NOT January–December.

**Tax Year 2026** = July 1, 2025 → June 30, 2026

In our code (`tax-year.ts`): `taxYearRange(2026)` returns `{ start: 2025-07-01, end: 2026-07-01 }`. Every calculation filters transactions to this window.

**Filing deadline:** September 30 of the tax year number (so September 30, 2026 for tax year 2026).

### B4. Export Income vs Local Income

This is the most important distinction in our app:

| | Export Income | Local Income |
|---|---|---|
| **What** | Money earned from foreign clients, received in foreign currency | Money earned from Pakistani clients, in PKR |
| **How our app detects it** | `currency !== 'PKR'` OR platform is `upwork`/`fiverr`/`freelancer` | Everything else |
| **Tax treatment** | Flat rate on GROSS amount (no expense deduction) | Progressive slab rates on NET amount (after expenses) |
| **Rate** | 0.25% (PSEB) or 1.0% (non-PSEB) | 0% to 35% depending on income level |

**Key insight for your demo:** Export income tax is calculated on the GROSS amount. You do NOT subtract expenses from export income before calculating tax. Expenses only reduce local income tax.

### B5. Section 154A (The Core Tax Rule)

This is the specific law our app implements. In plain English:

> "If you're a Pakistani IT exporter and your foreign client sends you money through proper banking channels, the government takes a small percentage as final tax — and you're done. No further income tax on that money."

- **With PSEB registration:** 0.25% of gross export proceeds
- **Without PSEB:** 1.0% of gross export proceeds

**"Final tax" means:** That 0.25% IS your total tax on export income. You don't add it to slab calculations. It's settled.

### B6. Local Tax Slabs (Our Implementation)

For local (PKR) income, after subtracting expenses, our app applies these slabs:

```
₨0 – ₨600,000         → 0% (tax-free threshold)
₨600,001 – ₨1,200,000 → 2.5% of amount exceeding ₨600,000
₨1,200,001 – ₨2,400,000 → ₨15,000 + 12.5% of amount exceeding ₨1,200,000
₨2,400,001 – ₨3,600,000 → ₨165,000 + 22.5% of amount exceeding ₨2,400,000
Above ₨3,600,000        → ₨435,000 + 35% of amount exceeding ₨3,600,000
```

> [!WARNING]
> **Simplification flag:** These slabs are based on standard individual/business rates. Real FBR slabs change annually in the Finance Act and may have more brackets. Our implementation should be reviewed by a tax professional for the current year.

### B7. PRC (Proceeds Realization Certificate)

When money arrives in Pakistan from abroad, the bank issues a PRC. Think of it as a "receipt from the bank proving foreign money arrived legally."

In our app: each income entry has `sbpPurposeCode` (default `9100` = Software Export Services) and `prcReferenceNumber` fields. These are what you'd show FBR as proof.

### B8. Wealth Statement

Every tax filer in Pakistan must submit a **wealth statement** alongside their tax return. It's essentially a balance sheet:

```
Opening Wealth (what you had on July 1)
+ Total Income earned during the year
- Total Expenses during the year
± Other Adjustments (gifts, inheritance, etc.)
= Expected Closing Wealth (what you SHOULD have on June 30)
```

Then you separately declare:
```
All Assets (cash, property, vehicles, investments)
- All Liabilities (loans, debts)
= Declared Net Wealth (what you SAY you have)
```

**Reconciliation** = Checking that Expected Closing Wealth ≈ Declared Net Wealth

If these don't match, FBR asks questions. Our app does this check automatically with a ₨50,000 tolerance.

---

## SECTION C: HOW OUR CODE IMPLEMENTS ALL OF THIS

### C1. Tax Calculation Flow (`tax.service.ts`)

```
User calls GET /api/v1/tax/estimate?pseb=true&year=2026
                    ↓
1. Determine tax year window (July 1, 2025 – June 30, 2026)
                    ↓
2. Fetch ALL income and expenses for this user
                    ↓
3. Filter to only transactions within the tax year window
                    ↓
4. Split income into EXPORT vs LOCAL:
   - Export: currency !== PKR, or platform in [upwork, fiverr, freelancer]
   - Local: everything else
                    ↓
5. Calculate export tax:
   - Look up rate from tax_rules table (0.0025 for PSEB, 0.01 for standard)
   - Tax = exportIncomePKR × rate
                    ↓
6. Calculate local tax:
   - localTaxableIncome = localIncomePKR - totalExpensesPKR (min 0)
   - Apply progressive slabs to localTaxableIncome
                    ↓
7. Total tax = export tax + local tax
                    ↓
8. Calculate PSEB savings = (what you'd pay at 1%) - (what you pay at 0.25%)
                    ↓
9. Return complete breakdown with disclaimer
```

### C2. Wealth Reconciliation Flow (`wealth.service.ts`)

```
User calls GET /api/v1/wealth/reconciliation?year=2026
                    ↓
1. Get or create wealth statement for this user + tax year
                    ↓
2. Get all user's assets and liabilities for this tax year
                    ↓
3. Fetch income and expenses, filter to tax year
                    ↓
4. Calculate:
   expectedClosing = openingWealth + totalIncome - totalExpenses + adjustments
   declaredWealth  = sum(assets) - sum(liabilities)
   difference      = declaredWealth - expectedClosing
                    ↓
5. reconciled = abs(difference) <= 50,000 PKR
```

### C3. Filing Readiness Engine (`filing.service.ts`)

Runs 9 automated checks:

| # | Check | Severity | What It Catches |
|---|-------|----------|-----------------|
| 1 | PSEB ID exists in profile | WARNING | Can't claim 0.25% rate without it |
| 2 | Income has platform/client | WARNING | Unclassified income |
| 3 | Expenses have category | INFO | Catch-all "other" category |
| 4 | No invoices stuck >90 days | WARNING | Forgotten sent invoices |
| 5 | Foreign income has exchange rate | WARNING | Rate of 1.0 on USD = no conversion |
| 6 | Export income has PRC/SBP codes | WARNING | Missing compliance docs |
| 7 | Paid invoices have income records | WARNING | Payment received but not logged |
| 8 | Wealth reconciles | WARNING | Balance sheet doesn't add up |
| 9 | Evidence documents attached | INFO | Missing supporting documents |

Score = (passed / 9) × 100. Status: READY (100%), ALMOST_READY (≥80%), IN_PROGRESS (≥40%), NOT_STARTED.

### C4. Tax Rules Engine (`tax_rules` table)

Instead of hardcoding `0.25%`, we store rates in a database table:

```
tax_year: "2025-26", incomeType: "IT_EXPORT_PSEB",     rate: 0.0025
tax_year: "2025-26", incomeType: "IT_EXPORT_STANDARD",  rate: 0.01
```

If no rule exists when the tax engine runs, it auto-seeds the default. Admin users can update rates via `PATCH /api/v1/tax/rules/:id` when FBR changes rates in a new Finance Act.

### C5. Exchange Rate System (`exchange-rate.service.ts`)

- Fetches live rates from ExchangeRate-API
- Caches for 24 hours in memory
- Fallback hardcoded rates: USD=280.50, EUR=302.10, GBP=356.40
- Every income/expense creation auto-converts to PKR using this service

### C6. CSV Import Flow (`csv.service.ts`)

```
Upload Upwork CSV → Parse headers → Map columns → For each row:
  → Positive amount? Create INCOME record + auto-create client
  → Negative / "fee" type? Create EXPENSE record
  → Convert to PKR using live/cached exchange rate
```
