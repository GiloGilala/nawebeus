import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import pg from "pg";
import { withAtomicWrites } from "../lib/transaction";
import { signup } from "../services/auth/signup";
import { withTestDb } from "./helpers/test-db";

const hasDb = () => !!process.env.DATABASE_URL;

describe.skipIf(!hasDb())("withAtomicWrites — harness isolation (NWB-P0-002 finding)", () => {
  const PASSWORD = "ValidPass123!";

  test("a signup inside the test harness does not commit the harness transaction", async () => {
    const email = `atomic-${crypto.randomUUID().slice(0, 8)}@example.com`;

    await withTestDb(async ({ db }) => {
      await signup(db, {
        email,
        password: PASSWORD,
        fullName: "Atomic Check",
        organizationName: `Atomic Org ${crypto.randomUUID().slice(0, 8)}`,
        termsAccepted: true,
        privacyAccepted: true,
      } as any);

      // The bug this pins: withAtomicWrites' old txid_current_if_assigned()
      // probe reported "not in a transaction" for the (write-free-so-far)
      // harness transaction, took the production db.transaction() branch,
      // and its COMMIT ended the harness's BEGIN — persisting the user.
      // An external connection must see nothing.
      const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      try {
        const visible = await client.query("SELECT count(*) FROM users WHERE email = $1", [email]);
        expect(Number(visible.rows[0].count)).toBe(0);
      } finally {
        await client.end();
      }
    });

    // And after the harness rollback the data is gone for new connections too.
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      const visible = await client.query("SELECT count(*) FROM users WHERE email = $1", [email]);
      expect(Number(visible.rows[0].count)).toBe(0);
    } finally {
      await client.end();
    }
  });

  test("a failure inside the atomic block rolls back only that block and leaves the outer transaction usable", async () => {
    await withTestDb(async ({ db }) => {
      const marker = `atomic-marker-${crypto.randomUUID().slice(0, 8)}`;

      await expect(
        withAtomicWrites(db, async () => {
          await db.execute(
            sql`INSERT INTO roles (code, slug, name, display_name, level)
						    VALUES (${marker}, ${marker}, 'Atomic Fail Role', 'Atomic Fail', 5)`,
          );
          throw new Error("boom inside atomic block");
        }),
      ).rejects.toThrow("boom inside atomic block");

      // The block's write is rolled back...
      const check = await db.execute(sql`SELECT count(*) FROM roles WHERE code = ${marker}`);
      expect(Number((check as any).rows?.[0]?.count)).toBe(0);

      // ...and the outer transaction still works — the write after the
      // failure lands (this is what breaks if the atomic block's
      // "rollback" actually COMMITted or poisoned the transaction).
      await db.execute(
        sql`INSERT INTO roles (code, slug, name, display_name, level)
				    VALUES (${marker}, ${marker}, 'Atomic After Role', 'Atomic After', 5)`,
      );
      const after = await db.execute(sql`SELECT count(*) FROM roles WHERE code = ${marker}`);
      expect(Number((after as any).rows?.[0]?.count)).toBe(1);
    });
  });

  test("an atomic block leaves the harness transaction alive (savepoint path taken)", async () => {
    await withTestDb(async ({ db }) => {
      // withAtomicWrites must take the savepoint path inside the harness —
      // the production db.transaction() branch would COMMIT the harness
      // BEGIN. Prove the harness transaction survived the atomic block by
      // writing afterwards and confirming it rolls back with the harness.
      const marker = `atomic-alive-${crypto.randomUUID().slice(0, 8)}`;
      const result = await withAtomicWrites(db, async () => "ok");
      expect(result).toBe("ok");
      await db.execute(
        sql`INSERT INTO roles (code, slug, name, display_name) VALUES (${marker}, ${marker}, 'Atomic Alive', 'Atomic Alive')`,
      );
      const seen = await db.execute(sql`SELECT count(*) FROM roles WHERE code = ${marker}`);
      expect(Number((seen as any).rows?.[0]?.count)).toBe(1);

      const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      try {
        const visible = await client.query("SELECT count(*) FROM roles WHERE code = $1", [marker]);
        expect(Number(visible.rows[0].count)).toBe(0);
      } finally {
        await client.end();
      }
    });
  });
});
