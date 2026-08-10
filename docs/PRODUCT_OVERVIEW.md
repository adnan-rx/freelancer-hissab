# FreelancerHisab — What It Is and Who It's For

## The problem

Pakistani freelancers earning through Upwork, Fiverr, or direct clients face a specific headache at tax time: FBR filing requires SBP purpose codes, PRC (Proceeds Realization Certificate) references, and correct classification of export vs. local income — and getting it wrong is either a compliance risk or a missed tax break (PSEB-registered exporters pay 0.25% instead of 1% on export income). Most freelancers track this in scattered spreadsheets, WhatsApp screenshots of bank statements, and memory. There's no single place that connects "money I earned" to "what I owe FBR" to "proof I can show if audited."

## What FreelancerHisab does

It's one workspace that takes a freelancer from **earning money** to **being ready to file taxes**, without needing an accountant for the day-to-day bookkeeping.

### 1. Track money in one place
- **Clients** — every client you've worked with, their platform (Upwork/Fiverr/Direct), currency, and history.
- **Invoices** — create professional invoices, send them, track paid/pending status, export as PDF.
- **Income & Expenses** — log every payment received and every business cost. Foreign currency is automatically converted to PKR using live exchange rates, so the numbers are always FBR-ready.
- **CSV Import** — dump an Upwork or bank statement CSV in, and it automatically separates earnings from platform fees and creates the records for you.

### 2. See the real financial picture
- **Dashboard** — total income, expenses, and net profit at a glance.
- **Reports** — month-by-month trends, income broken down by client and by platform, matched to Pakistan's actual tax year (July–June, not the calendar year).
- **Transactions** — a single combined ledger of every income and expense entry, searchable.

### 3. Know your tax liability before FBR does
- **Tax Simulator** — shows exactly what you'd owe under Section 154A: 0.25% on export income if PSEB-registered (1% if not), standard tax slabs on local income. Run "what-if" scenarios — *"what if I take this $15,000 project?"* — before committing.
- **Wealth Reconciliation** — declares your assets and liabilities and checks that your net worth growth actually matches your income minus expenses. This is exactly the check FBR runs when flagging under-reporting, done proactively instead of discovered during an audit.
- **Filing Readiness Score** — a single percentage that tells you how ready you are to file: is your PSEB ID on file, does every foreign payment have its PRC reference, does your declared wealth reconcile, do you have supporting documents. Each gap links directly to where to fix it.

### 4. Be ready if FBR asks for proof
- **Evidence Vault** — upload PRCs, invoices, and receipts, linked directly to the income or expense they support. When it's audit time, everything is already organized instead of being reconstructed from memory.
- **Filing Package** — one click generates a downloadable package with a tax summary, income and expense reports, and a full transaction ledger — the paperwork a filer or accountant would actually ask for.

## Who it's for

Freelance developers, designers, and consultants in Pakistan earning through international platforms (Upwork, Fiverr, direct international clients) who:
- Want to stay compliant with FBR without hiring a full-time accountant
- Are or want to be PSEB-registered to get the lower export tax rate
- Need to reconcile foreign remittances with SBP requirements
- Want one tool instead of five spreadsheets

## What makes it different from "just use Excel"

| Manual (spreadsheet) | FreelancerHisab |
|---|---|
| You track exchange rates by hand, usually stale | Live/cached exchange rates applied automatically per transaction |
| Export vs. local income classification is a judgment call each time | Classified automatically by currency and platform |
| Tax calculation is a separate manual exercise | Calculated live from your actual ledger, using the real FBR rules (export tax on gross proceeds, local tax on net income after expenses) |
| Wealth reconciliation, if done at all, happens once a year under deadline pressure | Visible year-round, updates as you log transactions |
| Proof documents live in email/WhatsApp/downloads folder | Centralized, linked to the specific transaction they support |

## Current state

The core money workflow — clients, invoicing, income/expense tracking, CSV import, dashboard, and reporting — is fully built and working. The compliance layer — tax simulation, wealth reconciliation, filing readiness scoring, and the evidence vault — is also built and functional, with each feature reading from the same underlying ledger so the numbers stay consistent across the whole app.

Not yet built: sending invoices by email, "forgot password" self-service, and a couple of UI conveniences (search, pagination) that don't block the core workflow.
