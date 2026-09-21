/**
 * The audit hash chain — tamper evidence for `unified_audit_log` (NWB-P1-014).
 *
 * Three CHECK constraints (`chk_ual_{admin,system,compliance}_requires_checksum`) demand that rows
 * in those modules carry a `checksum`/`previousChecksum` pair, and until this file existed nothing
 * computed one — which is why `dsar.service.ts` and `src/lib/worker.ts` wrote `core` where
 * `compliance` and `system` belonged. This module seals those rows on write and verifies the chains
 * on schedule.
 *
 * The contract, in one place so the writer, the verifier, and the tests cannot disagree:
 *
 * - **Chained set.** Exactly `CHECKSUM_ONLY_MODULES`. Every other module keeps NULL checksums —
 *   the "lightweight, high-volume" carve-out in `db/shared/audit.ts`'s header, which is load-aware:
 *   the seal below holds a lock to transaction end, and chaining `core` would serialize all
 *   concurrent auth/user/org writes behind it.
 * - **Formula.** `sha256Hex(JSON.stringify([id, action, actorId ?? null, resourceId ?? null,
 *   String(createdAtMs), previousChecksum]))`. JSON encoding makes NULL-vs-empty unambiguous; the
 *   instant travels as epoch milliseconds because that is the one representation both sides can
 *   derive exactly (the writer from its `Date`, the verifier from
 *   `(extract(epoch FROM created_at)*1000)::bigint` — never the text form, per the F-24 lesson).
 * - **Chain order.** The total order `(created_at, id)`, on both sides — and `created_at` is
 *   stamped monotonically per module: a seal reads its predecessor's instant and never stamps at
 *   or before it (`max(now, predecessor + 1ms)`). Millisecond ties are certain under concurrency,
 *   and a random-`id` tiebreak would order the walk differently from the seal order, breaking
 *   every link after the first. The drift from wall-clock time is milliseconds at chained-module
 *   volumes; ordering exactness is worth more than timestamp exactness here. As a side effect the
 *   chain is immune to backward clock jumps: monotonicity comes from the predecessor, not the clock.
 * - **Genesis.** A module's first row links to `sha256Hex("audit-chain-genesis:" + module)` —
 *   computed, not a stored sentinel row, derived by one function both sides call.
 * - **Concurrency.** The seal takes `pg_advisory_xact_lock(hashtext(module))` before reading the
 *   predecessor, so two writers to one module serialize instead of forking. Advisory locks are
 *   session-reentrant, so this engages only across connections — which is why the fork test runs N
 *   real connections, not N promises on one handle. The lock, the read, and the INSERT must share
 *   one transaction: the writer runs them inside `withAtomicWrites`, because an xact lock taken
 *   outside a transaction releases before the INSERT it protects.
 */
import { sql } from "drizzle-orm";
import type { Db } from "../../lib/db";
import { type DbOrTx, withAtomicWrites } from "../../lib/transaction";
import { type AuditModule, CHECKSUM_ONLY_MODULES } from "./types";

/** The modules whose rows always carry a checksum pair. */
export type ChainedAuditModule = (typeof CHECKSUM_ONLY_MODULES)[number];

/** True for the three modules the CHECK constraints chain. */
export function isChainedModule(module: AuditModule): module is ChainedAuditModule {
  return (CHECKSUM_ONLY_MODULES as readonly string[]).includes(module);
}

function sha256Hex(input: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(input);
  return hasher.digest("hex");
}

/**
 * The `previousChecksum` a module's first row links to. Computed from the module name so the
 * writer and the verifier derive the same value without a stored sentinel row — a stored genesis
 * row would be evidence of something that did not happen.
 */
export function genesisPreviousChecksum(module: ChainedAuditModule): string {
  return sha256Hex(`audit-chain-genesis:${module}`);
}

/** The six hash inputs, exactly as the formula orders them. */
export interface ChainLinkInput {
  readonly id: string;
  readonly action: string;
  readonly actorId: string | null;
  readonly resourceId: string | null;
  readonly createdAtMs: number;
  readonly previousChecksum: string;
}

/** The checksum for one link. Pure — the tamper tests rebuild chains through this. */
export function computeChecksum(link: ChainLinkInput): string {
  return sha256Hex(
    JSON.stringify([
      link.id,
      link.action,
      link.actorId,
      link.resourceId,
      String(link.createdAtMs),
      link.previousChecksum,
    ]),
  );
}

/** What the seal hands the INSERT: the pair, plus the instant both were derived from. */
export interface SealedChainLink {
  readonly checksum: string;
  readonly previousChecksum: string;
  readonly createdAt: Date;
}

/**
 * Seal one chained-module row: lock the module's chain, read the predecessor, stamp a monotonic
 * instant, compute the pair.
 *
 * MUST run inside the caller's transaction (`withAtomicWrites`): `pg_advisory_xact_lock` releases
 * at transaction end, so on an autocommit handle the lock must be taken inside a writer-scoped
 * transaction that also covers the read and the INSERT — otherwise the lock releases before the
 * statements it protects.
 *
 * The returned `createdAt` is what the INSERT must store — not the caller's instant. It is
 * `max(now, predecessor + 1ms)`, which is what makes `(created_at, id)` order the walk exactly as
 * the seals landed (see the contract above). The hash input and the stored instant derive from
 * this one `Date`, never formatted twice.
 */
