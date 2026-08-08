# User Flows: FreelancerHisab

This document outlines the primary user flows for FreelancerHisab, ensuring an intuitive experience tailored for Pakistani freelancers managing multiple currencies, clients, and financial records.

---

## 1. Onboarding Flow

```mermaid
flowchart TD
    Start[User lands on Homepage] --> Action{Sign Up Method?}
    Action -- Google OAuth --> G[Google Authentication]
    Action -- Email/Password --> E[Email Registration Form]
    E --> V[Verify Email via OTP/Link]
    V --> P
    G --> P[Profile Setup]
    
    P --> B[Enter Business/Freelancer Name]
    B --> C[Select Base Currency - PKR Default]
    C --> I[Select Secondary Currencies - USD, GBP, etc.]
    I --> D[Dashboard]
    
    V -.->|Error: Invalid OTP| E
    G -.->|Error: Auth Failed| Start
```

### Detailed Steps:
1. **Sign Up Options**: Provide Google OAuth for quick access, or Email/Password.
2. **Email Verification**: Essential for security and invoice sending capabilities.
3. **Profile Setup**: 
   - Business name will appear on invoices.
   - Base Currency is PKR (important for SBP context).
   - Secondary currencies for receiving international payments (Payoneer, Wise).

### Edge Cases:
- Existing email during registration: Prompt to log in.
- Abandoned profile setup: Force user back to setup on next login before dashboard access.

---

## 2. Dashboard Flow

```mermaid
flowchart TD
    D[Dashboard Landing] --> O[Overview Cards]
    D --> Q[Quick Actions]
    D --> R[Recent Activity Feed]
    
    Q --> Q1[+ Add Income]
    Q --> Q2[+ Create Invoice]
    Q --> Q3[+ Add Expense]
    
    O -->|Click Card| Detail[Detailed Report View]
    R -->|Click Item| Transaction[Transaction Detail Modal]
```

### Detailed Steps:
1. **Overview Cards**: Show Net Profit, Total Income, Total Expenses, and Pending Invoices for the current month in PKR.
2. **Quick Actions**: Floating Action Button (Mobile) or Top Bar (Desktop) to quickly log an entry.
3. **Recent Activity**: A unified timeline of recent invoices sent, payments received, and expenses logged.

---

## 3. Client Management Flow

```mermaid
flowchart TD
    C[Clients List] --> A[Add Client]
    C --> V[View Client Details]
    
    A --> F[Client Form]
    F -->|Name, Email, Platform, Currency| S[Save]
    S --> V
    
    V --> T1[View Client Invoices]
    V --> T2[View Client Income]
    V --> E[Edit/Archive Client]
```

### Detailed Steps:
1. **Add Client**: Collect basic info. "Platform" (Fiverr, Upwork, Direct) helps in reporting.
2. **Client Details**: A unified view of how much a specific client has paid and what is outstanding.

---

## 4. Invoice Creation Flow

```mermaid
flowchart TD
    I[Invoice List] --> C[Create Invoice]
    C --> Sel[Select Client]
    Sel --> D[Invoice Details]
    D --> L[Add Line Items]
    L --> F[Set Currency & Conversion Rate]
    F --> P[Preview]
    
    P --> A1[Save as Draft]
    P --> A2[Download PDF]
    P --> A3[Send via Email]
    
    A3 --> T[Track Status: Sent]
    T --> M[Mark as Paid]
    M --> Log[Auto-Log Income]
```

### Detailed Steps:
1. **Currency/Conversion**: If invoicing in USD, prompt for an expected exchange rate to project PKR value.
2. **Mark as Paid**: When user marks an invoice as paid, prompt them to specify the received amount in PKR to log the exact exchange rate realized.

---

## 5. Income Logging Flow

```mermaid
flowchart TD
    I[Income List] --> A[Add Income]
    A --> S[Select Client/Platform]
    S --> E[Enter Amount in Original Currency]
    E --> R[Enter Received PKR Amount]
    R --> C[Categorize]
    C --> Save[Save Income]
```

### Detailed Steps:
1. **Dual Entry**: Freelancers often receive USD but realize PKR. The form must capture both to accurately track bank fees and exchange rates.
2. **Categorize**: E.g., Web Development, Consultation.

---

## 6. Expense Tracking Flow

```mermaid
flowchart TD
    E[Expense List] --> A[Add Expense]
    A --> D[Enter Details]
    D --> C[Categorize: Internet, Hardware, etc.]
    C --> U[Upload Receipt Optional]
    U --> S[Save]
```

---

## 7. Report Generation Flow

```mermaid
flowchart TD
    R[Reports Page] --> T[Select Type: P&L, Tax, Client]
    T --> D[Set Date Range]
    D --> V[View Charts/Data]
    V --> E[Export PDF/Excel]
```

---

## 8. Settings Flow

```mermaid
flowchart TD
    S[Settings Page] --> P[Profile & Auth]
    S --> B[Business Info for Invoices]
    S --> C[Currency & Tax Preferences]
    S --> N[Notification Settings]
```
