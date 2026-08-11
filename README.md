# 🇵🇰 FreelancerHisab — Financial Operating System for Pakistani IT Exporters

**FreelancerHisab** is a financial operating system tailored specifically for Pakistani freelancers, agencies, and software exporters. It automates income/expense tracking, Upwork/Fiverr statement parsing, client invoice generation, FBR Section 154A export tax calculations, and State Bank of Pakistan (SBP) Proceeds Realization Certificate (PRC) remittance tracking.

--- 

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
``` 

### 2. Configure Environment Variables (`apps/api/.env`)
Create or update `apps/api/.env`:

```env
PORT=3001
NODE_ENV=development

# Database Connection (Local PostgreSQL or Neon DB Cloud)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/freelancerhisab

# JWT Configuration
JWT_SECRET=super-secret-jwt-key
JWT_EXPIRES_IN=15m

# Live Exchange Rate Engine
EXCHANGE_RATE_API_URL=https://api.exchangerate-api.com/v4/latest/USD
```

---

## 🗄️ Database Migrations & Seeding

### 1. Apply Database Migrations
Runs Drizzle SQL migrations to create all database tables (`users`, `clients`, `invoices`, `invoice_items`, `income`, `expenses`) on local or Neon DB PostgreSQL:

```bash
npm --prefix apps/api run db:migrate
```

### 2. Seed Test Freelancer Account & Data
Populates PostgreSQL with test data (clients, invoices, inward remittances, and operating expenses):

```bash
npm --prefix apps/api run db:seed
```

**Default Test Account Credentials (Super Admin):**
- **Email:** `admin@gmail.com`
- **Password:** `Admin@123456`
- **Role:** Super Admin (`isAdmin: true`)
- **Bank Profile:** Meezan Bank Limited (`IBAN: PK36MEZN0001020304050607`)
- **PSEB Tax Filer:** Active (0.25% Export Tax Rate)

### 3. Generate New Migrations
When updating database schemas in `apps/api/src/database/schema/`:
```bash
npm --prefix apps/api run db:generate
npm --prefix apps/api run db:migrate
```

---

## ☁️ Neon DB Cloud Integration (Free Managed PostgreSQL)

1. Create a free project on [neon.tech](https://neon.tech).
2. Copy your pooled connection string (with `?sslmode=require`).
3. Set `DATABASE_URL` in `apps/api/.env`:
   ```env
   DATABASE_URL=postgresql://user_owner:npg_xxxxxxx@ep-cool-name-a1b2c3d4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Run `npm --prefix apps/api run db:migrate` and `npm --prefix apps/api run db:seed`.

---

## 💻 Running the App Locally

Start both NestJS API Backend (`http://localhost:3001`) and Next.js Web Frontend (`http://localhost:3000`) concurrently:

```bash
npm run dev
```

---

## 📚 Developer Onboarding & Architecture Docs

For full technical documentation, architecture blueprints, API specifications, and coding standards, refer to:
- 📖 [Developer Onboarding Guide](file:///c:/Users/User/Desktop/Freelancerhissab/docs/DEVELOPER_ONBOARDING.md)
- 📐 [System Architecture Document](file:///c:/Users/User/Desktop/Freelancerhissab/docs/02-SYSTEM-ARCHITECTURE.md)
- 📊 [Database Schema Design](file:///c:/Users/User/Desktop/Freelancerhissab/docs/03-DATABASE-DESIGN.md)
