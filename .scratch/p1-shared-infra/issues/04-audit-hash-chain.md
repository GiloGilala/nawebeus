# NWB-P1-014 — Audit hash chain: checksums on write, verification on schedule

Type: task
Status: done (2026-09-21 — typecheck + `bun run lint` exit 0 + build + **544/544** `bun test` with a live database, 289 pass / 269 skip / 0 fail without one, `coverage:check` green at 91.1% services / 96.9% lib)
Blocked by: NWB-P1-001 ✅ (the queue base this job rides on), NWB-P1-002 ✅ (typed actions — the chain
hashes a stable payload; wiring it to loose strings first means re-hashing later)
Phase: P1 (roadmap Phase 2) · split out of NWB-P1-002 on 2026-09-21
Size: M

## Why this exists as its own ticket

`unified_audit_log` was designed for tamper evidence and none of it is implemented. Three
`CHECK` constraints already **demand** it:

```
chk_ual_admin_requires_checksum      module <> 'admin'      OR checksum IS NOT NULL
chk_ual_system_requires_checksum      module <> 'system'     OR checksum IS NOT NULL
chk_ual_compliance_requires_checksum  module <> 'compliance' OR checksum IS NOT NULL
```

plus `chk_ual_checksum_length` (64 hex chars), `chk_ual_previous_checksum_length`, and
`chk_ual_checksum_pairing` (checksum ⇔ previousChecksum, both or neither). The columns
(`checksum`, `previousChecksum`, `hashChainValid` default true), and `idx_ual_chain_scan`
`(module, previousChecksum)` exist. `grep -rn "hashChain" src/` finds **comments only** — no code
computes, reads, or verifies a checksum. PRD §8.10.2 states the requirement plainly: *"Log integrity
verified via cryptographic checksums"*.

**The missing chain is currently costing correctness in two places**, and both read as designs:
- `src/services/users/dsar.service.ts:75` — writes `module: "core"` where `compliance` is right,
  because a `compliance` row without a checksum violates the constraint.
- `src/lib/worker.ts:286` — same workaround for the queue runtime, `core` instead of `system`.

Two comments explaining a workaround, in two files, is how that becomes permanent. This ticket flips
both.

## What the schema already decided (read before designing)

`db/shared/audit.ts`'s header is normative on the formula and the shape:

- `checksum = SHA-256(id + action + actorId + resourceId + createdAt + previousChecksum)`
- `previousChecksum` = the preceding row's checksum **for the same module** — N per-module chains, not
  one global chain (so a writer for `core` never contends with `security`).
- The verification job scans each module's chain in `createdAt` order and sets
  `hashChainValid = FALSE` on the broken rows. That column's UPDATE is *the only* mutation the
  append-only contract permits — the header says so explicitly, which also means a whole-row UPDATE
  or any DELETE is the thing to block.
- Rows must outlive actors and resources: **no FKs** on `actorId`/`resourceId`/`targetUserId`. So the
  hash inputs are all present at insert time and never re-resolvable — a verification job cannot
  recompute from references, only from stored columns.

## Design decisions to settle (each has a real cost)

**1. The serialization point.** `checksum` covers `createdAt`, and `previousChecksum` names the
*previous row for that module*. Two concurrent inserts into the same module can therefore each pick
the same predecessor and fork the chain. Options:
- **(a) `pg_advisory_xact_lock(hashtext(module))` around "read last checksum → insert"**, per module.
  Correct and cheap at this volume; the lock is per-module so unrelated writes don't serialize against
  each other. Costs a round trip and serializes `security` writes with each other.
- **(b) Deferred sealing**: rows insert with `checksum = NULL` (legal for non-required modules) and a
  scheduled job computes the chain for a time window after the fact, then verification walks it. No
  write-path contention, but a `admin|system|compliance` insert **cannot** use (b) alone — the
  `…_requires_checksum` constraints forbid a NULL. So (b) requires relaxing those constraints, i.e. a
  migration that weakens an enforced rule. Flag that to whoever cares about NDPR evidence quality.
- **(c) Deterministic per-row hash without chaining** (`checksum = SHA-256(row fields)` only) plus a
  nightly sealed digest stored in a **new** table (append-only-safe: nothing updates the audit row).
  Detects edited and deleted rows *per day*, no insert-time lock, and `previousChecksum` then
  references the digest rather than the previous row — which contradicts the header comment, so it
  needs the comment updated in the same commit.
