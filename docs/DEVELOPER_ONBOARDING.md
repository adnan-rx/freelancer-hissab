# FreelancerHisab — Developer Onboarding Guide

Welcome to the **FreelancerHisab** engineering team! This guide provides everything you need to get your local environment running, configure local or Neon cloud databases, run migrations, seed data, and start contributing.

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
| **Database** | PostgreSQL 16 (Local or Neon DB Cloud Serverless) |
| **Shared Package (`packages/shared`)** | TypeScript schemas, Zod validators, common DTOs, Enums |

---

## 🚀 Quick Start & Local Setup

### 1. Prerequisites
Ensure you have the following installed on your machine:
- **Node.js**: `v20.x` or higher (Recommended `v22.x`)
- **npm**: `v10.x` or **pnpm**: `v9.x`
- **PostgreSQL Database**: Local PostgreSQL server OR a free [Neon DB](https://neon.tech) cloud database.

---

### 2. Clone & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/adnanniazdev/freelancer-hissab.git
cd freelancerhissab

# Install dependencies across all monorepo workspaces
npm install
```

---

### 3. Environment Configuration

#### Option A: Local PostgreSQL Setup
Copy `.env.example` to `apps/api/.env`:
```env
PORT=3001
NODE_ENV=development

# Local PostgreSQL Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/freelancerhisab

# JWT Secrets
JWT_SECRET=super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=super-secret-refresh-key
JWT_REFRESH_EXPIRES_IN=7d

# Exchange Rate API
EXCHANGE_RATE_API_URL=https://api.exchangerate-api.com/v4/latest/USD
```

#### Option B: Neon DB Cloud Setup (Recommended for Cloud Dev)
1. Create a free project at [neon.tech](https://neon.tech).
2. Copy your pooled connection string from the Neon Dashboard.
3. Update `apps/api/.env`:
```env
DATABASE_URL=postgresql://user_owner:npg_xxxxxxx@ep-cool-name-a1b2c3d4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

> **Note:** `apps/api/src/database/db.ts` uses `postgres(connectionString, { prepare: false })`, which natively supports Neon serverless connection poolers.

#### Frontend Environment Setup (`apps/web/.env.local`)
Create `apps/web/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

---

### 4. Database Migrations & Seeding

#### Step A: Run Database Migrations
Applies all Drizzle SQL migration files (including schema updates for bank profiles, invoices, and remittances) to your target database:

```bash
# Run migrations using Drizzle ORM
npm --prefix apps/api run db:migrate
```

#### Step B: Seed Rich Test Data
Populates the database with realistic Pakistani freelancing records (clients, invoices, inward remittances, bank details, and business expenses):

```bash
# Seed database with Pakistani context freelancing data
npm --prefix apps/api run db:seed
```

**Default Test Account Credentials (created by seed - Super Admin):**
- **Email:** `admin@gmail.com`
- **Password:** `Admin@123456`
- **Role:** Super Admin (`isAdmin: true`)
- **Bank Profile:** Meezan Bank Limited (`IBAN: PK36MEZN0001020304050607`)
- **PSEB Status:** Active Filer (0.25% Export Tax Rate)

#### Step C: Creating New Migrations (When modifying schemas)
If you update schema files in `apps/api/src/database/schema/`:
```bash
# Generate new migration files
npm --prefix apps/api run db:generate

# Apply newly generated migrations
npm --prefix apps/api run db:migrate
```

---

### 5. Running the Application Locally

Start both the NestJS API backend (`http://localhost:3001`) and the Next.js web frontend (`http://localhost:3000`) concurrently:

```bash
npm run dev
```

---

## 📁 Repository Structure

```
freelancerhissab/
├── apps/
│   ├── api/                     # NestJS Backend API
│   │   ├── src/
│   │   │   ├── common/          # Guards, Interceptors, Filters, Decorators
│   │   │   ├── database/        # Drizzle client, migrations, & schema files
│   │   │   │   ├── migrations/  # Drizzle SQL migration scripts
│   │   │   │   ├── schema/      # Entity definitions (users, clients, income, expenses, invoices)
│   │   │   │   ├── db.ts        # Database connection client
│   │   │   │   └── seed.ts      # Seeder script
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
│       │   ├── components/      # UI primitives, Toast, & ConfirmModal
│       │   ├── hooks/           # Custom React Query hooks
│       │   ├── lib/             # Axios API client & FX conversion helpers
│       │   └── stores/          # Zustand state management (Auth)
├── packages/
│   ├── shared/                  # Shared TypeScript types, Enums, Zod schemas
│   ├── eslint-config/           # Monorepo ESLint rules
│   └── typescript-config/       # Base tsconfig rules
├── docs/                        # Project documentation & sitemaps
└── package.json                 # Monorepo root scripts
```

---

## 🔑 Database Commands Quick Reference

| Action | Command |
| :--- | :--- |
| **Apply Migrations** | `npm --prefix apps/api run db:migrate` |
| **Seed Database** | `npm --prefix apps/api run db:seed` |
| **Generate Migrations** | `npm --prefix apps/api run db:generate` |
| **Studio DB GUI** | `npx --prefix apps/api drizzle-kit studio` |

---

## 🧪 Verification & Code Quality Commands

Always run these commands before submitting a Pull Request:

```bash
# Type check across all monorepo workspaces
npm run check-types

# Lint all TypeScript and Next.js files
npm run lint

# Run backend unit tests
npm --prefix apps/api run test
```

---

## 🤝 Code Contribution Guidelines

- **No `any` types:** Always use strict TypeScript interfaces or Zod schema inferences from `@freelancerhisab/shared`.
- **API Call Placement:** Never place `fetch` or `axios` calls directly inside Next.js components; use custom React Query hooks inside `apps/web/src/hooks/`.
- **Database Modifies:** Modify schemas in `apps/api/src/database/schema/` and run `npm --prefix apps/api run db:generate`.
- **Error Handling:** Use custom `Toast` notifications for UI error alerts and `ConfirmModal` for destructive actions.
