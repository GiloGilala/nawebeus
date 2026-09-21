/**
 * The audit hash chain, against a real PostgreSQL (NWB-P1-014).
 *
 * What this proves, and where the proof lives:
 *
 * - the writer seals every `admin`/`system`/`compliance` row and leaves lightweight modules
 *   alone — and the three CHECK constraints are exercised by tests, not avoided by them;
 * - N concurrent writers to one module cannot fork the chain — on N *real connections*, because
 *   advisory locks are session-reentrant and N promises on one `withTestDb` handle would fork
 *   with the lock engaged or not. The fork test runs against a `TEMPLATE`-cloned database it
 *   drops afterwards: no suite pollution, no cleanup that a trigger could refuse;
 * - the append-only trigger rejects UPDATE/DELETE and permits only the verifier's flag flip —
 *   created by executing `drizzle/migrations/0001_*.sql` itself, so the tested DDL and the
 *   shipped DDL cannot drift (CI builds via `db:push`, which never runs migration SQL);
 * - verification catches both a direct tamper and a privileged-bypass rebuild (content rewritten
 *   *and* checksum recomputed through the real formula — the break surfaces at the successor);
 * - the nightly job audits its run as module `system`: `info` when clean, `warning` with the
 *   breakage count when not.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type SQL, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { auditChainVerifyJob } from "../../jobs/audit-chain-verify";
import type { Db } from "../../lib/db";
import { runJobGuarded } from "../../lib/worker";
import {
  computeChecksum,
  genesisPreviousChecksum,
  verifyAuditChains,
  writeAuditLog,
} from "../../services/audit";
import { withTestDb } from "../helpers/test-db";

const hasDb = () => !!process.env.DATABASE_URL;

/** A registered action for system-module test rows. */
const SYSTEM_ACTION = "audit-chain.verified";
const TAMPERED_ACTION = "tampered.action";
// A const, not a literal: the registry scan fails any `module: "system"` outside a sealed write
// site, and read-result assertions must not wear the write shape.
const SYSTEM_MODULE = "system";

async function selectOne<T>(db: Db, query: SQL): Promise<T | undefined> {
  const result = await db.execute(query);
  return (result as unknown as { rows?: T[] }).rows?.[0];
}

async function selectMany<T>(db: Db, query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return (result as unknown as { rows?: T[] }).rows ?? [];
}

interface SealedRow {
  id: string;
  checksum: string | null;
  previous_checksum: string | null;
  hash_chain_valid: boolean | null;
}

async function writeSystemRow(
  db: Db,
  overrides: { actorId?: string; resourceId?: string } = {},
): Promise<void> {
  await writeAuditLog({
    db,
    module: "system",
    action: SYSTEM_ACTION,
    category: "security",
    resourceType: "audit_log",
    ...(overrides.actorId
      ? { actorId: overrides.actorId, actorType: "user" as const }
      : { actorType: "system" as const }),
    ...(overrides.resourceId ? { resourceId: overrides.resourceId } : {}),
  });
}

/**
 * Ensure the append-only trigger exists by executing the migration that ships it.
 * Migration SQL, not a copy: if the file stops running, this fails — which is the point.
 * Runs inside the caller's transaction, so it rolls back with the test.
 */
async function ensureAppendOnlyTrigger(db: Db): Promise<void> {
  const migration = readFileSync(
    join(
      import.meta.dir,
      "..",
      "..",
      "..",
      "drizzle",
      "migrations",
      "0001_audit_append_only_trigger.sql",
    ),
    "utf8",
  );
  const statements = migration
    .split(/^-->.*$/m)
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((chunk) => chunk.length > 0);
  expect(statements.length).toBeGreaterThan(0);
  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
}

const CLONE_DB = "nawebeus_test_chain_tmp";

/**
 * Run `fn` against a scratch database cloned from the test database, then drop it.
 *
 * `CREATE DATABASE … TEMPLATE` copies schema, constraints, seed data and all — no DDL to drift —
 * and the deterministic name with drop-before/drop-after makes it self-cleaning: a crashed run's
 * leftover is removed by the next run's prologue. The template copy refuses while anyone is
 * connected to the source, so it retries briefly (test files run sequentially; a straggler
 * connection costs milliseconds, not the test).
 */
