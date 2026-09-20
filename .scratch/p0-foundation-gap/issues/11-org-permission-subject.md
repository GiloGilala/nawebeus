# NWB-P0-011 — Fix the `organization` vs `org` permission subject (F-02)

**Status:** done — 2026-09-20 (verified locally: typecheck + lint + 167/167 `bun test` incl. 2 new tests; CI re-run on PR #1)
**Deps:** D13 ✅ (role codes only — permission strings unchanged, so the task's recommended fix applied as written). **Size:** S.
**Fixes:** F-02 (High).

## What was built

| Layer | File |
| --- | --- |
| Route | `src/app/orgs/org.route.ts` — `requireAbility("update", "organization")` → `requireAbility("update", "org")` (with comment explaining why) |
| Tests | `src/tests/orgs/org.test.ts` — new `Org routes — integration (F-02)` describe: positive (org_admin PATCH → 200, name updated) + negative (viewer PATCH → 403 FORBIDDEN), per the Negative Test Rule (QA §2.2) |

## Design decisions

1. **Changed the route, not the seed.** The roadmap task's recommendation, applied as written:
   keep the `org.*` permission strings (they are the codebase convention — every other
   subject in the app is the compact prefix: `users`, `members`, `apikeys`, `posts`, …)
   and correct the one outlier route. 2-line change, no data migration, no seed
   re-run semantics change. A systematic sweep of all `requireAbility` call sites
   (14 across `src/app`) confirmed this was the **only** subject mismatch in the app.
2. **No doc correction needed** — no project doc specifies either spelling
   (grep-verified: `docs/modules/` defines neither `org.*` nor `organization.*`
   permission strings); only the roadmap defect register references the pair.
3. **Test fixture** matches the single-org JWT model: two users sign up (each owns
   its own org), the second is re-homed into the first's org
   (`users.organization_id` UPDATE + `organization_members` INSERT with the role
   under test), then signs in so both `requireOrgMatch` (JWT orgId from
   `users.organization_id`) and the ability check see the same org. The fixture is
   rolled back by the test harness (outer-transaction pattern).
4. **Positive role is `org_admin`** per the task's acceptance wording. It carries
   `org.update` today; when NWB-P0-014 drops `org_admin` per DEC-039, this test
   should switch to the `owner` role (which also carries it).

## Verification (2026-09-20, local: bun 1.4.2, PG 18.4 via npm `embedded-postgres`)

- `bun run typecheck` — clean
- `bun run lint` (touched files) — no errors; 6 `as any`-style warnings matching the
  file's existing convention
- `bun test` — **167 pass / 0 fail** (was 165 before; +2 new)
- Pre-fix behavior for the record: the same positive test 403s (the subject matched
  no CASL rule — verified in the F-02 static analysis, §5 note on CASL v7)

## Rollback

One-line revert in `org.route.ts`.

## Environment note (applies to all Phase 1 tickets)

The sandbox resets system state between turns (bun global install, /tmp, node_modules
and gitignored files like `.env` do not persist). Rebuild sequence that works:

1. `npm i -g bun` (bun.sh is blocked; the npm registry is not) — installs bun 1.4.2
2. `mkdir /tmp/pgtest && cd /tmp/pgtest && npm init -y && npm i embedded-postgres`
   (Debian apt mirrors are blocked; this provides initdb/postgres/pg_ctl)
3. `initdb -D /tmp/pgdata -U postgres --auth=trust --encoding=UTF8`
   + `pg_ctl -D /tmp/pgdata -o "-p 5432 -k /tmp/pgrun -c listen_addresses=127.0.0.1" start`
4. `CREATE DATABASE nawebeus` via node-pg; write `.env` (DATABASE_URL, 32+ char JWT
   secrets, DB_HOST/DB_NAME/DB_USER/DB_PASSWORD=postgres for drizzle-kit)
5. `bun install && bun run db:push -- --force && bun run seed` (from-zero build,
   same as CI; do NOT `db:push` an evolved DB — see NWB-P0-005)

6. **Git state can be rewound between turns** (observed 2026-09-20: the local
   branch was reset to the baseline commit while the remote kept the work; the
   working tree kept the file contents). The **remote is the source of truth** —
   before committing, `git fetch origin` and confirm local HEAD == remote tip
   (`git log --oneline FETCH_HEAD -1`); if local diverged, back up the uncommitted
   files to /tmp, `git reset --hard FETCH_HEAD`, restore the files, re-commit, and
   push (fast-forward). Push at the end of every work session, never later.
