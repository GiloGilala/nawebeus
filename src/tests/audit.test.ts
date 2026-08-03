import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { writeAuditLog } from "../services/audit";
import { withTestDb } from "./helpers/test-db";

const hasDb = () => !!process.env.DATABASE_URL;

describe.skipIf(!hasDb())("audit service", () => {
  test("writeAuditLog inserts a row with all fields", async () => {
    await withTestDb(async ({ db }) => {
      await writeAuditLog({
        db,
        module: "core",
        organizationId: "org-1",
        actorId: "user-1",
        actorType: "user",
        action: "auth.login.success",
        category: "authentication",
        resourceType: "session",
        resourceId: "sess-1",
        beforeState: { attempts: 3 },
        afterState: { attempts: 0 },
        changes: { attempts: { from: 3, to: 0 } },
        severity: "info",
        reason: "user logged in",
        requestId: "req-abc",
        sessionId: "sess-1",
      });

      const rows = await db.execute<{ action: string }>(
        sql`SELECT action FROM unified_audit_log WHERE id LIKE 'al_%' ORDER BY created_at DESC LIMIT 1`,
      );
      const row = (rows as any).rows?.[0] as any;
      expect(row.action).toBe("auth.login.success");
    });
  });

  test("writeAuditLog handles minimal params (nulls)", async () => {
    await withTestDb(async ({ db }) => {
      await expect(
        writeAuditLog({
          db,
          module: "core",
          action: "system.startup",
          category: "system_config",
        }),
      ).resolves.toBeUndefined();
    });
  });

  test("writeAuditLog writes 'user_management' as default category", async () => {
    await withTestDb(async ({ db }) => {
      await writeAuditLog({
        db,
        module: "core",
        action: "user.created",
        actorId: "user-1",
        actorType: "user",
      });

      const rows = await db.execute<{ category: string }>(
        sql`SELECT category FROM unified_audit_log WHERE action = 'user.created' ORDER BY created_at DESC LIMIT 1`,
      );
      const row = (rows as any).rows?.[0] as any;
      expect(row.category).toBe("user_management");
    });
  });
});