async function withCloneDb(fn: (cloneUrl: string) => Promise<void>): Promise<void> {
  const base = process.env.DATABASE_URL ?? "";
  const template = new URL(base).pathname.slice(1);
  const adminUrl = base.replace(/\/[^/]+$/, "/postgres");
  const cloneUrl = base.replace(/\/[^/]+$/, `/${CLONE_DB}`);

  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${CLONE_DB} WITH (FORCE)`);
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await admin.query(`CREATE DATABASE ${CLONE_DB} TEMPLATE ${template}`);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    if (lastError) throw lastError;
  } finally {
    await admin.end();
  }

  try {
    await fn(cloneUrl);
  } finally {
    const cleanup = new pg.Client({ connectionString: adminUrl });
    await cleanup.connect();
    try {
      await cleanup.query(`DROP DATABASE IF EXISTS ${CLONE_DB} WITH (FORCE)`);
    } finally {
      await cleanup.end();
    }
  }
}

describe.skipIf(!hasDb())("audit hash chain", () => {
  test("the writer seals chained-module rows and leaves lightweight modules alone", async () => {
    await withTestDb(async ({ db }) => {
      await writeSystemRow(db, { actorId: crypto.randomUUID(), resourceId: crypto.randomUUID() });
      await writeSystemRow(db);
      await writeAuditLog({
        db,
        module: "core",
        action: "auth.signin.completed",
        actorId: crypto.randomUUID(),
        actorType: "user",
      });

      const rows = await selectMany<SealedRow & { module: string; action: string }>(
        db,
        sql`SELECT id, module, action, checksum, previous_checksum, hash_chain_valid
             FROM unified_audit_log ORDER BY created_at ASC, id ASC`,
      );
      expect(rows).toHaveLength(3);

      const [first, second, core] = rows;
      // First link of the module points at the computed genesis value, and the stored checksum
      // recomputes from the stored columns through the public formula.
      expect(first?.module).toBe("system");
      expect(first?.previous_checksum).toBe(genesisPreviousChecksum("system"));
      expect(first?.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(first?.hash_chain_valid).toBe(true);

      // Second link names the first row's checksum.
      expect(second?.previous_checksum).toBe(first?.checksum);
      expect(second?.checksum).toMatch(/^[0-9a-f]{64}$/);

      // Recompute both links independently of the writer: id, action, actor, resource, instant.
      for (const row of [first, second]) {
        const stored = await selectOne<{
          id: string;
          action: string;
          actor_id: string | null;
          resource_id: string | null;
          created_ms: string;
          checksum: string;
          previous_checksum: string;
        }>(
          db,
          sql`SELECT id, action, actor_id, resource_id,
                     (extract(epoch FROM created_at) * 1000)::bigint AS created_ms,
                     checksum, previous_checksum
               FROM unified_audit_log WHERE id = ${row?.id}`,
        );
        expect(stored).toBeDefined();
        expect(stored?.checksum).toBe(
          computeChecksum({
            id: stored?.id ?? "",
            action: stored?.action ?? "",
            actorId: stored?.actor_id ?? null,
            resourceId: stored?.resource_id ?? null,
            createdAtMs: Number(stored?.created_ms ?? "0"),
            previousChecksum: stored?.previous_checksum ?? "",
          }),
        );
      }

      // The lightweight row carries no chain — by design, not by omission.
      expect(core?.module).toBe("core");
      expect(core?.checksum).toBeNull();
      expect(core?.previous_checksum).toBeNull();
    });
  });

  test("verification walks only chained modules and reports a clean chain", async () => {
    await withTestDb(async ({ db }) => {
      await writeSystemRow(db);
      await writeSystemRow(db);
      await writeAuditLog({
        db,
        module: "core",
        action: "auth.signin.completed",
        actorId: crypto.randomUUID(),
        actorType: "user",
      });

      const result = await verifyAuditChains(db);
      // The core row is invisible to the walk: NULL checksums outside the chained set are the
      // design, and a verifier that flagged them would mark the table invalid on its first night.
      expect(result).toEqual({ rowsChecked: 2, broken: [], newlyFlagged: 0 });

      // Idempotent on a clean chain: same walk, same nothing.
      expect(await verifyAuditChains(db)).toEqual({ rowsChecked: 2, broken: [], newlyFlagged: 0 });
    });
  });

  test("the three checksum CHECK constraints are exercised, not avoided", async () => {
    await withTestDb(async ({ db }) => {
      // The writer complies with these constraints; it must never bypass them. Each attempt runs
      // behind a savepoint so the 23514 leaves the transaction usable (the 25P02 class).
      for (const module of ["admin", "system", "compliance"]) {
        await db.execute(sql.raw(`SAVEPOINT chk_${module}`));
        let refused: unknown = null;
        try {
          await db.execute(
            sql`INSERT INTO unified_audit_log (id, module, action)
                 VALUES (${`al_raw_${module}`}, ${module}, 'auth.signin.completed')`,
          );
        } catch (error) {
          refused = error;
        } finally {
          await db.execute(sql.raw(`ROLLBACK TO SAVEPOINT chk_${module}`));
        }
        // The code travels on the error object, not in its text.
        expect((refused as { code?: string }).code).toBe("23514");
        expect(String(refused)).toMatch(new RegExp(`chk_ual_${module}_requires_checksum`));
      }
    });
  });

  test("concurrent writers to one module cannot fork the chain", async () => {
    await withCloneDb(async (cloneUrl) => {
      const WRITERS = 8;
      const clients = await Promise.all(
        Array.from({ length: WRITERS }, async () => {
          const client = new pg.Client({ connectionString: cloneUrl });
          await client.connect();
          await client.query("BEGIN");
          return client;
        }),
      );
      try {
        const before = await selectOne<{ n: string }>(
          drizzle(clients[0] as never) as unknown as Db,
          sql`SELECT count(*)::text AS n FROM unified_audit_log
               WHERE module IN ('admin', 'system', 'compliance')`,
        );
        const expected = Number(before?.n ?? 0) + WRITERS;

        // One writer per connection, all in flight at once. Without the advisory lock these all
        // read the same predecessor and the chain forks; with it they serialize per module.
        // Each writer commits its own transaction inside its task: the lock releases at COMMIT,
        // so committing in a loop *after* the join would deadlock the join itself.
        await Promise.all(
          clients.map(async (client, i) => {
            try {
              await writeAuditLog({
                db: drizzle(client as never) as unknown as Db,
                module: "system",
                action: SYSTEM_ACTION,
                category: "security",
                resourceType: "audit_log",
                actorType: "system",
                metadata: { writer: i },
              });
              await client.query("COMMIT");
            } catch (error) {
              await client.query("ROLLBACK").catch(() => {});
              throw error;
            }
          }),
        );

        const verifier = new pg.Client({ connectionString: cloneUrl });
        await verifier.connect();
        try {
          const result = await verifyAuditChains(drizzle(verifier as never) as unknown as Db);
          expect(result.rowsChecked).toBe(expected);
          expect(result.broken).toEqual([]);
          expect(result.newlyFlagged).toBe(0);
        } finally {
          await verifier.end();
        }
      } finally {
        for (const client of clients) {
          await client.query("ROLLBACK").catch(() => {});
          await client.end();
        }
      }
    });
  }, 60_000);

  test("the trigger rejects UPDATE and DELETE, and permits only the verifier's flag flip", async () => {
    await withTestDb(async ({ db }) => {
      await ensureAppendOnlyTrigger(db);
      await writeSystemRow(db);
      const row = await selectOne<{ id: string }>(
        db,
        sql`SELECT id FROM unified_audit_log WHERE module = 'system' LIMIT 1`,
      );
      const id = row?.id ?? "";

      // try/catch, not `rejects`: `db.execute` returns drizzle's lazy thenable, which bun's
      // `rejects` does not unwrap. Each refusal runs behind a savepoint (the 25P02 class).
      const expectRefused = async (label: string, query: SQL): Promise<void> => {
        await db.execute(sql.raw(`SAVEPOINT trg_${label}`));
        let refused: unknown = null;
        try {
          await db.execute(query);
        } catch (error) {
          refused = error;
        } finally {
          await db.execute(sql.raw(`ROLLBACK TO SAVEPOINT trg_${label}`));
        }
        expect(String(refused)).toMatch(/append-only/);
      };

      await expectRefused("delete", sql`DELETE FROM unified_audit_log WHERE id = ${id}`);
      await expectRefused(
        "update",
        sql`UPDATE unified_audit_log SET action = ${TAMPERED_ACTION} WHERE id = ${id}`,
      );
      // An unhashed column is still a column.
      await expectRefused(
        "meta",
        sql`UPDATE unified_audit_log SET metadata = '{"x":1}' WHERE id = ${id}`,
      );
      // The flag flip smuggled alongside another change is still a change.
      await expectRefused(
        "both",
        sql`UPDATE unified_audit_log SET hash_chain_valid = false, action = ${TAMPERED_ACTION} WHERE id = ${id}`,
      );

      // The sole sanctioned mutation passes.
      await db.execute(sql`UPDATE unified_audit_log SET hash_chain_valid = false WHERE id = ${id}`);
      const flipped = await selectOne<{ hash_chain_valid: boolean }>(
        db,
        sql`SELECT hash_chain_valid FROM unified_audit_log WHERE id = ${id}`,
      );
      expect(flipped?.hash_chain_valid).toBe(false);
    });
  });

  test("verification catches a direct tamper from the tampered row onward, idempotently", async () => {
    await withTestDb(async ({ db }) => {
      await writeSystemRow(db);
      await writeSystemRow(db);
      await writeSystemRow(db);
      const rows = await selectMany<{ id: string }>(
        db,
        sql`SELECT id FROM unified_audit_log WHERE module = 'system' ORDER BY created_at ASC, id ASC`,
      );
      const ids = rows.map((r) => r.id);
      expect(ids).toHaveLength(3);
      // `?? ""` keeps the type honest: a missing row fails the value assertion below, not the
      // compile.
      const tamperedId = ids[1] ?? "";
      const successorId = ids[2] ?? "";

      // Privileged bypass: the trigger goes away (in-transaction), the middle row's content
      // changes without recomputing, the trigger comes back — then the verifier must flag the
      // tampered row AND its successor, whose ancestry no longer verifies.
      await db.execute(sql`DROP TRIGGER IF EXISTS impl_trg_ual_append_only ON unified_audit_log`);
      await db.execute(
        sql`UPDATE unified_audit_log SET action = ${TAMPERED_ACTION} WHERE id = ${tamperedId}`,
      );
      await ensureAppendOnlyTrigger(db);

      const first = await verifyAuditChains(db);
      expect(first.rowsChecked).toBe(3);
      expect(first.broken).toEqual([
        { module: SYSTEM_MODULE, rowId: tamperedId },
        { module: SYSTEM_MODULE, rowId: successorId },
      ]);
      expect(first.newlyFlagged).toBe(2);

      // Idempotent: the re-run finds the same breakage, re-sets the same flags, never accumulates.
      const second = await verifyAuditChains(db);
      expect(second.broken).toEqual(first.broken);
      expect(second.newlyFlagged).toBe(0);
    });
  });

  test("verification catches a bypass-rebuilt chain at the successor link", async () => {
    await withTestDb(async ({ db }) => {
      await writeSystemRow(db);
      await writeSystemRow(db);
      await writeSystemRow(db);
      const rows = await selectMany<{
        id: string;
        action: string;
        actor_id: string | null;
        resource_id: string | null;
        created_ms: string;
        previous_checksum: string;
      }>(
        db,
        sql`SELECT id, action, actor_id, resource_id,
                   (extract(epoch FROM created_at) * 1000)::bigint AS created_ms,
                   previous_checksum
             FROM unified_audit_log WHERE module = 'system' ORDER BY created_at ASC, id ASC`,
      );
      const middle = rows[1];
      expect(middle).toBeDefined();

      // The harder tamper: rewrite the content AND recompute that row's checksum through the real
      // formula, so the tampered link is self-consistent. The successor still names the old
      // checksum — that is the break, and the only place it can surface.
      const rebuilt = computeChecksum({
        id: middle?.id ?? "",
        action: TAMPERED_ACTION,
        actorId: middle?.actor_id ?? null,
        resourceId: middle?.resource_id ?? null,
        createdAtMs: Number(middle?.created_ms ?? "0"),
        previousChecksum: middle?.previous_checksum ?? "",
      });
      await db.execute(sql`DROP TRIGGER IF EXISTS impl_trg_ual_append_only ON unified_audit_log`);
      await db.execute(
        sql`UPDATE unified_audit_log SET action = ${TAMPERED_ACTION}, checksum = ${rebuilt} WHERE id = ${middle?.id}`,
      );
      await ensureAppendOnlyTrigger(db);

      const result = await verifyAuditChains(db);
      expect(result.rowsChecked).toBe(3);
      expect(result.broken).toEqual([{ module: SYSTEM_MODULE, rowId: rows[2]?.id ?? "" }]);
      expect(result.newlyFlagged).toBe(1);
    });
  });

  test("a clean verification run audits as module system, info", async () => {
    await withTestDb(async ({ db }) => {
      await writeSystemRow(db);

      const jobId = `chain-clean-${crypto.randomUUID().slice(0, 8)}`;
      const outcome = await runJobGuarded(
        auditChainVerifyJob,
        { db, audit: (params) => writeAuditLog(params) },
        { id: jobId, attempt: 1 },
        null,
      );
      expect(outcome).toEqual({ rowsChecked: 1, failed: 0, errors: [], truncated: false });

      const row = await selectOne<{
        module: string;
        action: string;
        severity: string;
        actor_type: string | null;
        after_state: { rowsChecked?: number; failed?: number } | null;
      }>(
        db,
        sql`SELECT module, action, severity, actor_type, after_state FROM unified_audit_log
             WHERE metadata->>'jobId' = ${jobId} LIMIT 1`,
      );
      expect(row).toMatchObject({
        module: SYSTEM_MODULE,
        action: "audit-chain.verified",
        severity: "info",
        actor_type: "system",
      });
      expect(row?.after_state).toMatchObject({ rowsChecked: 1, failed: 0 });
    });
  });

  test("a run that finds breakage audits as warning, with the breakage count", async () => {
    await withTestDb(async ({ db }) => {
      await writeSystemRow(db);
      await writeSystemRow(db);
      const victim = await selectOne<{ id: string }>(
        db,
        sql`SELECT id FROM unified_audit_log WHERE module = 'system' ORDER BY created_at ASC, id ASC LIMIT 1`,
      );
      await db.execute(sql`DROP TRIGGER IF EXISTS impl_trg_ual_append_only ON unified_audit_log`);
      await db.execute(
        sql`UPDATE unified_audit_log SET action = ${TAMPERED_ACTION} WHERE id = ${victim?.id}`,
      );
      await ensureAppendOnlyTrigger(db);

      const jobId = `chain-broken-${crypto.randomUUID().slice(0, 8)}`;
      const outcome = await runJobGuarded(
        auditChainVerifyJob,
        { db, audit: (params) => writeAuditLog(params) },
        { id: jobId, attempt: 1 },
        null,
      );
      // Both rows flag: the tampered first link and everything after it.
      expect(outcome).toMatchObject({ rowsChecked: 2, failed: 2, truncated: false });

      const row = await selectOne<{ severity: string; after_state: unknown }>(
        db,
        sql`SELECT severity, after_state FROM unified_audit_log
             WHERE metadata->>'jobId' = ${jobId} LIMIT 1`,
      );
      expect(row?.severity).toBe("warning");
      expect(row?.after_state).toMatchObject({ failed: 2 });
    });
  });
});
