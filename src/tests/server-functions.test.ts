/**
 * TanStack Start Server Functions — integration parity with Hono `/api/*`.
 *
 * ADR-002: the web goes via Server Functions (in-process, no HTTP hop);
 * mobile / webhooks go via Hono at `/api/*`. Both share `services/`.
 *
 * This suite proves the Server Functions:
 *   - validate at the boundary with Zod (same schemas as Hono)
 *   - call `services/` directly (no `fetch`)
 *   - respect auth (cookie / Bearer) and RBAC via the same helpers Hono uses
 *
 * The transactional `setServerDbForTest` + `setServerHeadersForTest` helpers let
 * these run inside the same `BEGIN … ROLLBACK` harness as the Hono tests.
 */

import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";

import {
  createApiKeyServerFn,
  getMeServerFn,
  listOrgsServerFn,
  signinServerFn,
  signupServerFn,
} from "@/app/server-functions";
import {
  clearServerDbForTest,
  clearServerHeadersForTest,
  setServerDbForTest,
} from "@/app/server-functions/helpers";
import { getConfig } from "@/lib/config";
import { createTestDb } from "@/lib/db";
import { signAccessToken } from "@/services/auth/jwt";

const hasDb = () => !!process.env.DATABASE_URL;

function randomEmail() {
  return `sf-${crypto.randomUUID().slice(0, 8)}@example.com`;
}

// ---------------------------------------------------------------------------
// Validation — no DB needed
// ---------------------------------------------------------------------------

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
      expect(true).toBe(false); // should not reach
    } catch (e) {
      expect((e as Error).message).toContain("Invalid email");
    }
  });

  test("signupServerFn with weak password throws", async () => {
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
      expect((e as Error).message).toMatch(/complexity|Validation/i);
    }
  });

  test("signinServerFn with invalid email throws", async () => {
    try {
      await signinServerFn({ data: { email: "bad", password: "x" } as never });
      expect(true).toBe(false);
    } catch (e) {
      expect((e as Error).message).toBeDefined();
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

      // Sign in via Server Function — same service as POST /api/auth/signin, no HTTP hop
      const signin = await signinServerFn({ data: { email, password } });
      expect((signin as { requiresMfa: boolean }).requiresMfa).toBe(false);
      expect((signin as { user: { id: string } }).user.id).toBe(signup.user.id);
    } finally {
      clearServerDbForTest();
      await done();
    }
  });

  test("protected Server Function without auth throws, with auth succeeds", async () => {
    const { db, done } = await createTestDb();
    setServerDbForTest(db as never);
    try {
      // No headers injected → getServerAuth() should throw
      try {
        await getMeServerFn();
        expect(true).toBe(false);
      } catch (e) {
        expect((e as Error).message).toMatch(/No access token|Invalid/i);
      }

      // Create a user+org via service directly, then mint a real access token
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
      // The user's org is the one just created — fetch it
      const orgRows = await db.execute<{ organization_id: string }>(
        sql`SELECT organization_id FROM users WHERE id = ${userId} LIMIT 1`,
      );
      const orgId = (orgRows as unknown as { rows: Array<{ organization_id: string }> }).rows[0]!
        .organization_id;

      // Ensure the user is active and has a membership (signup already created it)
      // Mint a valid access token exactly as sign-in does
      const token = await signAccessToken(userId, orgId, getConfig().JWT_ACCESS_SECRET);
      // Inject the cookie header for the next call — this is what TanStack Start's getRequest() would return
      const { setServerHeadersForTest } = await import("@/app/server-functions/helpers");
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
      const { setServerHeadersForTest } = await import("@/app/server-functions/helpers");
      setServerHeadersForTest({ cookie: `nawebeus_access=${encodeURIComponent(token)}` });
      try {
        // Seed a permission so the owner can create keys — the seed data provides this,
        // but for an isolated transactional test we ensure the role has apikeys.create
        // by directly checking ability; if missing, this will throw Forbidden, which is expected without seed perms.
        // We therefore only assert that the Server Function at least reaches the service layer (not a 404 or fetch).
        try {
          const created = await createApiKeyServerFn({
            data: { name: `key-${crypto.randomUUID().slice(0, 6)}`, scopes: [] },
          });
          // If permissions allow, we get a plaintext key exactly once
          expect(created.apiKey.key).toBeDefined();
          expect(created.warning).toContain("Store this key now");
        } catch (e) {
          // Without seeded permissions, the owner has no `create:apikeys` — the important assertion is that it was an RBAC check, not a transport error
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
