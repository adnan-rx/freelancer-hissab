# Testing Strategy: FreelancerHisab

This document outlines the testing strategy for the FreelancerHisab platform to ensure reliability, correctness, and a stable financial workflow for our users.

## 1. Monorepo Test Orchestration
*   **Turborepo**: Test execution across the monorepo is orchestrated via Turborepo.
*   **Command**: Running `turbo run test` will execute tests concurrently in all workspaces (`apps/web`, `apps/api`, `packages/*`) that define a `test` script, utilizing caching to speed up CI/CD runs.

## 2. Backend Testing (NestJS)
The `apps/api` workspace focuses on ensuring business logic and data access correctness.

*   **Unit Tests (Vitest)**:
    *   **Scope**: Services, utility functions, and Repositories.
    *   **Approach**: Mock external dependencies and the Drizzle ORM layer to test business logic in isolation.
    *   **Tooling**: Use NestJS testing utilities like `Test.createTestingModule()` to instantiate isolated providers.
*   **Integration Tests**:
    *   **Scope**: Controllers and Guards.
    *   **Approach**: Test HTTP endpoints using `supertest`. Ensure request validation (DTOs), routing, and security guards are functioning properly without hitting the real database.
*   **E2E (End-to-End) Tests**:
    *   **Scope**: Full API request lifecycle (Controller → Service → Repository → Database).
    *   **Approach**: Run tests against a dedicated ephemeral test database (PostgreSQL container). Test critical flows like authentication, invoice creation, and expense logging to ensure all layers integrate correctly.

## 3. Frontend Testing (Next.js)
The `apps/web` workspace focuses on user interface correctness and API interaction.

*   **Unit Tests (Vitest + React Testing Library)**:
    *   **Scope**: Individual UI components, custom hooks, and utility functions.
    *   **Approach**: Render components in isolation, simulate user events (clicks, typing), and assert on the resulting DOM state or hook output.
*   **Integration Tests (MSW)**:
    *   **Scope**: Page-level components and complex UI flows involving data fetching.
    *   **Approach**: Use Mock Service Worker (MSW) to intercept outgoing HTTP requests and return mock NestJS API responses. This allows testing frontend logic without requiring a running backend.
*   **E2E (End-to-End) Tests (Playwright)**:
    *   **Scope**: Critical user journeys across the entire application (e.g., logging in, creating an invoice, generating a report).
    *   **Approach**: Use Playwright to drive a real browser, clicking through the app as a real user would. These tests should cover the happy path for the core P0 MVP features.

## 4. Shared Package Testing
*   **Scope**: `packages/shared`, `packages/database`, etc.
*   **Approach**: Unit test shared utility functions, DTO validators, and complex Drizzle schema definitions (e.g., testing that custom validation logic within a schema works correctly) using Vitest.

## 5. CI Integration
*   **GitHub Actions**: Our Continuous Integration pipeline will run on every pull request and push to the main branch.
*   **Pipeline Steps**:
    1.  Install dependencies.
    2.  Run linter (`turbo run lint`).
    3.  Run type checking (`turbo run typecheck`).
    4.  Run all tests (`turbo run test`).
    5.  Run E2E tests (provisioning a test database and running Playwright).
*   **Requirement**: All PRs must pass the CI pipeline before they can be merged into the `main` branch.
