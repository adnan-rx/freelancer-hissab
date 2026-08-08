# Deployment Plan

## 1. Infrastructure Overview

The deployment architecture separates the frontend and backend into two distinct environments to leverage the best platforms for each technology.

```mermaid
graph LR
    Client[Browser/Mobile] -->|HTTPS| Frontend[Vercel\nNext.js]
    Client -->|HTTPS| Backend[Railway\nNestJS API]
    Frontend -->|Server Components| Backend
    Backend -->|TCP| DB[(Railway\nPostgreSQL)]
    Backend -->|SMTP| Email[Resend]
```

- **Vercel**: Next.js frontend hosting (Free tier). Provides global CDN, automatic deployments, and excellent Next.js support.
- **Railway**: NestJS API + PostgreSQL (Starter plan $5/mo). Provides easy containerized deployments and managed PostgreSQL databases.
- **Resend**: Transactional emails (Free tier).
- **Storage**: Railway volume or Vercel Blob for invoice/receipt uploads.

## 2. Environment Setup

We maintain three distinct environments:

| Environment | Frontend (Next.js) | Backend (NestJS) | Database (PostgreSQL) |
|-------------|--------------------|------------------|-----------------------|
| **Local / Dev** | Local (Port 3000) | Local (Port 3001) | Local Docker / Postgres |
| **Staging** | Vercel Preview | Railway PR Environment | Railway PR DB |
| **Production**| Vercel Production | Railway Production | Railway Prod DB |

## 3. Environment Variables

### Backend (`apps/api/.env`)
```env
# Application
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://freelancerhissab.com

# Database
DATABASE_URL=postgresql://postgres:password@host:port/freelancerhissab

# Authentication (JWT)
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# External Services
GOOGLE_CLIENT_ID=your-google-client-id
RESEND_API_KEY=re_your-resend-key
```

### Frontend (`apps/web/.env.local`)
```env
NEXT_PUBLIC_APP_URL=https://freelancerhissab.com
NEXT_PUBLIC_API_URL=https://api.freelancerhissab.com
```

## 4. CI/CD Pipeline

We use Turborepo for efficient builds and GitHub Actions/Platform integrations for deployment.

```mermaid
graph TD
    Push[Push to GitHub] --> Check[Turborepo check changed packages]
    
    Check --> LintTest[Lint & Type Check & Test]
    
    LintTest --> BuildWeb{Is Web Changed?}
    BuildWeb -->|Yes| VercelDeploy[Vercel Auto-deploy]
    
    LintTest --> BuildAPI{Is API Changed?}
    BuildAPI -->|Yes| RailwayDeploy[Railway Auto-deploy]
```

### GitHub Actions Workflow (`.github/workflows/ci.yml`)
```yaml
name: CI

on:
  push:
    branches: ["main"]
  pull_request:
    types: [opened, synchronize]

jobs:
  build:
    name: Build and Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm turbo run lint typecheck test
```
*Note: Deployment is handled via Vercel/Railway GitHub integrations rather than raw GitHub Actions to simplify the MVP.*

## 5. NestJS Deployment on Railway

1. **Service Setup**: Connect GitHub repo to Railway, create a new Web Service pointing to `apps/api`.
2. **Build Configuration**: Railway Nixpacks will auto-detect NestJS. Ensure the start command is:
   ```bash
   node dist/main.js
   ```
   *Note: Using Turborepo, the root directory in Railway might need to be `/`, and build command `npx turbo run build --filter=api`.*
3. **Database**: Add PostgreSQL plugin in Railway. Link the `DATABASE_URL` to the API service.
4. **Health Check**: Configure Railway health check to ping `GET /api/v1/health`.
5. **Migrations**: Add a custom build/start script in package.json to run Drizzle migrations before starting:
   ```json
   "start:prod": "node dist/migration.js && node dist/main.js"
   ```

## 6. Next.js Deployment on Vercel

1. **Service Setup**: Connect GitHub repo to Vercel.
2. **Project Configuration**:
   - Framework Preset: Next.js
   - Root Directory: `apps/web`
   - Build Command: `cd ../.. && npx turbo run build --filter=web`
   - Install Command: `cd ../.. && pnpm install` (or npm depending on package manager)
3. **Domains**: Assign custom domain (e.g., freelancerhissab.com).

## 7. Database Management

- **Provider**: Railway Managed PostgreSQL.
- **ORM**: Drizzle ORM + postgres.js.
- **Migrations**: Handled via `drizzle-kit`.
  - Dev: `npx drizzle-kit push` or `npx drizzle-kit generate && npx drizzle-kit migrate`
  - Prod: Migrations run automatically during the Railway deployment phase.
- **Backups**: Railway handles automated daily backups.
- **Seeding**: Provide a `seed.ts` script in the API package to populate default categories, settings, etc.

## 8. Monitoring and Observability

- **API Metrics**: Railway built-in metrics (CPU, Memory, Network).
- **Frontend Metrics**: Vercel Web Vitals & Analytics.
- **Error Tracking**: Sentry integrated into both Next.js and NestJS.
- **Logging**: NestJS built-in logger (Pino recommended for JSON logs in production).

## 9. Security Checklist

- [ ] **HTTPS**: Enforced automatically by Vercel and Railway.
- [ ] **CORS**: NestJS configured to only accept requests from the Vercel domain.
- [ ] **Rate Limiting**: NestJS `@nestjs/throttler` applied globally (e.g., 100 req/min per IP).
- [ ] **Helmet**: `helmet()` middleware in NestJS to set secure HTTP headers.
- [ ] **Auth**: JWT with short expiration and HTTP-only refresh tokens (if implementing refresh mechanism), or standard bearer tokens sent over HTTPS.
- [ ] **Validation**: Strict validation using `class-validator` and `ValidationPipe(whitelist: true)`.

## 10. Cost Estimate (MVP)

| Service | Plan / Usage | Monthly Cost |
|---------|--------------|--------------|
| Vercel | Hobby / Free Tier | $0 |
| Railway | Developer / Starter | ~$5 |
| Resend | Free Tier (100 emails/day) | $0 |
| Domain | Namecheap/GoDaddy (Yearly ~$12) | ~$1 |
| **Total** | **Estimated Monthly Cost** | **~$6/mo** |
