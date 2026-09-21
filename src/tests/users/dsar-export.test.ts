import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { getConfig, loadConfig } from "../../lib/config";
import { GoneError, NotFoundError } from "../../lib/errors";
import { createApiKey, parseApiKey } from "../../services/auth/api-key";
import { signAccessToken } from "../../services/auth/jwt";
import { createSession } from "../../services/auth/session";
import { getDataExport, requestDataExport } from "../../services/users/dsar.service";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";
import { addMemberWithRole, createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

/** copy of the account-deletion suite's helper: user → own org → active owner, cookie-ready. */
async function signedInUser(db: Parameters<typeof createTestUser>[0]) {
  const user = await createTestUser(db);
  const org = await createTestOrg(db, { ownerId: user.id });
  await addMemberWithRole(db, { organizationId: org.id, userId: user.id, roleCode: "owner" });
  await db.execute(sql`UPDATE users SET email_verified = true WHERE id = ${user.id}`);
  const token = await signAccessToken(user.id, org.id, getConfig().JWT_ACCESS_SECRET);
  return { user, org, cookie: `nawebeus_access=${encodeURIComponent(token)}` };
}

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

describe("DSAR export routes — no DB (auth required)", () => {
  beforeAll(() => {
    for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;
    loadConfig();
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(testEnv)) if (process.env[k] === v) delete process.env[k];
  });

  test("POST /api/users/me/data-export without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request("/api/users/me/data-export", { method: "POST" });
    expect(res.status).toBe(401);
  });

  test("GET /api/users/me/data-export/:id without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request(`/api/users/me/data-export/${crypto.randomUUID()}`);
    expect(res.status).toBe(401);
  });

  test("POST /api/users/admin/:userId/data-export without auth returns 401", async () => {
    const app = createTestApp();
    const res = await app.request(`/api/users/admin/${crypto.randomUUID()}/data-export`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });
});

