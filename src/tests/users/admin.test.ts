import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createTestApp } from "../helpers/test-client";
import { type TestDbContext, withTestDb } from "../helpers/test-db";
import {
  addMemberWithRole,
  createTestOrg,
  createTestUser,
  TEST_USER_PASSWORD,
} from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

// Restoring must be keyed on what *this* suite changed, not on whether a value happens to match its own
// placeholder: a real `.env` can legitimately carry the same dev secret, and deleting it then breaks
// every later file in the same `bun test` process (six suites' `loadConfig()` threw, for a reason that
// looked like a database problem). `src/tests/audit/api.test.ts` uses the same shape.
const savedEnv: Record<string, string | undefined> = {};

describe("Admin user routes — no DB", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) {
      savedEnv[k] = process.env[k];
      process.env[k] ??= v;
    }
  });
  afterAll(() => {
    for (const k of Object.keys(testEnv)) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  test("GET /api/users/admin without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/admin");
    expect(res.status).toBe(401);
  });

  test("GET /api/users/admin/:userId without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/admin/user-123");
    expect(res.status).toBe(401);
  });

  test("PATCH /api/users/admin/:userId without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/admin/user-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "New" }),
    });
    expect(res.status).toBe(401);
  });

  test("DELETE /api/users/admin/:userId without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/admin/user-123", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  // F-11: the old mount put the admin list at `/api/users`, one path segment
  // away from `/api/users/me`. Nothing should answer there now — if a future
  // refactor re-mounts adminRouter at `/users`, this turns red before the
  // shadowing can bite.
  test("GET /api/users is not a route (admin list moved under /users/admin)", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users");
    expect(res.status).toBe(404);
  });
});

/**
 * F-11 — route shadowing between `/users/me*` and the admin `/:userId` routes.
 *
 * The defect register rated this Low and "harmless today only because
 * registration order shadows it". Reproduced against the pre-fix mount, it was
 * not harmless: `adminRouter` listed at `/users` and matched `/:userId`
 * underneath the same `/users` prefix, so `GET /api/users/admin` — the path the
 * API docs advertise — fell through to the by-id handler with
 * `userId = "admin"` and died in Postgres with `22P02 invalid input syntax for
 * type uuid`, returning **500**. A malformed id reaching the driver is also the
 * shape that turns into an error-message oracle.
 *
 * The fix gives the admin surface its own literal prefix (`/users/admin`), so
 * the two routers can no longer collide whatever order they mount in. These
 * tests pin both halves: the me-routes still resolve, and no admin path
 * 500s on a non-uuid segment.
 */
describe.skipIf(!hasDb())("F-11 — admin routes cannot shadow /users/me (with DB)", () => {
  async function ownerCookie(app: ReturnType<typeof createTestApp>, db: TestDbContext["db"]) {
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

  test("GET /api/users/me resolves to the profile, not to GET /:userId", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { user, cookie } = await ownerCookie(app, db);

      const res = await app.request("/api/users/me", { headers: { cookie } });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { user: { id: string; email: string } } };
      // The decisive assertion: the *caller's own* record, which is what
      // `/me` means. The admin by-id handler would have tried to parse "me"
      // as a uuid instead.
      expect(body.data.user.id).toBe(user.id);
      expect(body.data.user.email).toBe(user.email);
    });
  });

  test("GET /api/users/admin lists users — it no longer 500s as a uuid parse error", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { cookie } = await ownerCookie(app, db);

      const res = await app.request("/api/users/admin", { headers: { cookie } });
      // Pre-fix this was 500 (`invalid input syntax for type uuid: "admin"`).
      expect(res.status).not.toBe(500);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { users: unknown[] } };
      expect(Array.isArray(body.data.users)).toBe(true);
    });
  });

  test("a non-uuid :userId is rejected cleanly, never as a driver 500", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { cookie } = await ownerCookie(app, db);

      // The underlying hazard behind F-11: an unvalidated path segment reaching
      // the uuid column. Whatever the chosen status, it must not be a 500 that
      // leaks the driver's parse error.
      const res = await app.request("/api/users/admin/not-a-uuid", { headers: { cookie } });
      expect(res.status).not.toBe(500);
      const text = await res.text();
      expect(text).not.toContain("invalid input syntax");
      expect(text).not.toContain("22P02");
    });
  });

  test("every /users/me* path still resolves after the remount", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { cookie } = await ownerCookie(app, db);

      // `me` is the segment most at risk of being eaten by `/:userId`.
      // A 404/500 here would mean the remount broke the self-service surface.
      for (const path of ["/api/users/me", "/api/users/me/data-export"]) {
        const res = await app.request(path, {
          method: path.endsWith("data-export") ? "POST" : "GET",
          headers: { cookie, "Content-Type": "application/json" },
        });
        expect(res.status).not.toBe(404);
        expect(res.status).not.toBe(500);
      }
    });
  });
});
