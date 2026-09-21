# NWB-P1-014 — Audit hash chain: checksums on write, verification on schedule

Type: task
Status: ready-for-agent
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

## Acceptance

- [ ] Every insert into `unified_audit_log` for `admin|system|compliance` carries a valid
      `checksum`+`previousChecksum` pair, produced by one shared function; the three constraints are
      exercised by tests, not avoided by them.
- [ ] Concurrent inserts to the same module cannot fork the chain (a test that fires N parallel
      writes and then verifies the chain — if that test is hard to write, the design is wrong, not the
      test).
- [ ] Verification job: walks per-module chains in `createdAt` order, sets `hashChainValid=false` from
      the first mismatch onward, writes an audit event on both outcomes, is idempotent, and runs on a
      schedule in every env except `test` (same rules as NWB-P1-001).
- [ ] A test tampers with a row *through a path the trigger allows* (i.e. it cannot, so the test proves
      the trigger rejects UPDATE/DELETE, then proves verification catches a chain rebuilt by a
      privileged bypass).
- [ ] `dsar.service.ts` and `src/lib/worker.ts` write their correct modules, and the two workaround
      comments are deleted with the reason they existed. `src/lib/worker.ts`'s comment claims
      `unified_audit_log` "has no `queue` module" — still true and still fine (`core`), but its
      *reason* (missing chain) goes away, so the comment must be rewritten rather than removed.
- [ ] `bun test` green with and without `DATABASE_URL`; `typecheck`, `biome`, `build`,
      `coverage:check` green; migration recorded per `drizzle/README.md` conventions and `db:push
      --force` still converges from zero.
- [ ] `AGENTS.md` Key facts updated (the `core`-for-`system` guidance becomes "use `system`, the
      chain exists"); `docs/technical/ADRs.md` §22 note if the ADR's wording implies the chain exists.

## Notes

- Do **not** weaken the three `…_requires_checksum` constraints to make inserts easier; that deletes
  the only DB-level thing this ticket is about. If design (b) is chosen, say so in the PR and in
  `drizzle/README.md` with the reason.
- `Bun.CryptoHasher("sha256")` is the repo's own recommendation for hashing (AGENTS.md dependency
  rule) — no new package.
- The 7-year retention floor and legal holds are NWB-P1-010; if a hold has to freeze chain
  *verification* too, that interaction belongs there, not here.
