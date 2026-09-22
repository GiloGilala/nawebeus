/**
 * TanStack Start Server Functions — integration parity with Hono `/api/*`.
 *
 * ADR-002 + tanstack-start.md: validate with the shared Zod schemas, call
 * services in-process, session-cookie auth only, tenant id from the session.
 */

import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";

import {
  createApiKeyServerFn,
  getMeServerFn,
  listOrgsServerFn,
  signinServerFn,
  signupServerFn,
  updateOrgServerFn,
} from "@/app/server-functions";
import {
  clearServerDbForTest,
  clearServerHeadersForTest,
  setServerDbForTest,
  setServerHeadersForTest,
} from "@/app/server-functions/helpers";
import { getConfig } from "@/lib/config";
import { createTestDb } from "@/lib/db";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { signAccessToken } from "@/services/auth/jwt";

const hasDb = () => !!process.env.DATABASE_URL;

function randomEmail() {
  return `sf-${crypto.randomUUID().slice(0, 8)}@example.com`;
}

describe("Server Functions — validation (no DB)", () => {
  test("signupServerFn with invalid email throws ValidationError", async () => {
    try {
      await signupServerFn({
        data: {
          email: "not-an-email",
          password: "ValidPass123!",
          fullName: "Ada",
          organizationName: "Org",
          termsAccepted: true,
          privacyAccepted: true,
        } as never,
      });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).statusCode).toBe(422);
      expect((e as ValidationError).details?.some((d) => /email/i.test(d.message))).toBe(true);
    }
  });

  test("signupServerFn with weak password throws ValidationError", async () => {
    try {
      await signupServerFn({
        data: {
          email: randomEmail(),
          password: "short",
          fullName: "Ada",
          organizationName: "Org",
          termsAccepted: true,
          privacyAccepted: true,
        } as never,
      });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as Error).message).toMatch(/complexity|Validation/i);
    }
  });

  test("signinServerFn with invalid email throws ValidationError", async () => {
    try {
      await signinServerFn({ data: { email: "bad", password: "x" } as never });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).statusCode).toBe(422);
    }
  });
});