Recommendation: **(a)**, because the constraints, the index and the header comment were all written for
it, and inventing an alternative should be a decision made against evidence that the lock hurts.

**2. The genesis row.** `chk_ual_previous_checksum_length` + `chk_ual_checksum_pairing` mean the first
row of a module cannot have `checksum` present with `previousChecksum` NULL. The chain therefore needs
a defined start: the honest options are a fixed sentinel (`previousChecksum = SHA-256(module)`,
computed, not a magic constant in SQL) or a per-module genesis insert. Decide explicitly; do not let it
emerge from whatever the first `INSERT` happens to do.

**3. Pre-existing rows.** Every row in `unified_audit_log` today has `checksum IS NULL`. A verification
walk that treats NULL as "broken" marks the entire historical table invalid on its first night. So the
ticket must decide: backfill the historical chain (and accept that the backfill is itself a trusted
window), or scope verification to `createdAt >= <chain start>` and record that boundary in the seed or
a config key. **Backfilling is not equivalent to hashing at write** — say which one the evidence claims.

**4. Where the code lives.** The hashing belongs in `src/services/audit/` (next to the writer, so no
caller can forget it) and *not* in each service. The verification job is a `JobDefinition` in
`src/jobs/` on the NWB-P1-001 base: nightly **after** the purge jobs (its own slot, e.g. `0 3 * * *`
UTC — a verification that runs before a purge is verifying a set the purge then changes), audit on
success and failure like every other job, and it must be idempotent (a re-run finds the same breakage
and re-sets the same flag, never accumulates).

**5. Enforce the append-only contract while you are in here.** Today the no-UPDATE/no-DELETE rule is a
comment. An `impl_trg_ual_append_only` trigger that rejects UPDATE of any column **except**
`hash_chain_valid` (and rejects DELETE and TRUNCATE outright) turns the design into something a
bug cannot walk through. Migration + `db/schema.ts` change, so it also has to satisfy NWB-P0-005's
"migrations from zero" exit criterion. The trigger is what makes the `checksum` columns mean anything:
without it, a tamperer edits the row and recomputes its own hash.

## Decisions (2026-09-21, before coding)

**1. Serialization: (a), with one addition the ticket missed.** `pg_advisory_xact_lock(hashtext(module))`
around read-last → insert — but the lock, the SELECT and the INSERT must share one transaction, and
the queue runtime deliberately runs without one ("It does not commit"), where each statement is its
own transaction and an xact lock releases immediately. So chained-module writes run inside
`withAtomicWrites`: in-tx callers join their transaction (the writer still never commits a caller's
tx), autocommit callers get a writer-scoped transaction that holds the lock across read+insert.
Non-chained modules keep the single-INSERT hot path — no extra round trips where the header promises
lightweight.

