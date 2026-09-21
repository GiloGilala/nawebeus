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
        action: "auth.signin.completed",
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
      expect(row.action).toBe("auth.signin.completed");
    });
  });

  test("writeAuditLog handles minimal params (nulls)", async () => {
    await withTestDb(async ({ db }) => {
      await expect(
        writeAuditLog({
          db,
          module: "core",
          action: "rate-limits.reclaimed",
        }),
      ).resolves.toBeUndefined();
    });
  });

  test("unspecified columns come from the registry, not from a caller's memory", async () => {
    await withTestDb(async ({ db }) => {
      // `organization.member.status_changed` is filed `user_management` / `user` / `info` in
      // `src/services/audit/actions.ts`. Passing none of the three is the case that matters: it is
      // how an action ends up under two categories depending on who wrote it, which is the reason the
      // defaults live next to the action instead of at 33 call sites.
      await writeAuditLog({
        db,
        module: "core",
        action: "organization.member.status_changed",
        actorId: "user-1",
        actorType: "user",
      });

      const rows = await db.execute<{ category: string; resource_type: string; severity: string }>(
        sql`SELECT category, resource_type, severity FROM unified_audit_log
            WHERE action = 'organization.member.status_changed'
            ORDER BY created_at DESC LIMIT 1`,
      );
      const row = (rows as any).rows?.[0] as any;
      expect(row.category).toBe("user_management");
      expect(row.resource_type).toBe("user");
      expect(row.severity).toBe("info");
    });
  });
});