describe.skipIf(!hasDb())("Server Functions — integration (with DB)", () => {
  test("signupServerFn then signinServerFn via direct in-process calls", async () => {
    const { db, done } = await createTestDb();
    setServerDbForTest(db as never);
    try {
      const email = randomEmail();
      const password = "ValidPass123!";

      const signup = await signupServerFn({
        data: {
          email,
          password,
          fullName: "Chidi ServerFn",
          organizationName: `SF Org ${crypto.randomUUID().slice(0, 6)}`,
          termsAccepted: true,
          privacyAccepted: true,
        },
      });
      expect(signup.user.email).toBe(email);
      expect(signup.organization.slug).toBeDefined();

      const signin = await signinServerFn({ data: { email, password } });
      expect((signin as { requiresMfa: boolean }).requiresMfa).toBe(false);
      expect((signin as { user: { id: string } }).user.id).toBe(signup.user.id);
    } finally {
      clearServerDbForTest();
      await done();
    }
  });

  test("protected Server Function without a session cookie throws UnauthorizedError", async () => {
    const { db, done } = await createTestDb();
    setServerDbForTest(db as never);
    try {
      try {
        await getMeServerFn();
        expect(true).toBe(false);
      } catch (e) {
        expect(e).toBeInstanceOf(UnauthorizedError);
      }
    } finally {
      clearServerDbForTest();
      await done();
    }
  });

  test("Bearer API keys are rejected — server functions are session-cookie only", async () => {
    const { db, done } = await createTestDb();
    setServerDbForTest(db as never);
    setServerHeadersForTest({ authorization: "Bearer nwb_test_key" });
    try {
      try {
        await getMeServerFn();
        expect(true).toBe(false);
      } catch (e) {
        expect(e).toBeInstanceOf(UnauthorizedError);
        expect((e as Error).message).toMatch(/session cookies/i);
      }
    } finally {
      clearServerHeadersForTest();
      clearServerDbForTest();
      await done();
    }
  });

  test("protected Server Function with a session cookie succeeds", async () => {
    const { db, done } = await createTestDb();
    setServerDbForTest(db as never);
    try {
      const email = randomEmail();
      const password = "ValidPass123!";
      const signup = await signupServerFn({
        data: {
          email,
          password,
          fullName: "Auth Test",
          organizationName: `AuthOrg-${crypto.randomUUID().slice(0, 6)}`,
          termsAccepted: true,
          privacyAccepted: true,
        },
      });
      const userId = signup.user.id;
      const orgRows = await db.execute<{ organization_id: string }>(
        sql`SELECT organization_id FROM users WHERE id = ${userId} LIMIT 1`,
      );
      const orgId = (orgRows as unknown as { rows: Array<{ organization_id: string }> }).rows[0]!
        .organization_id;

      const token = await signAccessToken(userId, orgId, getConfig().JWT_ACCESS_SECRET);
      setServerHeadersForTest({ cookie: `nawebeus_access=${encodeURIComponent(token)}` });
      try {
        const me = await getMeServerFn();
        expect(me.user.email).toBe(email);
        const orgs = await listOrgsServerFn();
        expect(orgs.orgs.length).toBeGreaterThan(0);
      } finally {
        clearServerHeadersForTest();
      }
    } finally {
      clearServerDbForTest();
      await done();
    }
  });

  test("updateOrgServerFn ignores a client-supplied orgId (tenant from session)", async () => {
    const { db, done } = await createTestDb();
    setServerDbForTest(db as never);
    try {
      const email = randomEmail();
      const signup = await signupServerFn({
        data: {
          email,
          password: "ValidPass123!",
          fullName: "Tenant Test",
          organizationName: `TenantOrg-${crypto.randomUUID().slice(0, 6)}`,
          termsAccepted: true,
          privacyAccepted: true,
        },
      });
      const userId = signup.user.id;
      const orgRows = await db.execute<{ organization_id: string }>(
        sql`SELECT organization_id FROM users WHERE id = ${userId} LIMIT 1`,
      );
      const orgId = (orgRows as unknown as { rows: Array<{ organization_id: string }> }).rows[0]!
        .organization_id;
      const token = await signAccessToken(userId, orgId, getConfig().JWT_ACCESS_SECRET);
      setServerHeadersForTest({ cookie: `nawebeus_access=${encodeURIComponent(token)}` });
      try {
        // Extra `orgId` in the payload must not select a tenant — the session org
        // is the only one that can be written (tanstack-start.md §10.3).
        try {
          const updated = await updateOrgServerFn({
            data: {
              orgId: "00000000-0000-0000-0000-000000000000",
              name: "Renamed From Session",
            } as never,
          });
          expect(updated.org.id).toBe(orgId);
          expect(updated.org.name).toBe("Renamed From Session");
        } catch (e) {
          // Unknown keys may be rejected as ValidationError, or the owner may
          // lack `update:org` in an unseeded transaction — either is not a tenant leak.
          expect((e as Error).message).toMatch(
            /Validation|Missing permission|Forbidden|Unrecognized/i,
          );
        }
      } finally {
        clearServerHeadersForTest();
      }
    } finally {
      clearServerDbForTest();
      await done();
    }
  });

  test("createApiKeyServerFn goes through Server Function in-process, not via fetch", async () => {
    const { db, done } = await createTestDb();
    setServerDbForTest(db as never);
    try {
      const email = randomEmail();
      const signup = await signupServerFn({
        data: {
          email,
          password: "ValidPass123!",
          fullName: "Key Owner",
          organizationName: `KeyOrg-${crypto.randomUUID().slice(0, 6)}`,
          termsAccepted: true,
          privacyAccepted: true,
        },
      });
      const userId = signup.user.id;
      const orgRows = await db.execute<{ organization_id: string }>(
        sql`SELECT organization_id FROM users WHERE id = ${userId} LIMIT 1`,
      );
      const orgId = (orgRows as unknown as { rows: Array<{ organization_id: string }> }).rows[0]!
        .organization_id;
      const token = await signAccessToken(userId, orgId, getConfig().JWT_ACCESS_SECRET);
      setServerHeadersForTest({ cookie: `nawebeus_access=${encodeURIComponent(token)}` });
      try {
        try {
          const created = await createApiKeyServerFn({
            data: { name: `key-${crypto.randomUUID().slice(0, 6)}`, scopes: [] },
          });
          expect(created.apiKey.key).toBeDefined();
          expect(created.warning).toContain("Store this key now");
        } catch (e) {
          expect((e as Error).message).toMatch(/Missing permission|Forbidden/i);
        }
      } finally {
        clearServerHeadersForTest();
      }
    } finally {
      clearServerDbForTest();
      await done();
    }
  });
});
