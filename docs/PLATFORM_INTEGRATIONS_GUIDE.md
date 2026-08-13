# Platform Integrations

How FreelancerHisab pulls earnings, fees, clients and invoices out of freelance
marketplaces and into the ledger — automatically where an official API allows it,
and by statement import where it does not.

---

## 1. Research findings

Everything below was verified against first-party sources before any code was
written. Where a platform cannot be synced automatically, that is stated as a
fact about the platform, not hidden behind a "coming soon".

| | **Upwork** | **Fiverr** | **Freelancer.com** | **Toptal** |
|---|---|---|---|---|
| Official developer API | Yes (GraphQL) | Affiliate API only | Yes (REST v0.1) | None |
| OAuth 2.0 | Yes | — | Yes | — |
| **Financial ledger endpoint** | **Yes** — `transactionHistory` | No | **No** | No |
| Earnings amounts | Yes | — | Milestones only | — |
| Platform fees | Yes (separate ledger rows) | — | Not exposed | — |
| Client/counterparty | Yes | — | Via project lookup | — |
| Date filtering (incremental) | Yes — `transactionDateTime_bt` | — | — | — |
| Pagination | 50/page on paginated queries | — | `limit`/`offset` | — |
| Rate limits | Undocumented; official client spaces requests ~1s | — | Undocumented | — |
| Token expiry | `expires_in`, refresh-token grant | — | Refresh supported | — |
| Webhooks | Yes, but not for financial events | — | — | — |
| **Verdict** | **Automatic sync** | **CSV import** | **CSV import** | **CSV import** |

### Upwork — the one platform with a usable financial API

