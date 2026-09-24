# NWB-P1-012 — Observability baseline (request logs, correlation IDs, error tracking, readiness probe)

Type: task
Status: done (2026-09-24 — typecheck + `bun run lint` + build exit 0 + **809/809** `bun test` with a live PostgreSQL (778 before), `coverage:check` green at 92.9% services / 96.8% lib; live smoke against `bun run dev` — see Comments)
Blocked by: NWB-P1-002 (audit registry — done)
Phase: P1 (roadmap Phase 2 · §12)
Size: M

## Why this exists

Roadmap §12 NWB-P1-012: *"Structured JSON logs (request id, org id, user id, duration), correlation
IDs (reuse `requestId` field already in audit schema), error tracking, `/api/health` upgraded to a
real readiness probe (DB ping + queue depth). Infra §6.2 stack (Prometheus/Alertmanager) is wired
in Phase 8; Phase 2 makes the data exist."*

Measured state before this ticket (2026-09-24):

- `src/lib/logger.ts` exists (JSON to stderr, key-based redaction) but **has exactly one caller in
  the tree: its own test.** No request, no error, no job path ever writes a log line through it.
- A request leaves **no trace**: no method/path/status/duration line, no generated request id, no
  echo header. The only request-scoped correlation today is whatever `x-request-id` a *client*
  happens to send, read ad hoc by the approvals route (`actorContext`) and nowhere else — raw,
  unvalidated (a >100-char value would be a 22001 on `unified_audit_log.request_id`, which is
  `varchar(100)`).
- `unified_audit_log.request_id` has had an index since the schema (`idx_ual_request_id`) and the
  audit query API can filter by it (`GET /api/audit?requestId=`), but **nothing generates an id per
  request and `writeAuditLog` only receives one when a caller passes it explicitly** (approvals,
  sessions, DSAR). For every other action — `auth.signin.completed` included — the column is NULL,
  so "trace this request into the audit log" is impossible end to end. That is exactly the exit-gate
  clause: *a request can be traced by correlation id from log to audit row*.
- `errorHandler` logs **nothing** unless `NWB_DEBUG_ERRORS` is set, and then via `console.error`
  (unstructured, uncorrelated). A production 500 today produces zero server-side evidence.
- `/api/health` returns a static `{ status: "ok" }` — it answers 200 with the database down.

## Scope (in)

1. **Request context middleware** — one id per request:
   - Inbound `x-request-id` honored when 1..100 chars (fits `request_id`); otherwise generated
     `req_<uuid>`. Always echoed on the response.
   - Set in the Hono context (`c.var.requestId`) **and** in a request-scope AsyncLocalStorage
     (`src/lib/request-context.ts`) so code without the Hono context (services, audit writes) can
     read it.
2. **Access log** — one structured line per request via `logger.info`:
   `requestId, method, route, status, durationMs` + `orgId, userId, authMethod` when authenticated.
   - `route` is Hono's **route template** (`/api/auth/invitations/:token`), not the raw path — a
     path-param can be a live single-use token (invitation, MFA), and logs must not become a place
     where one lingers (same reasoning as pg-boss `deleteAfterSeconds 3600` for the email outbox).
     Falls back to the raw path for 404s (no matched template).
   - `/api/health` is excluded — a probe every few seconds is not an application request, and the
     endpoint self-reports its state.
3. **Audit correlation** — `writeAuditLog` defaults `requestId` from the request-scope ALS when the
   caller did not pass one. Explicit params still win (DSAR's self-cite is a domain id, not the HTTP
   one). Outside a request (workers, CLI) → NULL, unchanged.
4. **Error tracking** — `errorHandler` writes a structured `logger.error` line for every 5xx
   (and any non-`AppError`): requestId, method, route, status, error name/message; stack only under
   `NWB_DEBUG_ERRORS`. 4xx `AppError`s stay on the access line (status is the signal; the response
   body already carries the code). Client responses remain opaque — this is server-side only.
5. **Readiness probe** — `/api/health` performs a DB ping (`SELECT 1`) and a queue depth read
   (pg-boss `getQueues()` over `QUEUE_JOB_NAMES`, via a new `src/lib/queue.ts` helper):
   - DB ok → 200; DB down → **503** `status: "error"` (the hard dependency — auth cannot serve).
   - Queue: `disabled` (no runtime — legal config per ADR-007), `ok` (+depth), or `error` → overall
     `degraded` **but still 200** — an API hostage to its queue is unoperatable (ADR-007, same
     stance `src/index.ts` takes at boot); email already falls back to direct send.
   - `createApp()` (no injected db) reports `database: not-configured` and does not lie about ping.
