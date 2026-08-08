# Product Requirements Document (PRD): FreelancerHisab

## 1. Executive Summary
**Vision:** To become the default financial operating system for every independent professional in Pakistan, empowering them to achieve financial independence and compliance.
**Mission:** To simplify financial management, invoicing, and tax compliance for Pakistani freelancers through an intuitive, localized, and automated platform.
**Problem Statement:** Pakistani freelancers struggle with managing their finances across multiple platforms (Upwork, Fiverr, direct clients), handling volatile currency conversions (USD to PKR), tracking business expenses, and navigating complex FBR (Federal Board of Revenue) tax regulations. Existing solutions are either too generic, expensive, or not localized for the Pakistani banking and regulatory context, forcing freelancers to rely on chaotic spreadsheets.

## 2. Target Users

| Persona | Description | Goals | Pain Points |
| :--- | :--- | :--- | :--- |
| **Ali (The Beginner)** | 22, fresh graduate, part-time graphic designer on Fiverr. Earns $300-$500/month. | Track earnings, build professional image with clients. | Confused by currency conversion fees; doesn't know how to track small expenses. |
| **Sara (The Pro)** | 28, full-time Upwork top-rated developer & direct clients. Earns $2000+/month. | Optimize tax filings, manage multiple income streams, forecast cash flow. | Tax compliance is a nightmare; managing invoices for direct clients takes too much time. |
| **Omer (Agency Owner)** | 32, runs a boutique digital agency with 5 subcontractors. Earns $10k+/month. | Track project profitability, manage subcontractor payouts, comprehensive reporting. | Reconciling payments from multiple foreign clients into local bank accounts; expense tracking for the team. |

## 3. Market Analysis
* **Market Size:** Pakistan is the 4th fastest-growing freelance market globally, with over 1 million freelancers generating roughly $400M+ annually in IT exports and freelance remittances.
* **Competitors:**
  * *Global:* QuickBooks, FreshBooks, Wave (Expensive, not localized for PKR/SBP regulations, complex).
  * *Local Tools:* Mostly generic accounting software not tailored for freelancers.
  * *Status Quo:* Microsoft Excel / Google Sheets, manual calculations.
* **Opportunity:** A massive, underserved market that needs a localized tool understanding local payment gateways (JazzCash, Easypaisa, local banks like HBL, Meezan), Remittance regulations (PRCs), and FBR tax laws for IT service providers.

## 4. Core Value Proposition
FreelancerHisab offers a highly opinionated, localized financial workflow specifically designed for the Pakistani freelance economy. Unlike generic tools, it natively understands PKR conversions, local payment methods, and FBR requirements, turning financial chaos into actionable insights in minutes, not hours.

## 5. MVP Feature Set (P0 - Must Ship in 3 Days)

### 5.1 Dashboard
**Description:** A high-level overview of the freelancer's financial health.
**User Stories:**
* As a freelancer, I want to see my total earnings for the current month in PKR, so that I know my current financial standing.
* As a freelancer, I want to view my pending and overdue payments, so I can follow up with clients.

**Acceptance Criteria:**
* [ ] Display "Total Income" (current month, PKR).
* [ ] Display "Total Expenses" (current month, PKR).
* [ ] Display "Net Profit" (current month, PKR).
* [ ] List top 5 recent transactions (income/expense).
* [ ] Display "Outstanding Invoices" total amount.

### 5.2 Client Management
**Description:** A lightweight CRM for managing client details.
**User Stories:**
* As a freelancer, I want to add a new client with their name, email, and company, so I can bill them.
* As a freelancer, I want to archive old clients so my active list remains clean.

**Acceptance Criteria:**
* [ ] Form to add client: Name (required), Email, Phone, Company, Address, Platform (e.g., Upwork, Direct).
* [ ] Ability to edit client details.
* [ ] Ability to soft-delete (archive) a client.
* [ ] List view of all active clients with search functionality.

### 5.3 Invoice Generation
**Description:** Create, send, and track professional invoices.
**User Stories:**
* As a freelancer, I want to generate a PDF invoice to send to my direct client.
* As a freelancer, I want to mark an invoice as "Paid" once the remittance hits my local bank account.

**Acceptance Criteria:**
* [ ] Invoice creation form: Select Client, Issue Date, Due Date, Currency (USD, GBP, PKR, etc.), Line Items (Description, Quantity, Rate).
* [ ] Auto-calculate subtotal, discount (optional), and total.
* [ ] Status tracking: Draft, Sent, Paid, Overdue.
* [ ] Generate a professional, print-ready UI (printable to PDF via browser).
* [ ] Unique, sequential Invoice IDs.

