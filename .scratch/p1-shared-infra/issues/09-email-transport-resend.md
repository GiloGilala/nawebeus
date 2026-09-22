# NWB-P1-004 — Email transport: Resend adapter, durable outbox, verified-email gate

Type: task
Status: done (2026-09-22 — filed and delivered the same day; 4 scope questions answered by the operator before filing, all four took the recommendation). **Exit-gate evidence (one real Resend send) is an operator action — see Comments.**
Blocked by: NWB-P1-001 ✅ (the queue the outbox rides on), NWB-P1-002 ✅ (the registry the delivery events join)
Phase: P1 (roadmap Phase 2)
Size: M

## Why this exists

Every email the platform sends today goes to the console. `EmailTransport` (`src/services/email.ts`,
45 lines) has one implementation, `ConsoleEmailTransport`, and `emailService` is a module singleton
built from it at import time. DEC-028 (approved 2026-01-25) chose Resend; D4 in the execution plan
confirmed it and marked `Tech Stack.md` §5.8 (Nodemailer) as the doc defect. The phase exit gate
says *"email actually sends via Resend in a dev sandbox (evidence in spec.md)"*, and the roadmap
row for this ticket adds: *"also flips the Phase 1 'verification hard-block' checkbox (NWB-P0-015
note) — add the gate for `pending_verification` once real delivery exists."*

## Measured (2026-09-22)

1. **Six call sites, one contract.** `emailService.send({ to, subject, html })` in
   `signup.ts` (verification), `verification.ts` (resend), `password-reset.ts`, `email-change.ts`,
   `mfa.ts` (enabled notice), `invitation.service.ts`. All `await` it inline inside the request and
   none handles a failure — the console transport cannot fail, so a real provider outage would 500
   signups, resets and invites. Every link is already built from `APP_BASE_URL_RESOLVED`
   (NWB-P0-021); `src/tests/email-links.test.ts` pins that by `spyOn(emailService, "send")`, so the
   singleton must stay a plain object with a `send` method.
2. **No email config exists.** `config.ts` has no provider, key or sender; `.env.example` has
   none. `getConfig()` auto-loads and throws on an invalid env, so anything the email module reads
   at send time in a no-DB test (no `DATABASE_URL`) must tolerate config being unloadable.
3. **The queue base can carry an outbox but is scheduled-only today.** `QUEUE_JOB_NAMES` doubles as
   "every queue" and "every scheduled queue": `QUEUE_SCHEDULE_DEFAULTS` is `Record<QueueJobName,
   string>`, `resolveSchedules()` returns one entry per name, and `definitions.test.ts` pins the
   equality. An on-demand queue needs the two roles split. `getQueue()` exposes the started client;
   `startWorkerRuntime` ensures queues even in a worker-off process, so an API-only process with
   `QUEUE_ENABLED=true` can `send()` into a queue a separate worker drains. `src/index.ts` starts the
   server *before* the runtime, so an enqueue can race queue creation at boot — the enqueue path
   needs a fallback. pg-boss 12.33.2 `QueueOptions` has `deleteAfterSeconds` (completed-job
   retention, default 7 days) and `retentionSeconds` (unpicked-job retention, default 14 days).
4. **The worker base audits one action per job.** `runJobGuarded` writes `job.audit.action` on
   success (`info`, or `warning` for a partial run) and on failure (`warning` with a retry left,
   `critical` on the last attempt). `writeAuditSafely` sets no `organizationId`/`targetUserId`,
   because the maintenance jobs are cross-tenant. A delivery job needs (a) a different action for
   failure and (b) tenant scope from the payload. `registry.test.ts` checks each job's
   category/resourceType against the registry entry of its action.