**2. Genesis: computed sentinel, no fake rows.** `previousChecksum` of a module's first row is
`sha256Hex("audit-chain-genesis:" + module)`, derived by one shared function the writer and the
verifier both call. (A per-module genesis insert would be evidence of something that did not happen —
the thing the writer's "does not commit" rule exists to prevent.)

**3. Pre-existing rows: measured — there are none, so no backfill and no boundary.** A NULL-checksum
row in `admin|system|compliance` is impossible (the three constraints forbid it, the writer's
`WritableAuditModule` type forbids it), and the seed writes zero audit rows (verified live:
`SELECT module, count(*) FROM unified_audit_log` after `seed` returns no rows). The chains start
empty on every database. The verifier still treats a NULL-checksum row in a chained module as broken
(defense, not expectation).

**4. Placement and scope.** Hashing in a new `src/services/audit/chain.ts` next to the writer, called
by `writeAuditLog` — no caller can forget it. Chained set is exactly `CHECKSUM_ONLY_MODULES`: chaining
*every* module would serialize all concurrent `core` writes behind an xact lock held to transaction
end, which is precisely the contention the header's "lightweight, high-volume" carve-out exists to
avoid. Verification job `src/jobs/audit-chain-verify.ts` on the P1-001 base: queue
`integrity.audit-chain-verify`, cron `0 3 * * *` UTC (after the 02:45 accounts purge), env override
`QUEUE_CRON_AUDIT_CHAIN_VERIFY`, last in `QUEUE_JOB_NAMES`. Its audit event is module `system` via a
new per-job `audit.module` override (default `core`) — which is also what gives the `system` chain
production coverage. Action `audit-chain.verified` (two segments, hyphen — the shape
`definitions.test.ts` enforces on job actions), category `security`, outcome
`{ rowsChecked, failed, errors, truncated }` where `failed` is the *total* currently-broken rows, so
a night with known-unresolved tampering warns rather than reading clean (P1-013's convention reused;
throwing would retry a condition no retry can clear).

**5. The trigger, and the two things CI forces.** `impl_trg_ual_append_only` rejects DELETE and any
UPDATE whose sole change is not `hash_chain_valid` (compare-after-normalize: pin `NEW.valid` to
`OLD.valid`, reject if rows still differ — no 20-column enumeration, survives future columns).
TRUNCATE is deliberately out: no trigger fires on TRUNCATE, and blocking it needs an event trigger
(superuser) — it stays a role-permission concern, which is what the header comment already says.
Migration via `drizzle-kit generate --custom` (triggers are not expressible in `db/schema.ts`), SQL
written idempotently (`DROP TRIGGER IF EXISTS` + `CREATE OR REPLACE`) for the reason below.
**CI still runs `db:push`, not `db:migrate`** (verified in `.github/workflows/ci.yml`; the README
line claiming migrate-twice is aspirational), so push-built databases never see migration SQL: the
trigger tests execute `drizzle/migrations/0001_*.sql` itself in-transaction — zero drift between
tested and shipped DDL, and it proves the migration runs. `db:push` convergence from zero and
push-over-migrated leaving the trigger alone are both verified empirically in delivery.

**Formula (exact — supersedes the header's prose in the same commit).**
`sha256Hex(JSON.stringify([id, action, actorId ?? null, resourceId ?? null, String(createdAtMs),
previousChecksum]))` via `Bun.CryptoHasher`. The writer sets `created_at` explicitly from the same
`Date` (`getTime()` ms fit PostgreSQL's µs precision exactly); the verifier reads
`(extract(epoch FROM created_at)*1000)::bigint`, never the text form (the F-24 lesson). JSON encoding
makes NULL-vs-empty unambiguous. Chain order is the total order `(created_at, id)` on both sides —
same-microsecond inserts need the tiebreak.

**Concurrency test isolation.** Advisory locks are session-reentrant, so N writes on one `withTestDb`
handle cannot prove anything (the lock is a no-op within its own session — same-connection
interleaving forks with *and* without it). The fork test therefore runs N real connections against a
`CREATE DATABASE … TEMPLATE` clone and drops it afterwards (deterministic name, drop-before and
drop-after: self-cleaning, no suite pollution, works on push- and migrate-built databases alike) —
the `loop.test.ts` throwaway precedent, one level up.

**Also settled.** `WritableAuditModule`'s `Exclude` is deleted (all modules writable);
`CHECKSUM_ONLY_MODULES` stays as the must-chain set with its doc rewritten. `dsar.service.ts` →
`compliance`, workaround comment deleted. `worker.ts` stays `core` (no `queue` module in the 15-value
enum), comment rewritten per the ticket. `ADRs.md` §22 checked: no chain-implying wording, no note
needed. `hashChainValid` is not surfaced in the query API here — follow-up for P1-010 or a later
read ticket, recorded in Comments on delivery.

**As-built deviation, found by the test (delivery, 2026-09-21): monotonic per-module
`created_at`.** The formula paragraph above assumes `(created_at, id)` orders the walk
identically to the seal. It does not: same-millisecond concurrent inserts share a `created_at`,
and the random-`id` tiebreak orders them differently from seal order — the 8-writer fork test
failed with 7 broken links *with the lock held*, which is a systematic flaw, not a race. So
`sealChainLink` now stamps `createdAt = max(now, predecessor_ms + 1)` per chained module, the
INSERT stores the sealed instant (not the caller's), and the hash covers the stored instant.
Walk order is unchanged (`(created_at, id)` — ties are now impossible); side benefit: a backward
clock jump cannot reorder a chain. Red-verified both directions: lock removed → 7/8 links broken;
pre-stamp code → the same 7/8.

## Acceptance

- [x] Every insert into `unified_audit_log` for `admin|system|compliance` carries a valid
      `checksum`+`previousChecksum` pair, produced by one shared function; the three constraints are
      exercised by tests, not avoided by them. (`computeChainChecksum` shared by seal + verify;
      `chain.test.ts` asserts all three SQLSTATE 23514 rejections via real INSERTs.)
- [x] Concurrent inserts to the same module cannot fork the chain (a test that fires N parallel
      writes and then verifies the chain — if that test is hard to write, the design is wrong, not the
      test). (8 real connections × 1 module against a `TEMPLATE` clone, all commit, verify clean;
      red-verified: lock removed → 7/8 links broken.)
- [x] Verification job: walks per-module chains in `createdAt` order, sets `hashChainValid=false` from
      the first mismatch onward, writes an audit event on both outcomes, is idempotent, and runs on a
      schedule in every env except `test` (same rules as NWB-P1-001). (Queue
      `integrity.audit-chain-verify`, cron `0 3 * * *` + env override, last in `QUEUE_JOB_NAMES`,
      module-`system` audit both outcomes, idempotent re-run pinned.)
- [x] A test tampers with a row *through a path the trigger allows* (i.e. it cannot, so the test proves
      the trigger rejects UPDATE/DELETE, then proves verification catches a chain rebuilt by a
      privileged bypass). (UPDATE-of-other-column + DELETE rejected, flag-only UPDATE allowed;
      direct tamper caught from the tampered row onward + idempotent; bypass-rebuilt chain caught at
      the successor.)
- [x] `dsar.service.ts` and `src/lib/worker.ts` write their correct modules, and the two workaround
      comments are deleted with the reason they existed. `src/lib/worker.ts`'s comment claims
      `unified_audit_log` "has no `queue` module" — still true and still fine (`core`), but its
      *reason* (missing chain) goes away, so the comment must be rewritten rather than removed.
      (DSAR → `compliance`, workaround deleted; worker stays `core` with the comment rewritten; the
      registry scan allow-lists sealed write sites and pins both.)
- [x] `bun test` green with and without `DATABASE_URL`; `typecheck`, `biome`, `build`,
      `coverage:check` green; migration recorded per `drizzle/README.md` conventions and `db:push
      --force` still converges from zero. (544/544 with DB; 289/269/0 without; typecheck + build +
      coverage:check green; `bun run lint` exit 0 — the 538 warnings are all pre-existing
      (spot-blamed to `360ddb47`), zero errors, ticket files warning-free; migrate-twice from zero
      + push converges + trigger survives push.)
- [x] `AGENTS.md` Key facts updated (the `core`-for-`system` guidance becomes "use `system`, the
      chain exists"); `docs/technical/ADRs.md` §22 note if the ADR's wording implies the chain exists.
      (Chain bullet added; worker + DSAR + nightly-order bullets rewritten; coverage 91.1/96.9,
      DB-test count 269, jobs tree extended. §22 = ADR-028, re-checked 2026-09-21: no chain wording,
      no note.)

## Notes

- Do **not** weaken the three `…_requires_checksum` constraints to make inserts easier; that deletes
  the only DB-level thing this ticket is about. If design (b) is chosen, say so in the PR and in
  `drizzle/README.md` with the reason.
- `Bun.CryptoHasher("sha256")` is the repo's own recommendation for hashing (AGENTS.md dependency
  rule) — no new package.
- The 7-year retention floor and legal holds are NWB-P1-010; if a hold has to freeze chain
  *verification* too, that interaction belongs there, not here.

## Follow-up delivered 2026-09-21 (chain-state filter)

The "not surfaced in the query API" note above turned out to be half-stale: `hashChainValid` was
already on `AuditEventSummary`/`AuditEventDetail` (it predates this ticket — blame lands on the
base commit, i.e. NWB-P1-002's read work). What was genuinely missing was *filterability*: no way
to ask for flagged rows. Landed: `chainValid?: boolean` on `AuditEventFilters` (`!== undefined`-
gated — `false` is the compliance query), `?chainValid=true|false` on `GET /api/audit` (enum-plus-
transform; `z.coerce.boolean()` would read `"false"` as truthy), service + route tests with the
flag flipped the way the verifier writes it. Red-checked both layers against a truthy gate.
554/554, lint exit 0, coverage unchanged at 91.4/96.9, no migration (no schema change).