6. **Corrections along the way**: approvals `actorContext` reads the normalized `c.var.requestId`
   instead of the raw header (kills the latent 22001); test-client's no-op db answers the `SELECT 1`
   readiness ping and still throws on anything else.

## Scope (out)

- **Server Functions**: the local `createServerFn` shim has no function identity (no name to log)
  and no incoming-request handle — SF access/error logging lands with the real TanStack Start
  toolchain (P14). SF audit writes keep passing explicit ids where they have one (DSAR); they get
  NULL from the ALS until then. Recorded so the gap is a decision, not an oversight.
- Log level gating (`LOG_LEVEL`), sampling, metrics/Prometheus, tracing (OTel), Sentry — Phase 8
  (roadmap §12: "Infra §6.2 stack is wired in Phase 8; Phase 2 makes the data exist").
- Queue/job-side logging: workers already audit both outcomes through `src/lib/worker.ts`
  (NWB-P1-001); startup banners in `src/index.ts` stay as-is.

## Exit criteria / acceptance

- [ ] Every `/api/*` request emits exactly one access-log line carrying `requestId`, `method`,
      `route` (template), `status`, `durationMs`; authenticated requests add `orgId`/`userId`.
- [ ] `x-request-id` honored (≤100 chars) and echoed; absent/oversized → generated `req_<uuid>`.
- [ ] Log → audit row trace holds end to end: sign in with `x-request-id`, the
      `auth.signin.completed` row's `request_id` equals it, and `GET /api/audit?requestId=` finds it.
- [ ] A thrown non-`AppError` produces a `logger.error` line with the request id and the real
      message; the client still sees the opaque `INTERNAL_ERROR`. `NWB_DEBUG_ERRORS` adds `stack`.
- [ ] `/api/health` returns 503 with `status: "error"` when the database is unreachable, 200 +
      depth when the queue runs, 200 + `degraded` when a started queue errors, 200 + `disabled`
      when there is no queue runtime.
- [ ] No live token can appear in a log line (route template, not raw path).
- [ ] Gates: `bun run typecheck`, `bunx biome check .`, `bun run build`, full `bun test` with
      `DATABASE_URL`, `bun run coverage` + `coverage:check` (services ≥85%, lib ≥90%).

## Design decisions (this ticket's own calls)

| # | Decision | Rationale |
|---|---|---|
| 1 | Request id lives in **both** Hono context and a dedicated ALS | Services and `writeAuditLog` cannot see `c`; a second ALS (vs extending `OrgContext`) because audit runs in workers too, where there is no org and `getOrgContext()` throws by contract. |
| 2 | ALS default in `writeAuditLog`, explicit param wins | One insertion point covers every audited action instead of threading `requestId` through dozens of call sites; DSAR's domain id is not overwritten. |
| 3 | Access log uses **route templates** | Path params carry single-use tokens; logs must not hold them. Also gives stable metric cardinality for free. |
| 4 | 5xx always logged server-side; stack behind `NWB_DEBUG_ERRORS` | Error tracking that needs a dev flag tracks nothing. The flag's existing meaning (verbose detail) is preserved; the client-facing opacity contract is untouched. |
| 5 | Queue failure → `degraded`, still 200; DB failure → 503 | Readiness must mirror ADR-007: the API serves without the queue by design. |
| 6 | Health excluded from the access log | Probe noise; the endpoint reports its own state. |

## Exit criteria / acceptance (checked 2026-09-24)

- [x] Every `/api/*` request emits exactly one access-log line carrying `requestId`, `method`,
      `route` (template), `status`, `durationMs`; authenticated requests add `orgId`/`userId` —
      `src/tests/observability.test.ts` (access log describe) + live smoke.
- [x] `x-request-id` honored (≤100 chars) and echoed; absent/oversized → generated `req_<uuid>`.
- [x] Log → audit row trace: sign-in under `x-request-id` → `auth.signin.completed.request_id`
      equals it, and `GET /api/audit?requestId=` finds the org-scoped action of a second request
      (the same test proves `writeAuditLog`'s ALS default, explicit-wins, and NULL outside a
      request).
