# FreelancerHisab — Developer Onboarding Guide

Welcome to the **FreelancerHisab** engineering team! This guide provides everything you need to get your local environment running, understand the project architecture, and start contributing quickly.

---

## 📌 Project Overview

**FreelancerHisab** is a financial operating system tailored specifically for Pakistani freelancers and IT exporters. It streamlines income/expense tracking, Upwork/Fiverr CSV statement parsing, invoice generation, Pakistan FBR Tax estimation (Section 154A compliance), and State Bank of Pakistan (SBP) Proceeds Realization Certificate (PRC) remittance tracking.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Monorepo Management** | PNPM Workspaces + Turborepo |
| **Frontend App (`apps/web`)** | Next.js 15 (App Router), React 19, Tailwind CSS, Shadcn UI, Zustand, TanStack Query (v5) |
| **Backend API (`apps/api`)** | NestJS 11, Drizzle ORM, Passport JWT, RxJS, Swagger |
| **Database** | PostgreSQL 16 (via Drizzle ORM) |
| **Shared Package (`packages/shared`)** | TypeScript schemas, Zod validators, common DTOs, Enums |

---

## 🚀 Quick Start & Local Setup

### 1. Prerequisites
Ensure you have the following installed on your machine:
- **Node.js**: `v20.x` or higher (Recommended `v22.x`)
- **npm**: `v10.x` or **pnpm**: `v9.x`
- **PostgreSQL**: Local PostgreSQL server running on port `5432` (or via Docker)

### 2. Clone & Install Dependencies
```bash
# Install dependencies across all monorepo workspaces
npm install
```

### 3. Environment Configuration

#### Backend Environment Setup (`apps/api/.env`)
Copy `.env.example` or create `apps/api/.env`:
```env
PORT=3001
NODE_ENV=development

# Database Connection
DATABASE_URL=postgres://postgres:postgres@localhost:5432/freelancerhisab

# JWT Configuration
JWT_SECRET=super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=super-secret-refresh-key
JWT_REFRESH_EXPIRES_IN=7d

# Exchange Rate API (Free Tier)
EXCHANGE_RATE_API_URL=https://api.exchangerate-api.com/v4/latest/USD
```

#### Frontend Environment Setup (`apps/web/.env.local`)
Create `apps/web/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

### 4. Database Setup & Seeding
```bash
# Generate Drizzle migration files (from apps/api)
npm --workspace=api run db:generate

# Apply migrations to local PostgreSQL database
npm --workspace=api run db:migrate

# Seed database with initial categories & test user
npm --workspace=api run db:seed
```

### 5. Running the Application Locally
To start both the NestJS backend (`http://localhost:3001`) and the Next.js frontend (`http://localhost:3000`) concurrently:
```bash
npm run dev
```

---

## 📁 Repository Structure

```
freelancerhisab/
├── apps/
│   ├── api/                     # NestJS Backend API
│   │   ├── src/
│   │   │   ├── common/          # Guards, Interceptors, Filters, Decorators
│   │   │   ├── database/        # Drizzle client, migrations, & schema files
│   │   │   │   └── schema/      # Entity definitions (users, clients, income, expenses, invoices)
│   │   │   └── modules/         # NestJS Feature Modules
│   │   │       ├── auth/        # JWT Authentication
│   │   │       ├── clients/     # Client Management
│   │   │       ├── dashboard/   # Summary KPI Aggregations
│   │   │       ├── expenses/    # Expense CRUD
│   │   │       ├── income/      # Income Log & PKR Conversion
│   │   │       ├── invoices/    # Invoice & Line Item Generation
│   │   │       └── reports/     # Financial P&L Analytics
│   └── web/                     # Next.js 15 Frontend
│       ├── src/
│       │   ├── app/             # App Router Pages ((auth), (dashboard))
│       │   ├── components/      # UI primitives & Feature modals
│       │   ├── hooks/           # Custom React hooks & TanStack Query hooks
│       │   ├── lib/             # Axios API client & utility helpers
│       │   └── stores/          # Zustand state management (Auth, Theme)
├── packages/
│   ├── shared/                  # Shared TypeScript types, Enums, Zod schemas
│   ├── eslint-config/           # Monorepo ESLint rules
│   └── typescript-config/       # Base tsconfig rules
├── docs/                        # Project documentation & status reports
├── tasks/                       # Active sprint & priority tasks
└── package.json                 # Monorepo root scripts
```

---

## 🔑 External API Requirements Summary

| API Name | Purpose | Cost / Tier | Config Needed |
| :--- | :--- | :--- | :--- |
| **ExchangeRate-API** | Live USD/EUR/GBP to PKR conversion rates | **100% Free** (1,500 requests/mo, no credit card required) | `EXCHANGE_RATE_API_URL` |
| **Frankfurter API** | Alternative open-source FX rates | **100% Free** & Open-Source (ECB data) | Optional fallback |
| **Browser Print API** | Invoice PDF export (`window.print`) | **100% Free** (Native browser API) | None |
| **Resend / Nodemailer** | Optional invoice email delivery | **Free Tier** (3,000 emails/mo) | `SMTP_KEY` / `RESEND_API_KEY` |

---

## 🧪 Verification & Code Quality Commands

Always run these commands before submitting a Pull Request:

```bash
# Type check across all monorepo workspaces
npm run check-types

# Lint all TypeScript and Next.js files
npm run lint

# Run backend unit tests
npm --workspace=api run test
```

---

## 🎯 Immediate Development Priorities (P0 Rescue Sprint)

If you are joining during the Hackathon phase, your immediate focus should be on the following tasks listed in `tasks/P0.md`:

1. **Fix UI Tab TS Errors:** Resolve tab component prop mismatches in `apps/web/src/app/(dashboard)/settings/page.tsx`.
2. **Upwork/Fiverr CSV Import Endpoint:** Build `POST /api/v1/csv/import` in `apps/api/src/modules/csv` to replace the frontend mock modal.
3. **FBR Tax Calculation Engine:** Implement Pakistan Tax Ordinance 2001 Section 154A logic (0.25% PSEB vs 1.0% non-PSEB rate).
4. **Live FX Service Integration:** Connect live exchange rate fetching with a 24-hour cache fallback.

---

## 🤝 Code Contribution Guidelines

- **No `any` types:** Always use strict TypeScript interfaces or Zod schema inferences from `@freelancerhisab/shared`.
- **API Call Placement:** Never place `fetch` or `axios` calls directly inside Next.js components; use custom React Query hooks inside `apps/web/src/hooks/`.
- **Database Modifies:** Modify schemas in `apps/api/src/database/schema/` and run `npm --workspace=api run db:generate`.
- **Guard Clauses:** Use early returns in services and functions to keep code flat and readable.