Confirmed from Upwork's own published Power BI connector
([github.com/upwork/powerbi-connector](https://github.com/upwork/powerbi-connector))
and the [GraphQL API docs](https://www.upwork.com/developer/documentation/graphql/api/docs/index.html):

- **Authorize** `https://www.upwork.com/ab/account-security/oauth2/authorize`
- **Token** `https://www.upwork.com/api/v3/oauth2/token` — note this is on
  `www.upwork.com`, *not* `api.upwork.com`. The previous implementation had this
  wrong and could never have exchanged a real code.
- **GraphQL** `https://api.upwork.com/graphql`, optional `X-Upwork-API-TenantId` header
- Scopes are granted against the registered API key, so **no `scope` parameter**
  is sent on the authorize request.
- The ledger query needs an accounting entity id first:
  ```graphql
  query { accountingEntity { id } }
  ```
  then
  ```graphql
  transactionHistory(transactionHistoryFilter: {
    aceIds_any: [$aceId],
    transactionDateTime_bt: { rangeStart: $from, rangeEnd: $to }
  }) { transactionDetail { transactionHistoryRow {
        recordId accountingSubtype transactionCreationDate
        transactionAmount { rawValue currency } type
        assignmentDeveloperName assignmentCompanyName } } }
  ```
  `recordId` is the stable per-transaction identifier that makes sync idempotent.

### Fiverr

Fiverr publishes **no public API for a seller's own earnings** — only an
affiliate API for promoting gigs. Everything else on the market is a scraper.
We do not scrape, so Fiverr is statement import.

### Freelancer.com

Freelancer.com genuinely has an official OAuth 2.0 API
(`https://www.freelancer.com/api/projects/0.1/`, auth header
`Freelancer-OAuth-V1`). Its documented surface — confirmed against the official
Python SDK — covers projects, bids, milestones, contests, users and messages.
There is **no transactions or earnings resource**: no net amounts and no
commission fees. Reconstructing accounts from milestone records alone would
systematically understate fees, so this is statement import. The connector is
already in place; the day a payments endpoint appears, only that connector changes.

### Toptal

No developer API, no OAuth, no public endpoints. Statement import.

---

## 2. Architecture

```
                       ┌──────────────────────────┐
   OAuth platform ────▶│   Platform connector     │
   (Upwork)            │   (fetch + normalize)    │
                       └────────────┬─────────────┘
                                    │
   CSV statement ──▶ CsvService ────┤   both emit NormalizedTransaction[]
   (Fiverr, Freelancer,             │
    Toptal, generic)                ▼
                       ┌──────────────────────────┐
                       │    ImportEngineService   │
                       │  ── deduplicate          │
                       │  ── resolve client       │
                       │  ── resolve invoice      │
                       │  ── convert currency     │
                       │  ── persist              │
                       └────────────┬─────────────┘
                                    ▼
              clients · invoices · invoice_items · income · expenses
                                    │
                                    ▼
     dashboard · reports · tax · filing · wealth reconciliation · analytics
                              (all unchanged)
```

### Key decisions

**One transaction model.** `NormalizedTransaction` is the only shape that crosses
the connector boundary. No Upwork GraphQL field and no CSV column name exists
anywhere downstream. Adding a platform means writing a connector; nothing else
changes.

**One import engine, two sources.** API sync and CSV import share
`ImportEngineService` end to end. This removed roughly 450 lines of duplicated
persistence logic (two separate get-or-create-client implementations, two invoice
builders, two dedup schemes) and — more importantly — guarantees a CSV-imported
invoice is the same kind of record as an API-synced one. There is no "imported"
code path in any downstream feature.

**The integration layer owns no tax rules.** The engine never derives an SBP
purpose code, a tax rate or a classification. It writes a regulatory field only
when the *source statement* explicitly stated one; otherwise the column default
stands and the existing tax engine decides. The previous implementation hardcoded
`sbpPurposeCode: '9100'` on every synced income row.

**Connectors describe reality.** `PlatformMetadata.capabilities` is served to the
UI, and the UI renders entirely from it. A platform whose connector reports
`automaticSync: false` cannot be shown as connectable, and the registry refuses
to start an OAuth flow for it (`getSyncableConnector`). Making a platform *look*
integrated now requires lying in the connector, where a test catches it.

---

## 3. Database changes

One migration, `0011_black_klaw.sql`, fully additive:

```sql
ALTER TABLE "income"   ADD COLUMN "external_id" varchar(255);
ALTER TABLE "expenses" ADD COLUMN "external_id" varchar(255);
CREATE UNIQUE INDEX "income_user_external_id_idx"  ON "income"   ("user_id","external_id");
CREATE UNIQUE INDEX "expense_user_external_id_idx" ON "expenses" ("user_id","external_id");
```

**Backward compatibility.** The column is nullable and existing rows get `NULL`.
Postgres treats `NULL`s as distinct in a unique index, so the constraint only
applies to imported rows and hand-entered records are entirely unaffected. Verified
by running every migration against a fresh database (§5).

`platform_connections` and `platform_sync_logs` were already present from the
earlier local work and were kept as-is — the schema was sound.

No other table changed. Clients, invoices, invoice items, income and expenses are
written exactly as the manual flows write them.

---

## 4. Synchronization flow

```
Connect              → getAuthUrl → signed state → platform consent → callback
                     → exchange code → encrypt tokens → store → initial sync
Sync now (manual)    → preview (writes nothing) → user confirms → apply
Background (6-hourly)→ apply directly
Reconnect            → same authorize flow; updates the row in place
```

### Idempotency

Every record carries `external_id = "<platform>:<platform transaction id>"`.
Before writing, the engine loads the user's existing external ids and skips
anything already present. Two independent layers:

1. **External id** (primary). Survives description edits, amount re-statements and
   partial re-syncs. Because it is the platform's own id, two genuinely identical
   transactions on the same day are correctly kept as two records — the old
   `date|amount|description` signature silently merged them, losing money.
2. **Content signature against manual entries only** (secondary). If you booked a
   payment by hand and then import the statement containing it, the import is
   skipped. Restricted to rows with no `external_id`, so it can never collapse
   two real imported transactions.
3. **The unique index** backs both up at the database level, so even a bug in the
   engine cannot produce a duplicate.

CSV rows without a reference column get a content hash plus an occurrence
counter: re-uploading the same file is a no-op, while a file legitimately
containing the same transaction twice still imports both.

### Incremental sync

`lastSuccessfulSyncAt` is the cursor. Each run asks the platform only for activity
since then, **minus a 24-hour overlap** — platforms can back-date a transaction
after it settles, and re-reading a day costs nothing because dedup discards it.
A failed run deliberately does not advance the cursor, so the missed window is
retried rather than lost.

### Credentials

- AES-256-GCM at rest, key from `INTEGRATION_ENCRYPTION_KEY` (falls back to
  `JWT_SECRET`). **In production the app refuses to operate without one** — the
  previous committed fallback key would have made every deployment's stored
  refresh tokens decryptable by anyone with the source.
- Tokens are refreshed 5 minutes before expiry. Rotated refresh tokens are stored;
  providers that don't rotate keep the original.
- A failed refresh marks the connection `expired` and surfaces a reconnect prompt.
- Every API response is built by `toPublicConnection`, which constructs a fresh
  object from named fields. The public type has no field capable of holding a
  token.
- OAuth `state` is an HMAC-signed payload bound to the user, platform and issue
  time (10-minute TTL), verified on callback. Previously `state` was generated and
  never checked.

---

## 5. Testing results

### Unit / service suite — `npm test` (apps/api)

```
Test Suites: 15 passed, 15 total
Tests:       139 passed, 139 total
```

38 of those cover integrations, 24 cover CSV import. Coverage includes token
encryption round-trip and tamper rejection, OAuth state forgery and cross-user
replay, capability honesty for all five platforms, client/invoice/income/expense
creation, repeat-sync idempotency, in-batch duplicate ids, case-insensitive client
matching, platform-enum mapping, preview-writes-nothing, token refresh with and
without rotation, refresh failure → reconnect, failed sync bookkeeping, cross-user
access rejection, connect/reconnect/disconnect, and the background scheduler.

### End-to-end — `npm run test:e2e` (apps/api, needs a throwaway Postgres)

Runs the real migrations against a fresh database and drives the real services —
no mock DB — through the full lifecycle. **68/68 checks passed.**

```
createdb fh_e2e
E2E_DATABASE_URL=postgresql://user:pass@localhost:5432/fh_e2e npm run test:e2e
```

| Area | Verified |
|---|---|
| Migrations | All apply to a fresh DB; columns and unique indexes created |
| Connection flow | Connect, tokens encrypted at rest, no token in any response |
| OAuth flow | Signed state issued and verified; forged/cross-user state rejected |
| Token refresh | Expired token refreshed mid-sync, re-encrypted, sync proceeds |
| Expired tokens | Failed refresh → `expired` status → reconnect message |
| Reconnect | Updates the same row; history and cursor preserved |
| Client creation | Created once, reused case-insensitively across syncs |
| Invoice creation | Invoice + line item per transaction, linked to the client |
| Income creation | Linked to client and invoice; per-currency FX (USD 280, EUR 300) |
| Expense creation | Platform fee booked with the marketplace as vendor |
| Duplicate sync | 3 consecutive syncs → 0 new records, ledger byte-identical |
| DB-level dedup | Direct insert of a duplicate `external_id` rejected by the index |
| Failed sync | Logged, connection flagged, **cursor not advanced** |
| Incremental | Second run bounded by the cursor; new transaction imported |
| Preview | Totals and new-client detection correct; row count unchanged |
| CSV fallback | Same engine, same record shape, idempotent re-import |
| CSV-only platforms | All four refuse OAuth and state their limitation |
| Dashboard | Reports imported income and fees |
| Transactions | Feed lists imported income and expense rows |
| Tax | Export income, expenses, net profit and liability computed from imports |
| Filing | Readiness score and checklist compute over imported records |
| Reports | Income-vs-expenses and platform consolidation include imports |
| Disconnect | Connection removed, ledger fully intact |

### Type checking and build

`tsc --noEmit` clean on both apps; `nest build` and `next build` both succeed.
No `any` in any new or rewritten file — a `Database` / `DbTransaction` type alias
in `src/database/types.ts` replaces it for the Drizzle handle.

---

## 6. Known limitations

- **Only Upwork syncs automatically.** This is a property of the platforms, not
  the architecture. Fiverr and Toptal publish nothing; Freelancer.com publishes an
  API without a financial ledger.
- **Upwork's `transactionHistory` is unpaginated** in the schema Upwork's own
  connector uses. Very large date ranges rely on the platform returning the full
  set. The 24-hour incremental window keeps normal operation far from any limit,
  but a first sync on a decade-old account with a huge history is untested against
  the live API.
- **Live Upwork calls are untested against the real service.** The endpoints,
  query and field names come from Upwork's own connector, but no credentials were
  available here, so the transport layer has not been exercised against production
  Upwork. Everything downstream of the connector is covered.
- **Background sync is an in-process timer.** With multiple API instances every
  instance sweeps. Harmless — dedup makes a double sync a no-op — but it wastes
  outbound API calls. Marked with a `ponytail:` comment in
  `integrations-scheduler.service.ts`.
- **Preview then confirm re-fetches** from the platform. Between the two calls a
  new transaction can appear, so the imported count may exceed the previewed one.
  It never imports anything the user has not seen a total for, and the result
  reports what actually happened.
- **Background sync does not preview** — it cannot, since nobody is present to
  confirm. The preview gate applies to manual sync and CSV import.
- **Rate limiting is a fixed 1-second spacing**, matching Upwork's official client.
  There is no adaptive backoff beyond surfacing HTTP 429 as a retryable error.
- **FX rate is the rate at import time**, not at transaction time, unless the user
  supplies an override on a CSV import. This matches the pre-existing behaviour of
  the manual income flow.

## 7. Future improvements

- Move background sync to a locked job queue (advisory lock or a jobs table) when
  the API runs more than one instance.
- Per-connection sync interval and a user-facing "sync every N hours" setting.
- Upwork contract/assignment enrichment: `relatedAssignment` could populate
  invoice line-item detail beyond the current single summary line.
- Store the previewed batch server-side for a short TTL so confirm imports exactly
  what was previewed.
- Freelancer.com automatic sync, if and when a payments endpoint is published —
  only `freelancer.connector.ts` would change.
- Per-platform statement column profiles, so an exotic export can be mapped
  without touching the shared alias table.
- Surface `platform_sync_logs` failures as in-app notifications rather than only
  on the connection card.

---

## 8. Configuration

| Variable | Required | Purpose |
|---|---|---|
| `INTEGRATION_ENCRYPTION_KEY` | Production (or `JWT_SECRET`) | Encrypts stored OAuth tokens and signs OAuth state |
| `UPWORK_CLIENT_ID` | For Upwork sync | Upwork API key |
| `UPWORK_CLIENT_SECRET` | For Upwork sync | Upwork API secret |
| `CORS_ORIGIN` | No | Default OAuth redirect origin |
| `INTEGRATIONS_BACKGROUND_SYNC` | No | Set to `off` to disable the scheduler |

Without Upwork credentials the connector fails with a clear "not configured on
this server" message rather than pretending to connect.

## 9. API surface

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/integrations/platforms` | Supported platforms and real capabilities |
| `GET` | `/integrations/connections` | Connected accounts (never includes tokens) |
| `GET` | `/integrations/connect/:platform/auth-url` | Begin authorization |
| `POST` | `/integrations/connect/:platform/callback` | Complete authorization / reconnect |
| `POST` | `/integrations/:id/sync/preview` | Dry run — writes nothing |
| `POST` | `/integrations/:id/sync` | Import |
| `GET` | `/integrations/:id/logs` | Sync audit trail |
| `DELETE` | `/integrations/:id` | Disconnect (ledger preserved) |
| `POST` | `/csv/preview` | Statement dry run |
| `POST` | `/csv/import` | Statement import |
