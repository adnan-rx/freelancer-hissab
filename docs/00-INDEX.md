# 📋 FreelancerHisab — Project Blueprint Index

> **A Financial Operating System for Pakistani Freelancers**
> Created: August 7, 2026 | Updated: August 8, 2026 | Team Size: 4 | MVP Sprint: 3 Days

---

## 🏗️ Architecture Summary

| Layer | Technology | Hosting |
|---|---|---|
| **Monorepo** | Turborepo | — |
| **Frontend** | Next.js 14+ (App Router) + Tailwind CSS + shadcn/ui | Vercel |
| **Backend** | NestJS 10+ (REST + Swagger) | Railway |
| **Database** | PostgreSQL via Drizzle ORM + postgres.js | Railway |
| **Auth** | JWT (Passport.js) — access + refresh tokens | — |
| **State** | TanStack Query (server) + Zustand (client) | — |
| **Forms** | React Hook Form + Zod (frontend), class-validator (backend) | — |
| **Charts** | Recharts | — |
| **Email** | Resend | — |
| **Shared** | `packages/shared` — types, enums, validators | — |

```
freelancerhisab/
├── apps/api/          ← NestJS backend (Railway)
├── apps/web/          ← Next.js frontend (Vercel)
├── packages/shared/   ← Shared types & contracts
└── turbo.json         ← Turborepo config
```

---

## 🗂️ Document Map

| # | Document | Role Owner | Purpose |
|---|---|---|---|
| 01 | [PRD](./01-PRD.md) | Product Manager | Vision, personas, user stories, feature specs, acceptance criteria |
| 02 | [System Architecture](./02-SYSTEM-ARCHITECTURE.md) | Staff Architect | NestJS + Next.js split arch, data flows, security, deployment |
| 03 | [Database Design](./03-DATABASE-DESIGN.md) | Staff Architect | ER diagrams, **Drizzle** schema, indexes, seed data, migrations |
| 04 | [API Contracts](./04-API-CONTRACTS.md) | Tech Lead | NestJS endpoints: Swagger, DTOs, JWT auth, rate limiting |
| 05 | [User Flows](./05-USER-FLOWS.md) | UX Designer | Mermaid flowcharts for all user journeys |
| 06 | [UX Wireframes](./06-UX-WIREFRAMES.md) | UX Designer | ASCII wireframes, design tokens, component plan, motion guide |
| 07 | [Component Hierarchy](./07-COMPONENT-HIERARCHY.md) | Tech Lead | Next.js component tree, API client layer, auth provider |
| 08 | [Folder Structure](./08-FOLDER-STRUCTURE.md) | Tech Lead | **Turborepo monorepo** — every file with purpose annotations |
| 09 | [Coding Standards](./09-CODING-STANDARDS.md) | Engineering Manager | NestJS modules, Drizzle patterns, Next.js conventions, Git |
| 10 | [Testing Strategy](./10-TESTING-STRATEGY.md) | Engineering Manager | Backend (Vitest + supertest) + Frontend (RTL + Playwright) |
| 11 | [Development Roadmap](./11-DEVELOPMENT-ROADMAP.md) | Engineering Manager | 3-day milestone plan, Gantt chart, parallel backend/frontend |
| 12 | [Task Breakdown](./12-TASK-BREAKDOWN.md) | Engineering Manager | ~80+ atomic tasks with IDs, deps, estimates, acceptance criteria |
| 13 | [GitHub Issues](./13-GITHUB-ISSUES.md) | Engineering Manager | Labels, templates, 20 sample issues, PR template |
| 14 | [Deployment Plan](./14-DEPLOYMENT-PLAN.md) | CTO | **Railway** (NestJS + PG) + **Vercel** (Next.js), CI/CD, costs |
| 15 | [Implementation Plan](./15-IMPLEMENTATION-PLAN.md) | CTO | Master plan — 12 waves, critical path, Sprint Zero commands |

---

## 📖 Reading Order

### For Product Stakeholders
1. `01-PRD.md` → 2. `05-USER-FLOWS.md` → 3. `06-UX-WIREFRAMES.md`

### For Developers (Start Here)
1. `15-IMPLEMENTATION-PLAN.md` (Master Plan) → 2. `08-FOLDER-STRUCTURE.md` → 3. `09-CODING-STANDARDS.md` → 4. `03-DATABASE-DESIGN.md` → 5. `04-API-CONTRACTS.md`

### For AI Agents (Autonomous Execution)
1. `15-IMPLEMENTATION-PLAN.md` → 2. `12-TASK-BREAKDOWN.md` → 3. `08-FOLDER-STRUCTURE.md` → 4. `03-DATABASE-DESIGN.md` → 5. `04-API-CONTRACTS.md` → 6. `07-COMPONENT-HIERARCHY.md`

### For DevOps / Deployment
1. `14-DEPLOYMENT-PLAN.md` → 2. `02-SYSTEM-ARCHITECTURE.md` → 3. `10-TESTING-STRATEGY.md`

---

## 👥 Team Assignment

| Developer | Role | Primary Areas |
|---|---|---|
| Dev A | Fullstack Lead | Auth (both sides), Invoices API, Deployment, Sprint Zero |
| Dev B | Frontend | Dashboard shell, UI components, Charts, Reports pages |
| Dev C | Backend | Drizzle DB, NestJS modules (Clients, Income, Expenses, Reports) |
| Dev D | Full-stack Jr | Client UI, Income UI, Expense UI, Settings page |

### Parallel Work Strategy
```
Dev C (Backend) ──builds NestJS modules──▶ API ready
                                            ↕ shared types
Dev B (Frontend) ──builds Next.js pages──▶ UI ready
```
Backend and frontend work in parallel using shared type contracts.

---

## 📅 3-Day Sprint Overview

### Day 1: Foundation
- Turborepo monorepo scaffolding
- Drizzle schema, migrations, seed data
- NestJS core (Swagger, guards, filters, CORS)
- JWT auth (backend + frontend)
- Dashboard layout shell + API client
- Client management (API + UI)

### Day 2: Core Features
- Invoice system (NestJS module + Next.js form/list/detail + PDF)
- Income tracking + currency conversion
- Expense tracking + receipt upload
- Dashboard API + widgets

### Day 3: Polish & Ship
- Reports (API + charts)
- Settings page
- UI polish (loading, empty, error states, animations)
- Testing & bug fixes
- Railway deploy (API) + Vercel deploy (web)

---

## 💰 Monthly Cost

| Service | Cost |
|---|---|
| Vercel (Next.js) | $0 (free tier) |
| Railway (NestJS + PostgreSQL) | $5/mo (Starter) |
| Resend (email) | $0 (100/day free) |
| **Total** | **~$5/mo** |

---

> **Next Step**: Read `15-IMPLEMENTATION-PLAN.md` and begin Sprint Zero.
