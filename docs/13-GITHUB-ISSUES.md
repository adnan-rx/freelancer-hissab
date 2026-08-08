# GitHub Issues & Workflow

## Labels

For the Turborepo monorepo, use the following labels:
*   **Areas:** `area/api` (NestJS), `area/web` (Next.js), `area/shared` (packages), `area/devops`
*   **Types:** `type/feature`, `type/bug`, `type/chore`, `type/refactor`, `type/docs`
*   **Priorities:** `priority/high`, `priority/medium`, `priority/low`
*   **Status:** `status/blocked`, `status/in-progress`, `status/needs-review`

## Milestones (MVP Sprint)
1.  **Day 1: Foundation** (Due Date: Sprint Day 1)
2.  **Day 2: Core Features** (Due Date: Sprint Day 2)
3.  **Day 3: Polish & Ship** (Due Date: Sprint Day 3)

---

## Issue Templates

### Feature Template (`.github/ISSUE_TEMPLATE/feature.md`)
```markdown
---
name: Feature Request
about: Propose a new feature for the API or Web application
title: 'feat([api/web/shared]): '
labels: 'type/feature'
assignees: ''
---

## Description
<!-- Brief description of the feature -->

## Affected App/Package
- [ ] `apps/api` (NestJS)
- [ ] `apps/web` (Next.js)
- [ ] `packages/ui`
- [ ] `packages/config`

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2

## Technical Notes
<!-- For API: DTOs, Drizzle schemas, Endpoints -->
<!-- For Web: Components, state, routes -->
```

---

## 20 Key Sample Issues

1.  **[API] Init NestJS app in Turborepo** `area/api` `type/setup`
2.  **[Web] Init Next.js app in Turborepo** `area/web` `type/setup`
3.  **[Shared] Setup ESLint/Prettier configs** `area/shared` `type/chore`
4.  **[API] Configure Drizzle ORM and Postgres connection** `area/api` `type/feature`
5.  **[API] Define DB Schema (Users, Clients, Invoices)** `area/api` `type/feature`
6.  **[API] Implement Passport JWT Strategy** `area/api` `type/feature`
7.  **[API] Create Auth Controller (Login/Register)** `area/api` `type/feature`
8.  **[Web] Setup shadcn/ui and Tailwind in web app** `area/web` `type/setup`
9.  **[Web] Build Login and Register Pages** `area/web` `type/feature`
10. **[Web] Configure React Query API Client** `area/web` `type/setup`
11. **[API] Build Client CRUD Module** `area/api` `type/feature`
12. **[Web] Build Clients Dashboard and Forms** `area/web` `type/feature`
13. **[API] Build Invoice Module with Line Items** `area/api` `type/feature`
14. **[Web] Build Dynamic Invoice Creation Form** `area/web` `type/feature`
15. **[API] Setup PDF Generation Service for Invoices** `area/api` `type/feature`
16. **[API] Build Expense Module with Multer File Upload** `area/api` `type/feature`
17. **[Web] Build Expense Tracking UI** `area/web` `type/feature`
18. **[API] Dashboard Aggregation Endpoints** `area/api` `type/feature`
19. **[DevOps] Deploy API and DB to Railway** `area/devops` `type/chore`
20. **[DevOps] Deploy Next.js to Vercel** `area/devops` `type/chore`

---

## Project Board Columns (GitHub Projects)

*   **Backlog:** Tasks identified but not ready.
*   **To Do:** Ready for dev, assigned to sprint day.
*   **In Progress:** Dev currently working on it.
*   **In Review:** PR open, needs review.
*   **Done:** Merged and deployed to staging.

---

## Pull Request Template (`.github/PULL_REQUEST_TEMPLATE.md`)
```markdown
## Description
<!-- Describe your changes -->
Resolves #

## Monorepo Checklist
- [ ] `apps/api` changes included
- [ ] `apps/web` changes included
- [ ] `packages/*` changes included
- [ ] `turbo build` passes locally

## API Changes (If applicable)
- [ ] Drizzle migrations generated?
- [ ] Swagger documentation updated?
- [ ] Are there breaking changes to API contracts?

## Frontend Changes (If applicable)
- [ ] Responsive design verified?
- [ ] Follows shadcn/ui standards?
```
