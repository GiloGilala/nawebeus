/**
 * Malformed uuid path parameters must not reach Postgres — F-11 follow-on.
 *
 * Found while fixing F-11 (route shadowing). `GET /api/users/admin` was
 * matching the admin `/:userId` handler with `userId = "admin"`, and the 500 it
 * produced turned out not to be about shadowing at all: the id went straight
 * into a `WHERE id = $1` against a `uuid` column, so Postgres raised
 * `22P02 invalid input syntax for type uuid` on *any* non-uuid segment.
 *
 * Measured across the route families before the fix — 4 of 5 were affected:
 *
 * | Route                                        | Before | After |
 * |----------------------------------------------|--------|-------|
 * | `GET /api/users/admin/:userId`                | 500    | 422   |
 * | `GET /api/orgs/:orgId/members/:memberId`      | 500    | 422   |
 * | `DELETE /api/auth/sessions/:sessionId`        | 500    | 422   |
 * | `GET /api/users/me/data-export/:requestId`    | 500    | 422   |
 * | `GET /api/api-keys/:id`                       | 404    | 404   |
 *
 * api-keys was already correct — it validated inline — which is where the
 * shared `uuidParam` helper came from.
 *
 * Why this matters beyond tidiness: a 500 is the wrong status for a bad client
 * request, it fires error alerting for routine junk traffic, and a driver error
 * one `errorHandler` change away from being echoed is an information leak. The
 * cases below are the negative half of NWB-P0-011's route contract.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { isUuid } from "../server/api/route-params";
import { createTestApp } from "./helpers/test-client";
import { withTestDb } from "./helpers/test-db";
import {
  addMemberWithRole,
  createTestOrg,
  createTestUser,
  TEST_USER_PASSWORD,
} from "./helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

/** Signs in an org owner and returns the cookie header plus ids. */
async function ownerSession(
  app: ReturnType<typeof createTestApp>,
  db: Parameters<typeof addMemberWithRole>[0],
) {
  const user = await createTestUser(db);
  const org = await createTestOrg(db, { ownerId: user.id });
  await addMemberWithRole(db, {
    organizationId: org.id,
    userId: user.id,
    roleCode: "owner",
  });
  const res = await app.request("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password: TEST_USER_PASSWORD }),
  });
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  return { user, org, cookie };
}

describe.skipIf(!hasDb())("Malformed uuid path params are rejected, not 500s (with DB)", () => {
  // One case per affected route family. Each runs in its own transaction
  // because a 500 from the driver aborts the surrounding one.
  const cases: { name: string; method: string; path: (orgId: string) => string }[] = [
    {
      name: "GET /api/users/admin/:userId",
      method: "GET",
      path: () => "/api/users/admin/not-a-uuid",
    },
    {
      name: "PATCH /api/users/admin/:userId",
      method: "PATCH",
      path: () => "/api/users/admin/not-a-uuid",
    },
    {
      name: "DELETE /api/users/admin/:userId",
      method: "DELETE",
      path: () => "/api/users/admin/not-a-uuid",
    },
    {
      name: "GET /api/orgs/:orgId/members/:memberId",
      method: "GET",
      path: (orgId) => `/api/orgs/${orgId}/members/not-a-uuid`,
    },
    {
      name: "DELETE /api/auth/sessions/:sessionId",
      method: "DELETE",
      path: () => "/api/auth/sessions/not-a-uuid",
    },
    {
      name: "GET /api/users/me/data-export/:requestId",
      method: "GET",
      path: () => "/api/users/me/data-export/not-a-uuid",
    },
  ];

  for (const { name, method, path } of cases) {
    test(`${name} → 422, not 500`, async () => {
      await withTestDb(async ({ db }) => {
        const app = createTestApp(db);
        const { org, cookie } = await ownerSession(app, db);

        const res = await app.request(path(org.id), {
          method,
          headers: { cookie, "Content-Type": "application/json" },
          ...(method === "PATCH" ? { body: JSON.stringify({ firstName: "X" }) } : {}),
        });

        expect(res.status).toBe(422);
        const body = (await res.json()) as {
          error: { code: string; message: string; details?: unknown };
        };
        expect(body.error.code).toBe("VALIDATION_ERROR");
        // The driver's message must never reach the client.
        const raw = JSON.stringify(body);
        expect(raw).not.toContain("invalid input syntax");
        expect(raw).not.toContain("22P02");
        expect(raw).not.toContain("uuid:");
      });
    });
  }

  test("a well-formed but unknown uuid still reaches the service (404, not 422)", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { cookie } = await ownerSession(app, db);

      // The guard must reject only *malformed* ids. If it started swallowing
      // valid-but-absent ones, "not found" would become indistinguishable from
      // "bad request" and the fix would have broken the contract it protects.
      const res = await app.request(`/api/users/admin/${crypto.randomUUID()}`, {
        headers: { cookie },
      });
      expect(res.status).not.toBe(422);
      expect(res.status).not.toBe(500);
      expect(res.status).toBe(404);
    });
  });

  test("uppercase uuids are accepted — Postgres accepts them too", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { cookie } = await ownerSession(app, db);

      // Guarding against an over-strict regex: rejecting these would break
      // clients that upper-case ids, and Postgres itself is case-insensitive.
      const res = await app.request(`/api/users/admin/${crypto.randomUUID().toUpperCase()}`, {
        headers: { cookie },
      });
      expect(res.status).not.toBe(422);
      expect(res.status).toBe(404);
    });
  });
});

describe("isUuid — no DB needed", () => {
  beforeAll(() => {});

  test("accepts canonical uuids in either case", () => {
    expect(isUuid("3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(true);
    expect(isUuid("3F2504E0-4F89-11D3-9A0C-0305E82C3301")).toBe(true);
    expect(isUuid(crypto.randomUUID())).toBe(true);
  });

  test("rejects the shapes that used to reach the driver", () => {
    for (const bad of [
      "admin", // the literal segment that started this (F-11)
      "me",
      "not-a-uuid",
      "",
      "123",
      "3f2504e0-4f89-11d3-9a0c-0305e82c330", // one char short
      "3f2504e0-4f89-11d3-9a0c-0305e82c33011", // one char long
      "3f2504e0_4f89_11d3_9a0c_0305e82c3301", // wrong separators
      "zzzzzzzz-4f89-11d3-9a0c-0305e82c3301", // non-hex
      "3f2504e0-4f89-11d3-9a0c-0305e82c3301 ", // trailing space
      "' OR 1=1 --",
    ]) {
      expect(isUuid(bad)).toBe(false);
    }
  });

  test("rejects undefined (a missing param, not just a malformed one)", () => {
    expect(isUuid(undefined)).toBe(false);
  });
});