describe.skipIf(!hasDb())("DSAR data export — service + routes (with DB)", () => {
  test("export round-trip: all sections present, credentials and key secrets absent, audit row cites this very request", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { user, org, cookie } = await signedInUser(db);

      const session = await createSession(db, crypto.randomUUID(), user.id, "hash", false);
      const apiKey = await createApiKey(db, {
        organizationId: org.id,
        userId: user.id,
        createdBy: user.id,
        actorType: "user",
        name: `key-${crypto.randomUUID().slice(0, 6)}`,
        keyType: "admin",
        environment: "development",
        permissionLevel: "write",
        securityLevel: "standard",
        scopes: [],
        expiresAt: null,
        rotationStrategy: "manual",
      });

      const passwordHashRows = await db.execute<{ password: string | null }>(
        sql`SELECT password FROM users WHERE id = ${user.id}`,
      );
      const passwordHash = (passwordHashRows as any).rows[0]!.password as string | null;

      const created = await app.request("/api/users/me/data-export", {
        method: "POST",
        headers: { cookie },
      });
      expect(created.status).toBe(201);
      const receipt = (
        (await created.json()) as { data: { id: string; status: string; expiresAt: string } }
      ).data;
      expect(receipt.status).toBe("completed");
      expect(new Date(receipt.expiresAt).getTime()).toBeGreaterThan(Date.now());

      const fetched = await app.request(`/api/users/me/data-export/${receipt.id}`, {
        headers: { cookie },
      });
      expect(fetched.status).toBe(200);
      const payload = (await fetched.json()) as {
        data: Record<string, any>;
      };
      const x = payload.data;

      // Sections complete.
      expect(x.meta.formatVersion).toBe(1);
      expect(x.meta.requestId).toBe(receipt.id);
      expect(x.meta.subject.email).toBe(user.email);
      expect(x.profile.id).toBe(user.id);
      expect(x.sessions.some((s: any) => s.id === session.id)).toBe(true);
      expect(x.memberships.some((m: any) => m.organization_id === org.id)).toBe(true);
      expect(x.apiKeys.some((k: any) => k.key_prefix === apiKey.keyPrefix)).toBe(true);
      expect(x.meta.sections.sessions.rows).toBe(x.sessions.length);

      // Self-citation: the request event written before the build appears in
      // the export's own auditLog section.
      const citation = x.auditLog.find((e: any) => e.action === "compliance.dsar.requested");
      expect(citation).toBeDefined();
      expect(citation.resource_id).toBe(receipt.id);
      expect(citation.actor_id).toBe(user.id);

      // No credential or second-factor material anywhere in the package.
      const serialized = JSON.stringify(x);
      expect(serialized).not.toContain("password_hash");
      expect(serialized).not.toContain('"password"');
      expect(serialized).not.toContain("two_factor_secret");
      expect(serialized).not.toContain("two_factor_backup_codes");
      expect(serialized).not.toContain("security_questions");
      expect(serialized).not.toContain("secret_hash");
      expect(serialized).not.toContain("encrypted_secret");
      expect(serialized).not.toContain("session_token_hash");
      if (passwordHash) expect(serialized).not.toContain(passwordHash);
      // API key: prefix and public half are disclosed everywhere the platform
      // lists keys; the SECRET token segment is never serialized.
      const parsedKey = parseApiKey(apiKey.key);
      expect(parsedKey).not.toBeNull();
      expect(parsedKey!.secret.length).toBeGreaterThanOrEqual(16);
      expect(serialized).toContain(apiKey.keyPrefix);
      expect(serialized).not.toContain(parsedKey!.secret);
    });
  });

  test("unknown and foreign export ids both answer 404; nothing leaks", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const alice = await signedInUser(db);
      const bob = await signedInUser(db);

      const receipt = await requestDataExport(db, { userId: bob.user.id });
      const foreign = await app.request(`/api/users/me/data-export/${receipt.id}`, {
        headers: { cookie: alice.cookie },
      });
      expect(foreign.status).toBe(404);

      const missing = await app.request(`/api/users/me/data-export/${crypto.randomUUID()}`, {
        headers: { cookie: alice.cookie },
      });
      expect(missing.status).toBe(404);
    });
  });

  test("an export past its 7-day window answers 410, at the service and the route", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { user, cookie } = await signedInUser(db);

      const receipt = await requestDataExport(db, { userId: user.id });
      await db.execute(sql`
        UPDATE data_export_requests
        SET expires_at = now() - interval '1 minute'
        WHERE id = ${receipt.id}
      `);

      await expect(getDataExport(db, user.id, receipt.id)).rejects.toBeInstanceOf(GoneError);

      const res = await app.request(`/api/users/me/data-export/${receipt.id}`, {
        headers: { cookie },
      });
      expect(res.status).toBe(410);
    });
  });

  test("requests rate-limit at 5 per day; the 6th answers 429", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { cookie } = await signedInUser(db);

      for (let i = 0; i < 5; i++) {
        const res = await app.request("/api/users/me/data-export", {
          method: "POST",
          headers: { cookie },
        });
        expect(res.status).toBe(201);
      }
      const sixth = await app.request("/api/users/me/data-export", {
        method: "POST",
        headers: { cookie },
      });
      expect(sixth.status).toBe(429);
    });
  });

  test("sections above the internal cap close with a truncated marker instead of growing unbounded", async () => {
    await withTestDb(async ({ db }) => {
      const { user } = await signedInUser(db);
      await createSession(db, crypto.randomUUID(), user.id, "h1", false);
      await createSession(db, crypto.randomUUID(), user.id, "h2", false);
      await createSession(db, crypto.randomUUID(), user.id, "h3", false);

      const receipt = await requestDataExport(db, { userId: user.id }, { sectionRowCap: 2 });
      const payload = (await getDataExport(db, user.id, receipt.id)) as Record<string, any>;

      expect(payload.sessions.length).toBe(2);
      expect(payload.meta.sections.sessions.rows).toBe(2);
      expect(payload.meta.sections.sessions.truncated).toBe(true);
    });
  });

  test("admin POST from another tenant answers 404 and creates nothing", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const admin = await signedInUser(db); // tenant A
      const outsider = await signedInUser(db); // tenant B

      const res = await app.request(`/api/users/admin/${outsider.user.id}/data-export`, {
        method: "POST",
        headers: { cookie: admin.cookie },
      });
      expect(res.status).toBe(404);

      const rows = await db.execute<{ n: number }>(
        sql`SELECT count(*)::int AS n FROM data_export_requests WHERE user_id = ${outsider.user.id}`,
      );
      expect((rows as any).rows[0]!.n).toBe(0);
    });
  });

  test("admin POST returns receipt only; the subject fetches the package on their own channel and the audit says who asked", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const admin = await signedInUser(db);

      const subject = await createTestUser(db);
      // Least privilege we seed: the subject only needs the /me channel.
      await addMemberWithRole(db, {
        organizationId: admin.org.id,
        userId: subject.id,
        roleCode: "viewer",
      });
      await db.execute(sql`UPDATE users SET email_verified = true WHERE id = ${subject.id}`);
      const subjectToken = await signAccessToken(
        subject.id,
        admin.org.id,
        getConfig().JWT_ACCESS_SECRET,
      );
      const subjectCookie = `nawebeus_access=${encodeURIComponent(subjectToken)}`;

      const res = await app.request(`/api/users/admin/${subject.id}/data-export`, {
        method: "POST",
        headers: { cookie: admin.cookie },
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { data: Record<string, unknown> };
      expect(body.data.id).toBeDefined();
      expect(body.data.expiresAt).toBeDefined();
      expect(body.data.payload).toBeUndefined();
      expect(JSON.stringify(body.data)).not.toContain("profile");

      // Admin's own /me route cannot fetch it; the subject can.
      const adminGet = await app.request(`/api/users/me/data-export/${body.data.id}`, {
        headers: { cookie: admin.cookie },
      });
      expect(adminGet.status).toBe(404);

      const subjectGet = await app.request(`/api/users/me/data-export/${body.data.id}`, {
        headers: { cookie: subjectCookie },
      });
      expect(subjectGet.status).toBe(200);
      const payload = ((await subjectGet.json()) as { data: any }).data;
      expect(payload.profile.id).toBe(subject.id);

      const citation = payload.auditLog.find(
        (e: any) => e.action === "compliance.dsar.requested" && e.resource_id === body.data.id,
      );
      expect(citation).toBeDefined();
      expect(citation.actor_id).toBe(admin.user.id);
      expect(citation.target_user_id).toBe(subject.id);
    });
  });

  test("getDataExport on a foreign id is a NotFoundError at the service too", async () => {
    await withTestDb(async ({ db }) => {
      const alice = await signedInUser(db);
      const bob = await signedInUser(db);
      const receipt = await requestDataExport(db, { userId: bob.user.id });
      await expect(getDataExport(db, alice.user.id, receipt.id)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });
});
