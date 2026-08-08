# Coding Standards: FreelancerHisab

This document outlines the coding standards for the FreelancerHisab platform, built as a Turborepo monorepo with a Next.js (App Router) frontend and a NestJS backend. Strict adherence to these guidelines ensures a maintainable, high-quality codebase that can be scaled effectively by our engineering team.

## 1. Monorepo Organization (Turborepo)
*   **apps/web**: Next.js 14+ frontend.
*   **apps/api**: NestJS REST API backend.
*   **packages/shared**: Shared TypeScript types, schemas, and utilities.
*   **packages/ui**: Shared UI components (if needed across apps).
*   **packages/database**: Drizzle ORM schema and database connectivity.

## 2. TypeScript Standards
*   **Strict Mode**: `strict: true` must be enabled in all `tsconfig.json` files across the monorepo.
*   **No `any`**: Do not use the `any` type. Use `unknown` if the type is truly dynamic and validate it before use.
*   **Interface vs. Type**: 
    *   Use `interface` for object shapes, class implementations, and extendable models.
    *   Use `type` for unions, intersections, and utility types (e.g., `Omit`, `Pick`).
*   **Shared Types**: Always place domain models, API request/response types, and DTO types in the `packages/shared` workspace to be imported by both `apps/web` and `apps/api`.

## 3. NestJS Standards (Backend)
*   **Module Organization**: One module per domain. Domains include: `AuthModule`, `ClientsModule`, `InvoicesModule`, `IncomeModule`, `ExpensesModule`, `ReportsModule`, `DashboardModule`.
*   **Controller Pattern**: Keep controllers thin. They should only handle HTTP routing, request validation, and mapping responses. All business logic must reside in services.
*   **Service Pattern**: Services contain business logic and interact with Repositories. Services should *never* call Drizzle directly.
*   **Repository Pattern**: Repositories wrap all Drizzle ORM queries. This abstracts the data access layer.
*   **DTO Pattern**: Use `class-validator` and `class-transformer` decorators for input validation in DTOs.
*   **Guard Pattern**: Use JWT authentication guards (`@UseGuards(JwtAuthGuard)`) on protected routes. Avoid session-based auth.
*   **Interceptor Pattern**: Use interceptors for consistent response transformation and request logging.
*   **Exception Filter**: Implement a global exception filter to catch all errors and return a consistent JSON error format (e.g., `{ "statusCode": 400, "message": "...", "error": "Bad Request" }`).
*   **Naming Conventions**:
    *   `[domain].module.ts`
    *   `[domain].controller.ts`
    *   `[domain].service.ts`
    *   `[domain].repository.ts`
    *   `[domain].dto.ts`
    *   `[domain].guard.ts`

## 4. Drizzle ORM Standards (Database)
*   **Schema Files**: One file per entity in `packages/database/schema/` (e.g., `users.ts`, `invoices.ts`, `clients.ts`).
*   **Query Patterns**: Prefer the Drizzle query builder (`db.select().from(...)`) over raw SQL. Use raw SQL only when utilizing specific PostgreSQL features not supported natively by Drizzle.
*   **Transaction Handling**: Use `db.transaction()` for multi-step database operations to ensure data integrity.
*   **Type Inference**: Utilize Drizzle's built-in type inference utilities to define models: 
    *   `type User = typeof schema.users.$inferSelect;`
    *   `type NewUser = typeof schema.users.$inferInsert;`
*   **Migration Workflow**: Generate migrations via `drizzle-kit generate` and apply them via `drizzle-kit migrate`. Never modify database schema directly through external SQL clients.

## 5. React / Next.js Standards (Frontend)
*   **App Router**: Use Next.js 14 App Router (`app/` directory).
*   **NO API Routes**: Do not use Next.js Route Handlers (`app/api/`) for business logic. All API calls must be directed to the NestJS backend.
*   **Server vs. Client Components**: Default to Server Components for data fetching. Use Client Components (`"use client"`) only for interactive UI elements.
*   **Component Structure**: Functional components only, utilizing hooks. Keep components small, focused, and pure.

## 6. API Client Standards (Frontend to Backend)
*   **Centralized API Client**: Use a centralized API client instance (e.g., Axios instance or a fetch wrapper) configured with the backend Base URL.
*   **Interceptors**: Use client interceptors to automatically attach the JWT token to request headers and handle global errors (e.g., redirecting to login on 401).
*   **Token Refresh Logic**: Implement token refresh logic within the API client if JWT expiration requires it.
*   **Type-Safe Calls**: Cast API responses using the shared types from `packages/shared` to maintain end-to-end type safety.

## 7. Styling Standards
*   **Tailwind CSS**: Use Tailwind CSS for all styling.
*   **shadcn/ui**: Use shadcn/ui components for complex interactive elements.
*   **Utility Class Combination**: Use the `cn()` utility (typically combining `clsx` and `tailwind-merge`) to handle dynamic class names and resolve Tailwind conflicts.

## 8. Git Standards
*   **Conventional Commits**: Follow conventional commits (e.g., `feat: add client creation`, `fix: resolve JWT expiration bug`, `chore: update dependencies`).
*   **Branch Naming**: Prefix branches based on the monorepo app they affect and the type of work:
    *   `feat/api/auth-guard`
    *   `feat/web/dashboard-ui`
    *   `fix/shared/dto-validation`

## 9. Import Order
Maintain a consistent import order in both applications, structured generally as follows:
1.  Built-in Node.js modules.
2.  External dependencies (e.g., `react`, `@nestjs/common`, `drizzle-orm`).
3.  Internal packages (e.g., `@freelancerhisab/shared`).
4.  Absolute imports within the app (e.g., `src/services/...`).
5.  Relative imports.

## 10. Environment Variables
*   Maintain a strict split between environment variables.
*   **`apps/api`**: Store secrets like `DATABASE_URL`, `JWT_SECRET`, etc. Never expose these to the frontend.
*   **`apps/web`**: Store public variables. Prefix Next.js public variables with `NEXT_PUBLIC_` (e.g., `NEXT_PUBLIC_API_URL`).