### 5.4 Income Tracking
**Description:** Manually log earnings across platforms with currency conversion handling.
**User Stories:**
* As a freelancer, I want to log a $500 Upwork withdrawal, specifying the exchange rate I got, so my PKR totals are accurate.

**Acceptance Criteria:**
* [ ] Form to log income: Date, Amount (in source currency), Source Currency, Conversion Rate to PKR, Received Amount (PKR - auto-calculated or manually overridden), Client/Platform tag, Notes.
* [ ] Validation to ensure required fields are filled.
* [ ] Update dashboard aggregates upon save.

### 5.5 Expense Tracking
**Description:** Log and categorize business expenses.
**User Stories:**
* As a freelancer, I want to record my internet bill and software subscriptions, so I can deduct them from my taxable income.

**Acceptance Criteria:**
* [ ] Form to log expense: Date, Amount (PKR), Category (Software, Internet, Hardware, Marketing, Other), Description.
* [ ] Optional receipt upload (image/PDF) via simple file input (stored locally or simple cloud storage for MVP if time permits, otherwise omit upload for strict MVP). *Constraint for 3-day MVP: Drop file upload if it risks timeline; text-only tracking is acceptable.*
* [ ] Update dashboard aggregates upon save.

### 5.6 Basic Reports
**Description:** Simple visual reports of financial health.
**User Stories:**
* As a freelancer, I want to see a bar chart of my income vs expenses over the last 6 months, so I can identify trends.

**Acceptance Criteria:**
* [ ] Monthly summary table: Month, Total Income, Total Expense, Net.
* [ ] Income by Client pie chart or table breakdown.
* [ ] Export to CSV functionality for income and expenses tables.

### 5.7 Authentication
**Description:** Secure user access.
**User Stories:**
* As a new user, I want to sign up with my Google account for quick access.

**Acceptance Criteria:**
* [ ] Email/Password registration and login.
* [ ] Google OAuth integration.
* [ ] Protected routes (redirect to login if unauthenticated).

## 6. P1 Features (Post-MVP)
* **FBR Tax Calculator:** Auto-calculate 1% or standard IT export tax based on logged income and generate a summary for annual filing.
* **Banking/Mobile Wallet Integration:** API integration (if available) or CSV import for HBL, Meezan, JazzCash, Easypaisa statements to auto-reconcile transactions.
* **Multi-Currency Wallet Simulation:** Real-time exchange rate fetching via API for forecasting.
* **Recurring Invoices:** Auto-generate and email invoices on a schedule.
* **AI Financial Assistant:** "Chat with your finances" using LLMs to ask "How much did I spend on software last year?"

## 7. Non-Functional Requirements
* **Performance:** Dashboard must load in under 2 seconds. API responses < 500ms.
* **Security:** JWT authentication for secure session management; Drizzle ORM to prevent SQL injection; CSRF/XSS protections standard in NestJS and Next.js.
* **Accessibility:** WCAG 2.1 AA compliance (shadcn/ui provides sensible defaults). Screen-reader friendly forms.
* **Localization:** Initial release in English, but architecture must support i18n for an eventual Urdu toggle.
* **Responsive Design:** Mobile-first approach using Tailwind CSS. Must be fully usable on mid-range Android smartphones.

## 8. Success Metrics (KPIs for MVP Launch)
* **Acquisition:** 100 beta sign-ups within the first week.
* **Activation:** 50% of sign-ups create at least one invoice or log one income entry within 24 hours.
* **Retention:** 30% of activated users return in week 2 to log new data.
* **System Health:** 0 critical bugs reported related to financial calculations.

## 9. Assumptions & Constraints
* **Assumption:** Users are willing to manually input their financial data initially before automated bank feeds are introduced.
* **Constraint:** Strict 3-day timeline with 4 people means no complex file uploads, no real-time third-party API integrations (e.g., live exchange rates), and relying on standard UI components (shadcn/ui).
* **Assumption:** The target stack (Turborepo monorepo, Next.js 14, NestJS REST API, Drizzle ORM, PostgreSQL) is familiar to the 4-person team.

## 10. Glossary
* **FBR:** Federal Board of Revenue (Pakistan's tax authority).
* **PRC:** Proceeds Realization Certificate (Proof of foreign remittance).
* **Remittance:** Money transferred from a foreign country into Pakistan.
* **Net Profit:** Total Income minus Total Expenses.