- [x] A thrown non-`AppError` produces a `logger.error` line with the request id and the real
      message; the client still sees the opaque `INTERNAL_ERROR`. `NWB_DEBUG_ERRORS` adds `stack`.
- [x] `/api/health`: 503 + `error` when the database is unreachable; 200 + depth with a running
      queue (live: `{"database":{"status":"ok","latencyMs":10},"queue":{"status":"ok","depth":…}}`);
      200 + `degraded` when a started queue errors; 200 + `disabled` when there is no runtime.
- [x] No live token in a log line — live check: `GET /api/auth/invitations/tok_…` logs
      `"route":"/api/auth/invitations/:token"`, never the token.
- [x] Gates: typecheck, `bun run lint`, `bun run build`, full `bun test` **809 pass / 0 fail**
      with `DATABASE_URL` (778 before this ticket), `coverage:check` green
      (services 92.9% ≥ 85, lib 96.8% ≥ 90).

## Comments

### Delivered

- `src/lib/request-context.ts` — the request-scope ALS (`runWithRequestId` / `currentRequestId`).
- `src/server/middleware/request-context.ts` — id assignment + echo + access log; registered
  **first** in both app factories; exports `resolveRequestId`, `endpointRoute`.
- `src/server/health.ts` — `collectHealth` (unit-testable with injected `queueDepth`) + the route
  handler; `createAppWithDb` passes its db, `createApp` passes none (`not-configured`).
- `src/lib/queue.ts` — `queueDepthFrom` (pure, fake-testable) + `getQueueDepth` (the singleton
  wrapper); the pg-boss `getQueues` call stays inside queue.ts per that file's ownership rule.
- `src/server/middleware/error-handler.ts` — always-on structured 5xx lines; `NWB_DEBUG_ERRORS`
  keeps adding stacks and now also dumps 4xx (its old reach, re-leveled to `warn`).
- `src/services/audit/write.ts` — `requestId ?? currentRequestId() ?? null`.
- `src/server/api/approvals/approval.route.ts` — `actorContext` reads `c.var.requestId`
  (normalised) instead of the raw header; kills a latent 22001 above 100 chars.
- Tests: `src/tests/observability.test.ts` (23), `src/tests/queue/depth.test.ts` (4), one live
  `getQueueDepth` test in `queue/loop.test.ts`, health/ logger suite updates.
- `src/tests/preload.ts` silences the shared logger for the run (per-request lines would bury the
  output) and exports `realLogWriters` so `logger.test` still exercises the real JSON writer.

### Findings worth keeping

1. **`c.req.routePath` is frame-local.** It reports the pattern of the frame you are standing in
   (a middleware's `/api/audit/*`, or the catch-all `/*` on a 404) — not reliably the endpoint.
   The log uses the **last non-catch-all entry of `c.req.matchedRoutes`**, which is the full chain
   computed upfront and includes the endpoint even when the request died in an earlier middleware
   (verified against hono 4.13's `compose`: each frame resolves inner errors through `onError`,
   so `await next()` normally sees a *response*, and the catch branch here fires mainly for
   non-`Error` throws).
2. **`bun run lint` was red at HEAD** (`c6e6479`): formatting drift in `src/lib/errors.ts`,
   `src/lib/validation/index.ts`, `src/app/server-functions/index.ts` — the same class as
   NWB-P0-027. `bunx biome check . --write` (part of this ticket's gate run) fixed them; this
   branch is green.
3. **The audit API filters orgless rows behind a platform capability.** `auth.signin.completed`
   has `organization_id IS NULL`, so an org owner's `GET /api/audit?requestId=` cannot see it
   (`resolveScope` → `includeOrgless` only for `super_admin`). The e2e test therefore proves the
   SQL side with the sign-in row and the API side with an org-scoped `apikeys.created` row —
   recorded here so nobody "fixes" the filter into a cross-tenant leak later.
4. **Preflights are excluded from the access log** along with health: a browser preflight
   (`OPTIONS`) of a token-bearing GET would otherwise be the one place the raw path still gets
   logged (no endpoint template is matched on a method mismatch).

### Deferred, deliberately (see Scope-out above)

Server Function access/error logging (needs the real TanStack toolchain for function identity —
the local shim has no name to log), `LOG_LEVEL`, metrics/OTel/Sentry (Phase 8).
