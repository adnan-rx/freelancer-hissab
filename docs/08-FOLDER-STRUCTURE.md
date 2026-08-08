# 08 Folder Structure

This document details the Turborepo monorepo folder structure for FreelancerHisab, featuring a NestJS backend (`apps/api`), Next.js frontend (`apps/web`), and shared packages (`packages/shared`), using Drizzle ORM.

## Complete Monorepo Structure

```text
freelancerhisab/
├── apps/
│   ├── api/                                # NestJS Backend Application
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/                   # Authentication feature module
│   │   │   │   │   ├── auth.module.ts      # Auth module definition
│   │   │   │   │   ├── auth.controller.ts  # HTTP endpoints for login/register/refresh
│   │   │   │   │   ├── auth.service.ts     # Business logic for authentication
│   │   │   │   │   ├── jwt.strategy.ts     # Passport JWT validation strategy
│   │   │   │   │   ├── jwt-auth.guard.ts   # Guard protecting private routes
│   │   │   │   │   └── dto/                # Data Transfer Objects for Auth (LoginDto, RegisterDto)
│   │   │   │   ├── clients/                # Clients management module
│   │   │   │   │   ├── clients.module.ts   # Clients module definition
│   │   │   │   │   ├── clients.controller.ts # Endpoints for client CRUD
│   │   │   │   │   ├── clients.service.ts  # Business logic for clients
│   │   │   │   │   ├── clients.repository.ts # Database abstraction for clients via Drizzle
│   │   │   │   │   └── dto/                # Client DTOs
│   │   │   │   ├── invoices/               # Invoices feature module
│   │   │   │   │   ├── invoices.module.ts
│   │   │   │   │   ├── invoices.controller.ts
│   │   │   │   │   ├── invoices.service.ts
│   │   │   │   │   ├── invoices.repository.ts
│   │   │   │   │   └── dto/
│   │   │   │   ├── income/                 # Income tracking module
│   │   │   │   │   ├── income.module.ts
│   │   │   │   │   ├── income.controller.ts
│   │   │   │   │   ├── income.service.ts
│   │   │   │   │   ├── income.repository.ts
│   │   │   │   │   └── dto/
│   │   │   │   ├── expenses/               # Expenses tracking module
│   │   │   │   │   ├── expenses.module.ts
│   │   │   │   │   ├── expenses.controller.ts
│   │   │   │   │   ├── expenses.service.ts
│   │   │   │   │   ├── expenses.repository.ts
│   │   │   │   │   └── dto/
│   │   │   │   ├── reports/                # Reporting and analytics module
│   │   │   │   │   ├── reports.module.ts
│   │   │   │   │   ├── reports.controller.ts
│   │   │   │   │   └── reports.service.ts
│   │   │   │   └── dashboard/              # Dashboard metrics aggregation module
│   │   │   │       ├── dashboard.module.ts
│   │   │   │       ├── dashboard.controller.ts
│   │   │   │       └── dashboard.service.ts
│   │   │   ├── database/                   # Database layer
│   │   │   │   ├── schema/                 # Drizzle schema definitions
│   │   │   │   │   ├── users.ts            # Users table schema
│   │   │   │   │   ├── clients.ts          # Clients table schema
│   │   │   │   │   ├── invoices.ts         # Invoices and line items table schemas
│   │   │   │   │   ├── income.ts           # Income table schema
│   │   │   │   │   └── expenses.ts         # Expenses table schema
│   │   │   │   ├── migrations/             # Generated SQL migrations from Drizzle
│   │   │   │   ├── db.ts                   # Configured Drizzle client instance
│   │   │   │   └── seed.ts                 # Database seeding script
│   │   │   ├── common/                     # Cross-cutting concerns
│   │   │   │   ├── decorators/             # Custom NestJS decorators (e.g., @CurrentUser())
│   │   │   │   ├── filters/                # Global exception filters (e.g., Drizzle exceptions)
│   │   │   │   ├── interceptors/           # Global interceptors (e.g., response formatting)
│   │   │   │   └── pipes/                  # Global validation pipes
│   │   │   ├── config/                     # Configuration management
│   │   │   │   ├── env.config.ts           # Environment variables validation
│   │   │   │   └── database.config.ts      # Database connection settings
│   │   │   ├── app.module.ts               # Root NestJS application module
│   │   │   └── main.ts                     # NestJS application bootstrap entry point
│   │   ├── drizzle.config.ts               # Configuration for Drizzle Kit (migrations, schema path)
│   │   ├── nest-cli.json                   # NestJS CLI configuration
│   │   ├── tsconfig.json                   # TypeScript configuration for API
│   │   └── package.json                    # API dependencies and scripts
│   │
│   └── web/                                # Next.js Frontend Application
│       ├── src/
│       │   ├── app/                        # Next.js App Router root
│       │   │   ├── (auth)/                 # Auth route group
│       │   │   │   ├── login/page.tsx      # Login page component
│       │   │   │   └── register/page.tsx   # Register page component
│       │   │   ├── (dashboard)/            # Dashboard route group
│       │   │   │   ├── layout.tsx          # Shared dashboard layout (sidebar, topbar)
│       │   │   │   ├── dashboard/page.tsx  # Dashboard overview page
│       │   │   │   ├── clients/            # Clients pages (list, detail, new)
│       │   │   │   ├── invoices/           # Invoices pages (list, detail, new, edit)
│       │   │   │   ├── income/             # Income tracking pages
│       │   │   │   ├── expenses/           # Expenses tracking pages
│       │   │   │   ├── reports/            # Financial reports pages
│       │   │   │   └── settings/           # User settings pages
│       │   │   ├── layout.tsx              # Root HTML layout and providers
│       │   │   └── page.tsx                # Landing or redirect page
│       │   ├── components/                 # React UI Components
│       │   │   ├── ui/                     # shadcn/ui atomic components (buttons, inputs)
│       │   │   ├── layout/                 # Layout components (Sidebar, Topbar)
│       │   │   └── features/               # Domain-specific components (InvoiceBuilder, ClientTable)
│       │   ├── hooks/                      # Custom React hooks (e.g., useClients, useInvoices)
│       │   ├── lib/                        # Utilities and configurations
│       │   │   ├── api-client.ts           # Axios/fetch wrapper configured for NestJS API
│       │   │   └── utils.ts                # General helpers (classnames, currency formatters)
│       │   ├── stores/                     # Global state management
│       │   │   └── auth.store.ts           # Zustand store for user session and tokens
│       │   ├── providers/                  # Context providers
│       │   │   ├── query-provider.tsx      # React Query client provider
│       │   │   └── theme-provider.tsx      # Next-themes provider
│       │   └── constants/                  # Application constants (navigation, static options)
│       ├── components.json                 # shadcn/ui configuration
│       ├── tailwind.config.ts              # Tailwind CSS configuration
│       ├── next.config.js                  # Next.js configuration
│       ├── tsconfig.json                   # TypeScript configuration for Web
│       └── package.json                    # Web dependencies and scripts
│
├── packages/
│   └── shared/                             # Shared Code Package (consumed by api and web)
│       ├── src/
│       │   ├── types/                      # Shared TypeScript interfaces (User, Client, Invoice)
│       │   ├── enums/                      # Shared Enums (InvoiceStatus, Currency)
│       │   ├── validators/                 # Shared Zod schemas for request validation & forms
│       │   └── index.ts                    # Main export entry point
│       ├── tsconfig.json                   # TypeScript configuration for Shared
│       └── package.json                    # Shared package configuration
│
├── turbo.json                              # Turborepo pipeline configuration
├── package.json                            # Root workspace dependencies (concurrently, turbo)
├── pnpm-workspace.yaml                     # pnpm workspace definition (if using pnpm)
├── .eslintrc.js                            # Monorepo ESLint configuration
├── .prettierrc                             # Monorepo Prettier configuration
├── .github/
│   └── workflows/                          # CI/CD pipelines (e.g., test, build, deploy)
│       └── ci.yml                          # Main CI workflow
├── .gitignore                              # Git ignore rules
└── .env.example                            # Example environment variables (DB URLs, JWT secrets)
```
