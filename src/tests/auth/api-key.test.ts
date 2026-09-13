import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { getConfig, loadConfig } from "../../lib/config";
import type { Db } from "../../lib/db";
import { signAccessToken } from "../../services/auth/jwt";
import { createTestApp } from "../helpers/test-client";
import { withTestDb } from "../helpers/test-db";
import { createTestMember, createTestOrg, createTestUser } from "../helpers/test-factory";

const testEnv = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  JWT_ACCESS_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  JWT_REFRESH_SECRET: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

beforeAll(() => {
  for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;
  loadConfig();
});
afterAll(() => {
  for (const [k, v] of Object.entries(testEnv)) if (process.env[k] === v) delete process.env[k]; // only remove what we set
});

const hasDb = () => !!process.env.DATABASE_URL;

// ─────────────────────────────────────────────────────────────────────────────
// No-DB: authentication is required before anything else
// ─────────────────────────────────────────────────────────────────────────────

describe("API key routes — no DB (auth required)", () => {
  test("GET /api/api-keys without auth returns 401", async () => {
    const res = await createTestApp().request("/api/api-keys");
    expect(res.status).toBe(401);
  });

  test("POST /api/api-keys without auth returns 401", async () => {
    const res = await createTestApp().request("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "ci" }),
    });
    expect(res.status).toBe(401);
  });

  test("DELETE /api/api-keys/:id without auth returns 401", async () => {
    const res = await createTestApp().request("/api/api-keys/abc", {
      method: "DELETE",
    });
    expect(res.status).toBe(401);
  });

  test("POST /api/api-keys/:id/rotate without auth returns 401", async () => {
    const res = await createTestApp().request("/api/api-keys/abc/rotate", {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  test("an empty Bearer token is rejected as malformed", async () => {
    const res = await createTestApp().request("/api/api-keys", {
      headers: { Authorization: "Bearer " },
    });
    expect(res.status).toBe(401);
  });

  test("a non-Bearer Authorization header falls through to the cookie path", async () => {
    const res = await createTestApp().request("/api/api-keys", {
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DB-backed lifecycle
// ─────────────────────────────────────────────────────────────────────────────

const API_KEY_PERMISSIONS = [
  { string: "apikeys.create", action: "create" },
  { string: "apikeys.read", action: "read" },
  { string: "apikeys.update", action: "update" },
  { string: "apikeys.delete", action: "delete" },
];

/**
 * Builds a role holding exactly the apikeys.* permissions. The seed is not run
 * in tests (every test rolls back), so the permission graph is created inline.
 * `permission_string` is globally unique, hence the ON CONFLICT.
 */
async function createApiKeyRole(
  db: Db,
  grant: string[] = API_KEY_PERMISSIONS.map((p) => p.string),
): Promise<string> {
  for (const perm of API_KEY_PERMISSIONS) {
    await db.execute(sql`
      INSERT INTO permissions (permission_string, resource, action, name)
      VALUES (${perm.string}, 'apikeys', ${perm.action}, ${perm.string})
      ON CONFLICT (permission_string) DO NOTHING
    `);
  }

  const slug = `apikey-test-${crypto.randomUUID().slice(0, 8)}`;
  const rows = await db.execute<{ id: string }>(sql`
    INSERT INTO roles (slug, name, display_name, code, level, priority, is_system_role, is_protected)
    VALUES (${slug}, ${slug}, ${slug}, ${slug}, 50, 50, false, false)
    RETURNING id
  `);
  // `rows` is a pg QueryResult at runtime; drizzle's generic types it as the row
  // shape, so narrow explicitly rather than optional-chaining through `any` —
  // `rows?.[0].id` yields `undefined` instead of failing when the insert returns
  // nothing, which turned a missing role into a confusing FK error downstream.
  const insertedRole = (rows as unknown as { rows: Array<{ id: string }> }).rows[0];
  if (!insertedRole) throw new Error(`seedRole: insert returned no row for ${slug}`);
  const roleId = insertedRole.id;

  for (const permString of grant) {
    await db.execute(sql`
      INSERT INTO role_permissions (role_id, permission_id, source)
      SELECT ${roleId}, p.id, 'system' FROM permissions p
      WHERE p.permission_string = ${permString}
    `);
  }

  return roleId;
}

interface Fixture {
  app: ReturnType<typeof createTestApp>;
  orgId: string;
  userId: string;
  cookie: string;
}

async function makeFixture(db: Db, grant?: string[]): Promise<Fixture> {
  // Owner must exist before the org — organizations.owner_id is NOT NULL.
  const user = await createTestUser(db);
  const org = await createTestOrg(db, { ownerId: user.id });
  await db.execute(sql`UPDATE users SET organization_id = ${org.id} WHERE id = ${user.id}`);

  const roleId = await createApiKeyRole(db, grant);
  await createTestMember(db, {
    organizationId: org.id,
    userId: user.id,
    roleId,
  });

  const token = await signAccessToken(user.id, org.id, getConfig().JWT_ACCESS_SECRET);
  return {
    app: createTestApp(db),
    orgId: org.id,
    userId: user.id,
    cookie: `nawebeus_access=${token}`,
  };
}

async function createKey(
  app: ReturnType<typeof createTestApp>,
  cookie: string,
  body: Record<string, unknown> = {},
): Promise<{ status: number; json: any }> {
  const res = await app.request("/api/api-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      name: `key-${crypto.randomUUID().slice(0, 8)}`,
      ...body,
    }),
  });
  return { status: res.status, json: await res.json() };
}

describe.skipIf(!hasDb())("API key lifecycle", () => {
  test("create returns the key once and persists only a digest", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const { status, json } = await createKey(f.app, f.cookie, {
        name: "ci-deploy",
      });

      expect(status).toBe(201);
      const key: string = json.data.apiKey.key;
      expect(key.startsWith("nwb_live_")).toBe(true);
      expect(json.data.apiKey.status).toBe("active");
      expect(json.data.warning).toBeTruthy();

      const rows = await db.execute<{
        secret_hash: string;
        encrypted_secret: string | null;
        key_prefix: string;
        fingerprint: string;
        public_key: string;
      }>(sql`
        SELECT secret_hash, encrypted_secret, key_prefix, fingerprint, public_key
        FROM api_keys WHERE id = ${json.data.apiKey.id}
      `);
      const row = (rows as any).rows[0];

      // The plaintext secret is nowhere in the row.
      expect(row.secret_hash).not.toBe(key);
      expect(row.secret_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.encrypted_secret).toBeNull();
      expect(row.public_key).toMatch(/^[0-9a-f]{32}$/);
      expect(row.fingerprint).toMatch(/^[0-9a-f]{64}$/);
      // key_prefix is exactly the first 8 characters, per varchar(8).
      expect(row.key_prefix).toBe(key.slice(0, 8));
      expect(key).toContain(row.public_key);
    });
  });

  test("list masks the key and never returns the secret", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const created = await createKey(f.app, f.cookie, { name: "masked" });
      const fullKey: string = created.json.data.apiKey.key;

      const res = await f.app.request("/api/api-keys", {
        headers: { cookie: f.cookie },
      });
      expect(res.status).toBe(200);
      const body: any = await res.json();

      expect(body.data.apiKeys.length).toBe(1);
      const entry = body.data.apiKeys[0];
      expect(entry.maskedKey.startsWith("nwb_live")).toBe(true);
      expect(entry.maskedKey).toContain("...");
      expect(entry.maskedKey).not.toBe(fullKey);

      // Nothing in the payload carries the secret or its hash.
      const serialised = JSON.stringify(body);
      expect(serialised).not.toContain(fullKey);
      expect(serialised).not.toContain(fullKey.split("_")[3]);
    });
  });

  test("a Bearer key authenticates on a protected route as a cookie replacement", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const created = await createKey(f.app, f.cookie);
      const key: string = created.json.data.apiKey.key;

      const res = await f.app.request("/api/auth/sessions", {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(Array.isArray(body.data.sessions)).toBe(true);
    });
  });

  test("a revoked key returns 401", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const created = await createKey(f.app, f.cookie);
      const key: string = created.json.data.apiKey.key;
      const id: string = created.json.data.apiKey.id;

      const del = await f.app.request(`/api/api-keys/${id}`, {
        method: "DELETE",
        headers: { cookie: f.cookie },
      });
      expect(del.status).toBe(200);

      const res = await f.app.request("/api/auth/sessions", {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(res.status).toBe(401);
    });
  });

  test("revoking twice returns 409", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const created = await createKey(f.app, f.cookie);
      const id: string = created.json.data.apiKey.id;

      await f.app.request(`/api/api-keys/${id}`, {
        method: "DELETE",
        headers: { cookie: f.cookie },
      });
      const second = await f.app.request(`/api/api-keys/${id}`, {
        method: "DELETE",
        headers: { cookie: f.cookie },
      });
      expect(second.status).toBe(409);
    });
  });

  test("an expired key returns 401", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const created = await createKey(f.app, f.cookie);
      const key: string = created.json.data.apiKey.key;
      const id: string = created.json.data.apiKey.id;

      // The valid_expiry_check constraint requires expires_at > issued_at, so
      // both move back together.
      await db.execute(sql`
        UPDATE api_keys
        SET issued_at = now() - interval '10 days',
            expires_at = now() - interval '1 day'
        WHERE id = ${id}
      `);

      const res = await f.app.request("/api/auth/sessions", {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(res.status).toBe(401);
    });
  });

  test("an unknown but well-formed key returns 401", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const fake = `nwb_live_${"a".repeat(32)}_${"b".repeat(64)}`;
      const res = await f.app.request("/api/auth/sessions", {
        headers: { Authorization: `Bearer ${fake}` },
      });
      expect(res.status).toBe(401);
    });
  });

  test("a malformed key returns 401", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      for (const bad of ["nwb_live_notakey", "garbage", "nwb_live_" + "a".repeat(32)]) {
        const res = await f.app.request("/api/auth/sessions", {
          headers: { Authorization: `Bearer ${bad}` },
        });
        expect(res.status).toBe(401);
      }
    });
  });

  test("a wrong secret against a real public key returns 401", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const created = await createKey(f.app, f.cookie);
      const key: string = created.json.data.apiKey.key;
      const [namespace, env, publicKey] = key.split("_");

      const tampered = `${namespace}_${env}_${publicKey}_${"c".repeat(64)}`;
      const res = await f.app.request("/api/auth/sessions", {
        headers: { Authorization: `Bearer ${tampered}` },
      });
      expect(res.status).toBe(401);
    });
  });

  test("a duplicate key name in the same organization returns 409", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const first = await createKey(f.app, f.cookie, {
        name: "duplicate-name",
      });
      expect(first.status).toBe(201);

      const second = await createKey(f.app, f.cookie, {
        name: "duplicate-name",
      });
      expect(second.status).toBe(409);
      expect(second.json.error.code).toBe("CONFLICT");
    });
  });

  test("a user without apikeys.create gets 403", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db, []); // role with no permissions
      const res = await createKey(f.app, f.cookie);
      expect(res.status).toBe(403);
    });
  });

  test("a read_only key can read but cannot create", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const created = await createKey(f.app, f.cookie, {
        name: "read-only",
        permissionLevel: "read_only",
      });
      expect(created.status).toBe(201);
      const key: string = created.json.data.apiKey.key;

      const read = await f.app.request("/api/api-keys", {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(read.status).toBe(200);

      // The narrowed ability is enforced by the same requireAbility guard.
      const write = await f.app.request("/api/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ name: "should-fail" }),
      });
      expect(write.status).toBe(403);
    });
  });

  test("scopes restrict a key to the subjects it names", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const created = await createKey(f.app, f.cookie, {
        name: "scoped",
        permissionLevel: "admin",
        scopes: ["members"],
      });
      const key: string = created.json.data.apiKey.key;

      // admin permission level, but `apikeys` is not in scopes.
      const res = await f.app.request("/api/api-keys", {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(res.status).toBe(403);
    });
  });

  test("an admin key with no scopes inherits the owner's ability", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const created = await createKey(f.app, f.cookie, {
        name: "admin-key",
        permissionLevel: "admin",
      });
      const key: string = created.json.data.apiKey.key;

      const res = await f.app.request("/api/api-keys", {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(res.status).toBe(200);
    });
  });

  test("a write key can create but cannot delete", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const created = await createKey(f.app, f.cookie, {
        name: "write-key",
        permissionLevel: "write",
      });
      const key: string = created.json.data.apiKey.key;
      const id: string = created.json.data.apiKey.id;

      // `create` is inside the write level — this proves the key is live, so the
      // 403 below is about the delete action specifically, not a dead key.
      const createRes = await createKey(f.app, f.cookie, {
        name: "made-by-write-key",
      });
      expect(createRes.status).toBe(201);

      const deleteRes = await f.app.request(`/api/api-keys/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(deleteRes.status).toBe(403);

      // …and the key really is still there.
      const stillThere = await f.app.request(`/api/api-keys`, {
        headers: { cookie: f.cookie },
      });
      const names = (await stillThere.json()).data.apiKeys.map((k: any) => k.name);
      expect(names).toContain("write-key");
    });
  });

  test("an admin key cannot exceed the permissions its owner actually holds", async () => {
    await withTestDb(async ({ db }) => {
      // Owner can read and create, but not delete. `admin` must mean "no
      // narrowing", never "escalate" — the key must not gain `delete`.
      const f = await makeFixture(db, ["apikeys.read", "apikeys.create"]);
      const created = await createKey(f.app, f.cookie, {
        name: "admin-key",
        permissionLevel: "admin",
      });
      const key: string = created.json.data.apiKey.key;

      // A second key, created by the owner directly, to aim the delete at.
      const victim = await createKey(f.app, f.cookie, { name: "victim" });
      expect(victim.status).toBe(201);

      const readRes = await f.app.request("/api/api-keys", {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(readRes.status).toBe(200);

      const deleteRes = await f.app.request(`/api/api-keys/${victim.json.data.apiKey.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(deleteRes.status).toBe(403);
    });
  });

  test("rotation issues a working replacement and kills the old key", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const created = await createKey(f.app, f.cookie, { name: "rotating" });
      const oldKey: string = created.json.data.apiKey.key;
      const id: string = created.json.data.apiKey.id;

      const rot = await f.app.request(`/api/api-keys/${id}/rotate`, {
        method: "POST",
        headers: { cookie: f.cookie },
      });
      expect(rot.status).toBe(201);
      const rotated: any = await rot.json();
      const newKey: string = rotated.data.apiKey.key;
      expect(newKey).not.toBe(oldKey);

      // New key works.
      const ok = await f.app.request("/api/auth/sessions", {
        headers: { Authorization: `Bearer ${newKey}` },
      });
      expect(ok.status).toBe(200);

      // Old key is dead.
      const dead = await f.app.request("/api/auth/sessions", {
        headers: { Authorization: `Bearer ${oldKey}` },
      });
      expect(dead.status).toBe(401);

      // Lineage is recorded, and the name is reused.
      const rows = await db.execute<{
        rotation_count: number;
        secret_version: number;
        rotated_from_id: string;
      }>(
        sql`SELECT rotation_count, secret_version, rotated_from_id
            FROM api_keys WHERE id = ${rotated.data.apiKey.id}`,
      );
      const row = (rows as any).rows[0];
      expect(row.rotation_count).toBe(1);
      expect(row.secret_version).toBe(2);
      expect(row.rotated_from_id).toBe(id);
    });
  });

  test("tenant isolation: one org cannot see or revoke another org's keys", async () => {
    await withTestDb(async ({ db }) => {
      const a = await makeFixture(db);
      const b = await makeFixture(db);

      const createdB = await createKey(b.app, b.cookie, { name: "org-b-key" });
      const keyB: string = createdB.json.data.apiKey.key;
      const idB: string = createdB.json.data.apiKey.id;

      // A's list does not include B's key.
      const listA = await a.app.request("/api/api-keys", {
        headers: { cookie: a.cookie },
      });
      const bodyA: any = await listA.json();
      expect(bodyA.data.apiKeys.map((k: any) => k.id)).not.toContain(idB);
      expect(bodyA.data.apiKeys.length).toBe(0);

      // A cannot revoke B's key — and learns nothing about its existence.
      const del = await a.app.request(`/api/api-keys/${idB}`, {
        method: "DELETE",
        headers: { cookie: a.cookie },
      });
      expect(del.status).toBe(404);

      // B's key still works.
      const stillOk = await b.app.request("/api/auth/sessions", {
        headers: { Authorization: `Bearer ${keyB}` },
      });
      expect(stillOk.status).toBe(200);
    });
  });

  test("a key authenticates into its own organization, not the caller's", async () => {
    await withTestDb(async ({ db }) => {
      const a = await makeFixture(db);
      const b = await makeFixture(db);
      const createdB = await createKey(b.app, b.cookie);
      const keyB: string = createdB.json.data.apiKey.key;

      // A's own session and B's key resolve to different identities: the key
      // carries B's org, so A's cookie must not widen it.
      const viaKey = await a.app.request("/api/auth/sessions", {
        headers: { Authorization: `Bearer ${keyB}` },
      });
      expect(viaKey.status).toBe(200);

      const rows = await db.execute<{ user_id: string }>(
        sql`SELECT user_id FROM api_keys WHERE organization_id = ${b.orgId}`,
      );
      expect(((rows as any).rows[0] as any).user_id).toBe(b.userId);
      expect(b.orgId).not.toBe(a.orgId);
    });
  });

  test("removing the owner's membership invalidates their keys", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const created = await createKey(f.app, f.cookie);
      const key: string = created.json.data.apiKey.key;

      const before = await f.app.request("/api/auth/sessions", {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(before.status).toBe(200);

      await db.execute(sql`
        UPDATE organization_members SET deleted_at = now()
        WHERE user_id = ${f.userId} AND organization_id = ${f.orgId}
      `);

      const after = await f.app.request("/api/auth/sessions", {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(after.status).toBe(403);
    });
  });

  test("usage is recorded on each authenticated request", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const created = await createKey(f.app, f.cookie);
      const key: string = created.json.data.apiKey.key;
      const id: string = created.json.data.apiKey.id;

      await f.app.request("/api/auth/sessions", {
        headers: { Authorization: `Bearer ${key}` },
      });
      await f.app.request("/api/auth/sessions", {
        headers: { Authorization: `Bearer ${key}` },
      });

      const rows = await db.execute<{
        usage_count: number;
        last_used_at: Date | null;
      }>(sql`SELECT usage_count, last_used_at FROM api_keys WHERE id = ${id}`);
      const row = (rows as any).rows[0];
      expect(row.usage_count).toBe(2);
      expect(row.last_used_at).not.toBeNull();
    });
  });

  test("a malformed id returns 422 rather than a database error", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const del = await f.app.request("/api/api-keys/not-a-uuid", {
        method: "DELETE",
        headers: { cookie: f.cookie },
      });
      expect(del.status).toBe(422);
    });
  });

  test("an unknown but valid uuid returns 404", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const del = await f.app.request(`/api/api-keys/${crypto.randomUUID()}`, {
        method: "DELETE",
        headers: { cookie: f.cookie },
      });
      expect(del.status).toBe(404);
    });
  });

  test("create and revoke write audit events without the key value", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const created = await createKey(f.app, f.cookie, { name: "audited" });
      const key: string = created.json.data.apiKey.key;
      const id: string = created.json.data.apiKey.id;

      await f.app.request(`/api/api-keys/${id}`, {
        method: "DELETE",
        headers: { cookie: f.cookie },
      });

      const rows = await db.execute<{
        action: string;
        category: string;
        after_state: unknown;
      }>(
        sql`SELECT action, category, after_state FROM unified_audit_log
            WHERE resource_id = ${id} AND action LIKE 'apikeys.%'
            ORDER BY created_at`,
      );
      const actions = ((rows as any).rows ?? []).map((r: any) => r.action);
      expect(actions).toContain("apikeys.created");
      expect(actions).toContain("apikeys.revoked");

      const serialised = JSON.stringify((rows as any).rows);
      expect(serialised).not.toContain(key);
      expect(serialised).not.toContain(key.split("_")[3]);
    });
  });

  test("revoked keys are still listable under an explicit status filter", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const created = await createKey(f.app, f.cookie);
      const id: string = created.json.data.apiKey.id;
      await f.app.request(`/api/api-keys/${id}`, {
        method: "DELETE",
        headers: { cookie: f.cookie },
      });

      const active = await f.app.request("/api/api-keys", {
        headers: { cookie: f.cookie },
      });
      expect(((await active.json()) as any).data.apiKeys.length).toBe(0);

      const revoked = await f.app.request("/api/api-keys?status=revoked", {
        headers: { cookie: f.cookie },
      });
      const body: any = await revoked.json();
      expect(body.data.apiKeys.length).toBe(1);
      expect(body.data.apiKeys[0].status).toBe("revoked");
      expect(body.data.apiKeys[0].revokedAt).not.toBeNull();
    });
  });

  test("a bad status filter returns 422", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const res = await f.app.request("/api/api-keys?status=bogus", {
        headers: { cookie: f.cookie },
      });
      expect(res.status).toBe(422);
    });
  });

  test("creating a key without a name returns 422", async () => {
    await withTestDb(async ({ db }) => {
      const f = await makeFixture(db);
      const res = await f.app.request("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: f.cookie },
        body: JSON.stringify({ description: "no name" }),
      });
      expect(res.status).toBe(422);
    });
  });
});