5. **The gate has one seam.** `assertActivePrincipal` (auth middleware, both the cookie and the
   API-key branches) already reads `users.status` on every request and calls
   `assertAccountCanAuthenticate`, which allows `pending_verification` by design (NWB-P0-015,
   "the client is told via `emailVerified` and gates features itself; Phase 2 adds the server-side
   gate together with real email delivery"). The auth module doc names the error:
   `EMAIL_NOT_VERIFIED` 403 "Please verify your email address — check inbox; use resend".
6. **Fixtures that will trip the gate.** `src/tests/orgs/{org,org-deletion,role-assignment}.test.ts`
   create users via `signup()` (status `pending_verification`) and then drive `/api/orgs/*` with
   their sessions. `invitation-accept.test.ts` pins that a *new* invitee is created
   `pending_verification` with an active verification token — although the invite link was
   delivered to that very address.
7. **Resend API (verified 2026-09-22):** `POST https://api.resend.com/emails`, Bearer auth, JSON
   `{ from, to, subject, html, text?, reply_to?, tags? }` → `{ id }`; an `Idempotency-Key` request
   header dedupes for 24 h (same key + different payload → 409 `invalid_idempotent_request`);
   errors are JSON `{ statusCode, message, name }`; 429 carries `retry-after`.

## Decisions (2026-09-22, operator answered before coding)

1. **HTTP client: Bun's `fetch`, no SDK.** One endpoint; the SDK wraps the same call. The transport
   takes `fetch` as a constructor option so tests exercise the real request/response mapping
   against a fake, and a smoke script runs the real one.
2. **Delivery path: durable pg-boss outbox with direct-send fallback.** `emailService.send()`
   enqueues `email.deliver` when a started queue is available (`getQueue()`), returning
   `status: "queued"`; when there is none — or the enqueue itself fails (queue not yet created at
   boot, pg-boss down) — it sends directly and returns `sent` / `failed`. It never throws for a
   provider failure: signup, reset and invite requests do not fail because Resend did. Queue policy:
   `retryLimit 6`, `retryDelay 60`, backoff (1, 2, 4, 8, 16, 32 min ≈ 1 h of retries),
   `expireInSeconds 60`, **`deleteAfterSeconds 3600`** because payloads carry raw token links
   (`tokens` stores only hashes; the queue must not become the place where the plaintext lingers).
   The message id minted at enqueue is Resend's `Idempotency-Key`, so a retry after a
   timeout-after-accept cannot double-send.
3. **Gate: verification-limited session.** `pending_verification` accounts still sign in (the
   response still says `emailVerified: false`), but `authMiddleware` answers **403
   `EMAIL_NOT_VERIFIED`** on every route except `/api/auth/*` and `/api/users/me*` — resend,
   verify, sign-out, sessions, MFA, email-change (the typo-at-signup case), account deletion and
   the rest of self-service stay reachable so the client's verify screen has everything it needs.
   Both auth branches (cookie and API key) gate. **Invitation acceptance counts as verification:**
   a new invitee is created verified/active (the invite link proved the address) and no second
   verification token is minted. Test fixtures that sign up and then act verify through the real
   `verifyEmail`, not by editing rows.
4. **Audit: every delivery outcome, recipient masked.** The job files `email.delivered` on success
   and `email.delivery_failed` on failure (new registry actions, category `user_management`,
   resource `email`), scoped to the payload's `organizationId`/`userId` so an org admin's
   `GET /api/audit` shows their invites going out. Rows carry `j***@example.com`, the template
   `kind`, the provider and its message id — never the body, never the address. The worker base
   grows two optional hooks to make that possible: `audit.failureAction` (used on the throw path
   *and* for a partial outcome) and `audit.scope(data)`. Non-retryable provider errors (4xx other
   than 429: bad sender, invalid recipient) are returned as a failed outcome — audited, not retried;
   retryable ones (429, 5xx, network, timeout) throw so pg-boss retries. The direct-send fallback
   logs; it has no worker to audit through (documented residual for `QUEUE_ENABLED=false`).
5. **Config.** `EMAIL_PROVIDER` = `console` | `resend`, defaulting to `resend` when `RESEND_API_KEY`
   is set and `console` otherwise; `EMAIL_FROM` (required for resend, `Nawebeus <no-reply@…>`),
   `EMAIL_REPLY_TO` (optional), `RESEND_API_BASE_URL` (default `https://api.resend.com`; the smoke
   script and tests can point it elsewhere), `EMAIL_SEND_TIMEOUT_MS` (default 10 000). **A
   production process with the console provider refuses to boot** unless `EMAIL_PROVIDER=console`
   was set explicitly — an unset key must not silently turn production email into log lines.
6. **Evidence for the exit gate** is `bun run email:smoke -- --to you@example.com`: one real send
   through the configured transport (bypassing the queue), printing the Resend id. It needs an API
   key and a verified sending domain, which this sandbox does not have; the spec table records the
   clause as *tooling delivered, operator run pending* until someone runs it.

## Scope

Do:
- `src/services/email/` (replaces `email.ts`; the import paths keep resolving through `index.ts`):
  `types`, `console`, `resend` (fetch transport, retry classification, idempotency, timeout),
  `service` (`createEmailService`, lazy config-driven singleton, queue-or-direct, masking).
- `src/jobs/email-deliver.ts` + queue name, on-demand/scheduled split in `queue.ts`/`scheduler.ts`,
  worker hooks (`failureAction`, `scope`), policy with `deleteAfterSeconds`.
- Config keys + `.env.example`; `tryGetConfig()`; production console refusal.
- Registry: `email.delivered`, `email.delivery_failed`.
- Call sites: pass `kind` and tenant/user scope; behaviour otherwise unchanged.
- Gate: `EmailNotVerifiedError` (403), middleware check on both branches, exempt-path predicate;
  invitation acceptance marks the invitee verified.
- `bun run email:smoke`; AGENTS.md; spec. (~~`Tech Stack.md` §5.8 corrected to Resend~~ — struck
  2026-09-22: the operator owns that file and moved it to v1.1 on `main` the same afternoon;
  this ticket does not touch it. See Comments.)
- Tests: transport mapping against a fake fetch (2xx, 4xx non-retryable, 429 retry with
  `retry-after`, 5xx exhaustion, timeout, network error, idempotency header stable across
  retries, `to` array, from/reply-to defaults); service routing (queued / direct / enqueue
  failure falls back / transport failure returns `failed` without throwing / masking); config
  matrix; job through `runJobGuarded` (delivered row with masked recipient + org scope; failed
  row on a non-retryable outcome without a throw; retryable throws); gate matrix (pending user:
  403 on `/api/orgs/:id`, 200 on `/api/users/me`, `/api/auth/resend-verification`, sign-out;
  verified user unaffected; API-key branch gated); invitation acceptance verified; fixtures
  updated; queue pins (scheduled vs on-demand).

Don't:
- No templates/React Email, no attachments, no bounce/complaint webhooks, no suppression list, no
  per-tenant sender domains — P6/P8 and the notification engine (P1-008) own those.
- No batch endpoint; no `cc`/`bcc`.
- Don't audit console sends in tests' direct path (nothing to audit through), and don't put
  recipient addresses or bodies into audit rows.

## Acceptance

- [x] With `RESEND_API_KEY` + `EMAIL_FROM` set, `bun run email:smoke -- --to <addr>` sends one
      message and prints the Resend id as a spec.md evidence line; without them it refuses with
      the missing keys named (config validation, exit 1); with the console provider it refuses
      unless `--allow-console` is passed (no silent console).
- [x] `NODE_ENV=production` with no provider configured fails `loadConfig()`; with
      `EMAIL_PROVIDER=console` it loads. (`config.test.ts`)
- [x] A queued email: `emailService.send` returns `queued` with the `em_` id; the job delivers it
      through the transport, writes `email.delivered` with `organization_id`, `target_user_id`,
      masked recipient, kind and provider id; a 422 from the provider writes `email.delivery_failed`
      and does not retry; a 503 throws and is retried by pg-boss with the same idempotency key.
      (`email-deliver.test.ts` through `runJobGuarded`; `loop.test.ts` end-to-end on live pg-boss.)
- [x] No queue: the same call sends directly and returns `sent`; a transport failure returns
      `failed` and the calling request still succeeds. (`email.test.ts`)
- [x] A `pending_verification` session gets 403 `EMAIL_NOT_VERIFIED` on `/api/orgs/:id` and on an
      API-key request, and 200 on `/api/users/me`, `POST /api/auth/resend-verification` and
      sign-out; after `verifyEmail` the same session passes. (`email-verification-gate.test.ts`)
- [x] A new invitee is `active` + `email_verified` with no verification token.
      (`invitation-accept.test.ts`)
- [x] Queue pins: seven scheduled queues unchanged, one on-demand queue, job set = all eight,
      `resolveSchedules()` covers exactly the scheduled seven. (`definitions.test.ts`)
- [x] Gates: `bun test` ±`DATABASE_URL`, `typecheck`, `lint` (0 errors), `build`, `coverage:check`.
- [ ] **Operator:** run the smoke test against a real key + verified domain and paste the evidence
      line into `spec.md` (the phase exit-gate clause). Not possible from the agent sandbox.

## Notes

- The console transport is what `bun run dev` uses until a key is present; the verification link
  is in the log, which is how a developer verifies a local account under the gate.
- Resend's default rate limit is 2 requests/second per account; the outbox serialises through one
  worker (`batchSize: 1`), so at MVP volume the 429 path is defensive rather than expected.

## Comments

**2026-09-22 — delivered.** Everything in the Do-list landed in one commit on
`arena/01a0c86e-nawebeus`. What differs from, or sharpens, the decisions above — and two things
the gate found that nobody had asked about:

- **Two latent bugs in the verification path, both pre-existing, both fixed here.** The gate
  made "verify a real account" load-bearing for the first time, and the first end-to-end test
  (sign up → click the emailed link → hit a gated route) failed twice in a row:
  1. **The signup link never worked.** `createEmailVerificationToken` (`user-record.ts`, the
     path `signup()` uses) stored `rawToken.slice(0, 32)` as the `selector`, while
     `consumeToken` (`tokens.ts`) looks the row up by the *whole* raw token. Every link a signup
     emailed answered "Invalid or expired verification token". Only the **resend** path, which
     goes through `createToken`, ever produced a redeemable link — and no test had redeemed one.
     Fix: store the whole token, as `createToken` does. No migration: the column is
     `varchar`, existing rows are dev/seed only, and a stale 32-char selector simply stays
     unredeemable until the user asks for a resend (which already worked).
  2. **Verifying then crashed.** `verifyEmail` (and the invitation-accept path) updated
     `users.email_verified_at`, a column `db/core/users.ts` does not define — Postgres 42703 →
     500 on every successful token match. The moment of verification is the
     `auth.email_verification.completed` audit row, which was already being written; the
     phantom column is dropped rather than added (a migration for a timestamp nothing reads
     would be schema evolution without a consumer).
  Lesson recorded in AGENTS.md: a path that no test drives end-to-end is unverified no matter
  how many unit tests touch its pieces. `signup.test.ts` F-01 now verifies through the real
  link before signing in, and `email-verification-gate.test.ts` drives the full loop.
- **Queue split as decided.** `QUEUE_JOB_NAMES` now = `SCHEDULED_QUEUE_JOB_NAMES` (seven, the
  audit chain still last among them) + `ON_DEMAND_QUEUE_JOB_NAMES` (`email.deliver`); the job
  is the eighth entry in `MAINTENANCE_JOBS`, `resolveSchedules()` covers exactly the seven.
  Policy: `retryLimit 6`, `retryDelay 60`, backoff, `expireInSeconds 60`,
  `deleteAfterSeconds 3600`. The end-to-end loop test asserts the policy on the live queue
  through `boss.getQueue()`.
- **Worker hooks** are `audit.failureAction` and `audit.scope(data)` exactly as decided; the
  registry test now checks the failure action's category/resource too. Non-retryable provider
  errors come back as a failed outcome (`email.delivery_failed`, no throw, no retry);
  retryable ones throw (`warning` with attempts left, `critical` on the last).
- **Direct-send fallback** applies both when no queue is started and when the enqueue itself
  throws (the boot race noted in `src/index.ts`: the HTTP server is listening before
  `startWorkerRuntime` has created the queues). Its outcomes are logged, not audited — the
  residual from decision 4, unchanged.
- **Gate exemptions** are path-prefix predicates (`/api/auth/`, `/api/users/me`) evaluated in
  `authMiddleware` after the status re-read, so verifying opens the gate for a session that
  already exists. `AccountSuspendedError` still wins over `EmailNotVerifiedError` when both
  apply.
- **Smoke script** (`src/scripts/email-smoke.ts`, `bun run email:smoke -- --to <addr> [--kind
  <kind>] [--allow-console]`) sends through `emailService.deliver` (transport only, no queue,
  no audit) and prints `evidence line for spec.md: <date> · <provider> · <id> · <masked
  recipient>`. Exercised locally on all four exit paths (console refused / console allowed /
  bad flag / `EMAIL_PROVIDER=resend` without a key). `parseSmokeArgs` is unit-tested; the
  script body is the only new file under 50% line coverage (46%) — it needs a network.
- **Docs:** roadmap rows for P1-003/P1-004 ticked, NWB-P0-015's decision note carries the
  "checkbox flipped" entry, AGENTS.md. **`Tech Stack.md` is deliberately untouched.** The
  ticket's Do-list had it corrected to Resend (execution-plan D4 calls §5.8 the doc defect), and
  a first commit did that — then the operator moved the file to **v1.1** on `main` the same
  afternoon (`ea338b0`/`a87fd2f`, the TanStack Start guide with the stack merged in) and asked
  that it not be edited from here. The edit was dropped from this branch so the PR merges
  clean. Open for the operator: v1.1's Appendix B still cross-references "Email (Nodemailer)
  §5.8", while the code, DEC-028 and the roadmap say Resend; D4 stays formally open until that
  row is changed by whoever owns the document.
- **Tests:** `email.test.ts` 33 (incl. the transport against a real `Bun.serve` socket),
  `queue/email-deliver.test.ts` 9, `auth/email-verification-gate.test.ts` 7, plus extensions to
  `config.test.ts` (12), `queue/worker.test.ts` (25), `queue/loop.test.ts` (10, outbox
  end-to-end), `queue/definitions.test.ts` (20), `audit/registry.test.ts`, and the fixture
  updates. Suite: **664/664** with `DATABASE_URL`; **353 pass / 332 skip** without (`.env`
  moved aside).
- **Gates:** `typecheck` clean, `bun run lint` 0 errors (557 warnings — 9 new, all the
  test-file `!` assertions the existing tests also use), `build` clean, `coverage:check`
  **94.5% services / 97.0% lib** (`resend.ts` 100%, `service.ts` 99%, `email-deliver.ts` 100%,
  `middleware/auth.ts` 100%, `user-record.ts` 100%).
- **Residuals:** the operator smoke run (above); templates/attachments/webhooks/suppression
  (P1-008, P6/P8); audit for the direct-send fallback (needs a place to write from outside a
  worker — revisit if `QUEUE_ENABLED=false` is ever a production mode); the 2 req/s Resend
  limit is defended (429 → retry with `retry-after`) but not measured.