export async function sealChainLink(
  tx: DbOrTx,
  module: ChainedAuditModule,
  link: {
    readonly id: string;
    readonly action: string;
    readonly actorId: string | null;
    readonly resourceId: string | null;
    readonly createdAt: Date;
  },
): Promise<SealedChainLink> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${module}))`);
  const rows = await tx.execute<{ checksum: string | null; created_ms: string }>(
    sql`SELECT checksum, (extract(epoch FROM created_at) * 1000)::bigint AS created_ms
         FROM unified_audit_log
         WHERE module = ${module} AND checksum IS NOT NULL
         ORDER BY created_at DESC, id DESC LIMIT 1`,
  );
  // NULL checksums cannot exist in a chained module (the constraint forbids them); the
  // `IS NOT NULL` guard means a hypothetical one would be flagged by the verifier as an anomaly
  // rather than fork the chain past it.
  const predecessor = (
    rows as unknown as { rows?: Array<{ checksum: string | null; created_ms: string }> }
  ).rows?.[0];
  const previousChecksum = predecessor?.checksum ?? genesisPreviousChecksum(module);
  const createdAtMs =
    predecessor === undefined
      ? link.createdAt.getTime()
      : Math.max(link.createdAt.getTime(), Number(predecessor.created_ms) + 1);
  const createdAt = new Date(createdAtMs);
  const checksum = computeChecksum({
    id: link.id,
    action: link.action,
    actorId: link.actorId,
    resourceId: link.resourceId,
    createdAtMs,
    previousChecksum,
  });
  return { checksum, previousChecksum, createdAt };
}

/** One row the verifier found broken: which module's chain, and which link. */
export interface BrokenChainLink {
  readonly module: ChainedAuditModule;
  readonly rowId: string;
}

/**
 * What a verification run reports. `broken` is EVERY broken row after this run, not just the newly
 * flagged: a night with known-unresolved tampering must warn rather than read clean, and a stable
 * list is what makes re-runs idempotent (same breakage, same flags, never accumulating).
 */
export interface ChainVerificationResult {
  /** Chained-module rows walked this run. Lightweight modules are not counted — their NULL
   * checksums are by design, not breakage. */
  readonly rowsChecked: number;
  readonly broken: readonly BrokenChainLink[];
  /** Of `broken`, how many this run newly flagged (were still `true`). */
  readonly newlyFlagged: number;
}

type ChainRow = {
  // A `type`, not an `interface`: drizzle's `execute<T>` constrains `T` to `Record<string,
  // unknown>`, which only object-literal types satisfy implicitly.
  id: string;
  action: string;
  actor_id: string | null;
  resource_id: string | null;
  /** `(extract(epoch FROM created_at)*1000)::bigint` — node-postgres hands int8 back as text. */
  created_ms: string;
  checksum: string | null;
  previous_checksum: string | null;
  hash_chain_valid: boolean | null;
};

/**
 * Walk every chained module's chain in `(created_at, id)` order, recompute each link, and set
 * `hash_chain_valid = false` from the first mismatch onward — the one UPDATE the append-only
 * trigger permits, and the only mutation the table's contract allows. Once a link breaks, every
 * later link's ancestry is unverified, so all of them flag; re-running flags nothing new.
 *
 * A row is intact when its `previous_checksum` names the predecessor's checksum (or the genesis
 * value for the first row) AND its stored checksum recomputes. Both halves matter: a privileged
 * tamperer who rewrites a row and recomputes its checksum keeps that link self-consistent, and the
 * break surfaces at the successor whose `previous_checksum` still names the old value.
 */
export async function verifyAuditChains(db: Db): Promise<ChainVerificationResult> {
  return withAtomicWrites(db, async (tx) => {
    let rowsChecked = 0;
    let newlyFlagged = 0;
    const broken: BrokenChainLink[] = [];

    for (const module of CHECKSUM_ONLY_MODULES) {
      const result = await tx.execute<ChainRow>(
        sql`SELECT id, action, actor_id, resource_id,
                   (extract(epoch FROM created_at) * 1000)::bigint AS created_ms,
                   checksum, previous_checksum, hash_chain_valid
             FROM unified_audit_log WHERE module = ${module}
             ORDER BY created_at ASC, id ASC`,
      );
      const rows = (result as unknown as { rows?: ChainRow[] }).rows ?? [];
      let predecessor: string | null = null;
      let brokenFromHere = false;
      const toFlag: string[] = [];

      for (const row of rows) {
        rowsChecked++;
        const expectedPrevious = predecessor ?? genesisPreviousChecksum(module);
        const createdAtMs = Number(row.created_ms);
        const intact =
          !brokenFromHere &&
          row.checksum !== null &&
          row.checksum.length === 64 &&
          row.previous_checksum === expectedPrevious &&
          row.checksum ===
            computeChecksum({
              id: row.id,
              action: row.action,
              actorId: row.actor_id,
              resourceId: row.resource_id,
              createdAtMs,
              previousChecksum: expectedPrevious,
            });
        if (!intact) {
          brokenFromHere = true;
          broken.push({ module, rowId: row.id });
          if (row.hash_chain_valid !== false) {
            newlyFlagged++;
            toFlag.push(row.id);
          }
        }
        // Past a break this value is unused (everything onward flags), but keep it honest anyway:
        // advance over sealed rows only, so a hypothetical NULL-checksum row neither forks the
        // walk nor masks the link after it.
        if (row.checksum !== null) predecessor = row.checksum;
      }

      if (toFlag.length > 0) {
        // One statement for the module's flags, with a parameterised IN list: `= ANY($1)` cannot
        // work here because node-postgres sends the array untyped and PostgreSQL will not infer
        // an array type for it (42809), nor cast the record it arrives as (42809 the other way).
        await tx.execute(
          sql`UPDATE unified_audit_log SET hash_chain_valid = false WHERE id IN (${sql.join(
            toFlag.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );
      }
    }

    return { rowsChecked, broken, newlyFlagged };
  });
}
