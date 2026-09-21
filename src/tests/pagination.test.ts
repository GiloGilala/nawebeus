/**
 * Cursor pagination on list endpoints — F-14.
 *
 * `docs/technical/API Reference.md` §2.6 is normative: cursor-based, never
 * offset, `limit` default 20 / max 100, opaque base64 cursor. (The roadmap's
 * `?page&limit` line contradicts it; resolved in favour of the API Reference
 * and registered as discrepancy D-17.)
 *
 * The properties worth testing are not "does it return 20 rows" but the ones
 * that make a keyset cursor correct:
 *
 *  - a full walk visits every row exactly once — no gaps, no repeats;
 *  - rows that tie on the sort timestamp are not skipped or duplicated at a
 *    page boundary (the reason every cursor carries an id tiebreaker);
 *  - inserting a row mid-walk does not shift the pages already fetched, which
 *    is the correctness advantage over OFFSET;
 *  - the limit is bounded, and bad input is a 422 rather than a silent clamp;
 *  - a cursor is opaque input that reaches a WHERE clause, so a forged one is
 *    rejected before the driver sees it.
 */
import { describe, expect, test } from "bun:test";
import {
  buildPage,
  DEFAULT_PAGE_SIZE,
  decodeCursor,
  encodeCursor,
  MAX_PAGE_SIZE,
  parsePagination,
} from "../lib/pagination";
import { listMembers } from "../services/orgs/member.service";
import { createTestApp } from "./helpers/test-client";
import { withTestDb } from "./helpers/test-db";
import {
  addMemberWithRole,
  createTestOrg,
  createTestUser,
  TEST_USER_PASSWORD,
} from "./helpers/test-factory";

const hasDb = () => !!process.env.DATABASE_URL;

describe.skipIf(!hasDb())("Cursor pagination over real data (with DB)", () => {
  /** An org with `n` members (owner included), all created in sequence. */
  async function orgWithMembers(db: Parameters<typeof addMemberWithRole>[0], n: number) {
    const owner = await createTestUser(db);
    const org = await createTestOrg(db, { ownerId: owner.id });
    await addMemberWithRole(db, {
      organizationId: org.id,
      userId: owner.id,
      roleCode: "owner",
    });
    for (let i = 1; i < n; i++) {
      const u = await createTestUser(db);
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: u.id,
        roleCode: "viewer",
      });
    }
    return { owner, org };
  }

  /** Walks every page, returning the ids in order. */
  async function walk(
    db: Parameters<typeof addMemberWithRole>[0],
    orgId: string,
    limit: number,
  ): Promise<string[]> {
    const ids: string[] = [];
    let cursor = null as ReturnType<typeof decodeCursor>;
    for (let guard = 0; guard < 50; guard++) {
      const page = await listMembers(db, orgId, { limit, cursor });
      ids.push(...page.items.map((m) => m.id));
      if (!page.pageInfo.hasMore) return ids;
      cursor = decodeCursor(page.pageInfo.cursor as string);
      expect(cursor).not.toBeNull();
    }
    throw new Error("pagination did not terminate");
  }

  test("a full walk visits every row exactly once", async () => {
    await withTestDb(async ({ db }) => {
      const { org } = await orgWithMembers(db, 7);
      const ids = await walk(db, org.id, 3);
      expect(ids).toHaveLength(7);
      expect(new Set(ids).size).toBe(7);
    });
  });

  test("the walk order matches the unpaginated order", async () => {
    await withTestDb(async ({ db }) => {
      const { org } = await orgWithMembers(db, 6);
      const oneShot = (await listMembers(db, org.id, { limit: 100, cursor: null })).items.map(
        (m) => m.id,
      );
      const paged = await walk(db, org.id, 2);
      // Paging must not reorder anything — same sequence, just delivered in
      // chunks. A mismatch here is the classic keyset bug.
      expect(paged).toEqual(oneShot);
    });
  });

  test("rows that tie on the sort timestamp are not skipped at a page boundary", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db);
      const org = await createTestOrg(db, { ownerId: owner.id });
      // Force an exact created_at collision across the boundary: six members
      // sharing one timestamp, paged 2 at a time. Without the id tiebreaker in
      // the cursor, `> created_at` drops every tied row after the first page
      // and this returns 2 instead of 6.
      const users = [owner];
      for (let i = 0; i < 5; i++) users.push(await createTestUser(db));
      for (const u of users) {
        await addMemberWithRole(db, {
          organizationId: org.id,
          userId: u.id,
          roleCode: u.id === owner.id ? "owner" : "viewer",
        });
      }
      const { sql } = await import("drizzle-orm");
      await db.execute(
        sql`UPDATE organization_members SET created_at = '2026-01-01T00:00:00Z'
            WHERE organization_id = ${org.id}`,
      );

      const ids = await walk(db, org.id, 2);
      expect(ids).toHaveLength(6);
      expect(new Set(ids).size).toBe(6);
    });
  });

  test("a row inserted mid-walk does not shift the pages already read", async () => {
    await withTestDb(async ({ db }) => {
      const { org } = await orgWithMembers(db, 5);

      const first = await listMembers(db, org.id, { limit: 2, cursor: null });
      expect(first.items).toHaveLength(2);

      // Insert *before* the cursor position in ASC order by backdating it.
      // With OFFSET this would push a row across the boundary and the next
      // page would repeat one. With a keyset cursor the boundary is a value,
      // not a position, so page two is unaffected.
      const extra = await createTestUser(db);
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: extra.id,
        roleCode: "viewer",
      });
      const { sql } = await import("drizzle-orm");
      await db.execute(
        sql`UPDATE organization_members SET created_at = '2020-01-01T00:00:00Z'
            WHERE organization_id = ${org.id} AND user_id = ${extra.id}`,
      );

      const second = await listMembers(db, org.id, {
        limit: 2,
        cursor: decodeCursor(first.pageInfo.cursor as string),
      });
      const overlap = second.items.filter((m) => first.items.some((f) => f.id === m.id));
      expect(overlap).toHaveLength(0);
    });
  });

  test("the last page reports hasMore false and a null cursor", async () => {
    await withTestDb(async ({ db }) => {
      const { org } = await orgWithMembers(db, 3);
      const page = await listMembers(db, org.id, { limit: 10, cursor: null });
      expect(page.items).toHaveLength(3);
      expect(page.pageInfo.hasMore).toBe(false);
      // A client that keeps paging should stop, not loop on the final key.
      expect(page.pageInfo.cursor).toBeNull();
    });
  });

  test("an exactly-full page still reports hasMore correctly", async () => {
    await withTestDb(async ({ db }) => {
      const { org } = await orgWithMembers(db, 4);
      // Off-by-one guard: 4 rows at limit 4 must not claim a further page.
      const page = await listMembers(db, org.id, { limit: 4, cursor: null });
      expect(page.items).toHaveLength(4);
      expect(page.pageInfo.hasMore).toBe(false);
      expect(page.pageInfo.cursor).toBeNull();
    });
  });
});

describe.skipIf(!hasDb())("Pagination over HTTP (with DB)", () => {
  async function ownerCookie(app: ReturnType<typeof createTestApp>, db: any) {
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

  test("the member list returns meta.pagination and honours ?limit", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { org, cookie } = await ownerCookie(app, db);
      for (let i = 0; i < 4; i++) {
        const u = await createTestUser(db);
        await addMemberWithRole(db, {
          organizationId: org.id,
          userId: u.id,
          roleCode: "viewer",
        });
      }

      const res = await app.request(`/api/orgs/${org.id}/members?limit=2`, {
        headers: { cookie },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { members: unknown[] };
        meta: { pagination: { cursor: string | null; hasMore: boolean } };
      };
      expect(body.data.members).toHaveLength(2);
      expect(body.meta.pagination.hasMore).toBe(true);
      expect(typeof body.meta.pagination.cursor).toBe("string");
    });
  });

  test("the returned cursor fetches the next page over HTTP", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { org, cookie } = await ownerCookie(app, db);
      for (let i = 0; i < 3; i++) {
        const u = await createTestUser(db);
        await addMemberWithRole(db, {
          organizationId: org.id,
          userId: u.id,
          roleCode: "viewer",
        });
      }

      const first = (await (
        await app.request(`/api/orgs/${org.id}/members?limit=2`, { headers: { cookie } })
      ).json()) as any;
      const second = (await (
        await app.request(
          `/api/orgs/${org.id}/members?limit=2&cursor=${encodeURIComponent(first.meta.pagination.cursor)}`,
          { headers: { cookie } },
        )
      ).json()) as any;

      const firstIds = first.data.members.map((m: any) => m.id);
      const secondIds = second.data.members.map((m: any) => m.id);
      expect(secondIds.some((id: string) => firstIds.includes(id))).toBe(false);
    });
  });

  test("bad ?limit values are 422, not silently clamped", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { org, cookie } = await ownerCookie(app, db);
      // Silently returning 100 for limit=1000 hides a client's misunderstanding
      // of the contract; the API Reference publishes the max, so say so.
      for (const bad of ["0", "-1", "1000", "abc", "1.5", ""]) {
        const res = await app.request(`/api/orgs/${org.id}/members?limit=${bad}`, {
          headers: { cookie },
        });
        expect(res.status).toBe(422);
      }
    });
  });

  test("a forged or corrupt cursor is 422 — it never reaches the query", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { org, cookie } = await ownerCookie(app, db);
      const forged = [
        "not-base64!!",
        Buffer.from('{"v":"x"}').toString("base64url"), // no id
        Buffer.from('{"id":"not-a-uuid","v":"2026-01-01"}').toString("base64url"),
        Buffer.from('{"v":"2026-01-01T00:00:00Z","id":"1 OR 1=1"}').toString("base64url"),
        Buffer.from("[]").toString("base64url"),
      ];
      for (const cursor of forged) {
        const res = await app.request(
          `/api/orgs/${org.id}/members?cursor=${encodeURIComponent(cursor)}`,
          { headers: { cookie } },
        );
        expect(res.status).toBe(422);
        const text = await res.text();
        // A driver error here would mean the forged value reached Postgres.
        expect(text).not.toContain("invalid input syntax");
        expect(text).not.toContain("22P02");
      }
    });
  });

  test("paging never leaks rows from another org", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { org, cookie } = await ownerCookie(app, db);
      const mine: string[] = [];
      for (let i = 0; i < 5; i++) {
        const u = await createTestUser(db);
        const m = await addMemberWithRole(db, {
          organizationId: org.id,
          userId: u.id,
          roleCode: "viewer",
        });
        mine.push((m as any)?.id ?? u.id);
      }

      // A second org whose members interleave in created_at with the first.
      // The tenant filter has to be applied *with* the cursor predicate; if the
      // cursor were the only WHERE clause, page two would spill across orgs.
      const otherOwner = await createTestUser(db);
      const otherOrg = await createTestOrg(db, { ownerId: otherOwner.id });
      await addMemberWithRole(db, {
        organizationId: otherOrg.id,
        userId: otherOwner.id,
        roleCode: "owner",
      });
      for (let i = 0; i < 5; i++) {
        const u = await createTestUser(db);
        await addMemberWithRole(db, {
          organizationId: otherOrg.id,
          userId: u.id,
          roleCode: "viewer",
        });
      }

      const seen: string[] = [];
      let cursor: string | null = null;
      for (let guard = 0; guard < 20; guard++) {
        const qs = `limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
        const body = (await (
          await app.request(`/api/orgs/${org.id}/members?${qs}`, { headers: { cookie } })
        ).json()) as any;
        seen.push(...body.data.members.map((m: any) => m.userId ?? m.user_id));
        if (!body.meta.pagination.hasMore) break;
        cursor = body.meta.pagination.cursor;
      }

      // 5 added + the owner, and nothing belonging to the other org.
      expect(seen).toHaveLength(6);
      const otherMembers = await listMembers(db, otherOrg.id, { limit: 100, cursor: null });
      const otherUserIds = new Set(otherMembers.items.map((m: any) => m.userId ?? m.user_id));
      expect(seen.filter((id) => otherUserIds.has(id))).toHaveLength(0);
    });
  });

  test("paging another org's members is still refused", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { cookie } = await ownerCookie(app, db);
      const outsider = await createTestUser(db);
      const foreign = await createTestOrg(db, { ownerId: outsider.id });
      await addMemberWithRole(db, {
        organizationId: foreign.id,
        userId: outsider.id,
        roleCode: "owner",
      });

      // Pagination params must not open a side door around the org guard.
      const res = await app.request(`/api/orgs/${foreign.id}/members?limit=100`, {
        headers: { cookie },
      });
      expect([403, 404]).toContain(res.status);
    });
  });

  test("the default page size applies when ?limit is absent", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { org, cookie } = await ownerCookie(app, db);
      const res = await app.request(`/api/orgs/${org.id}/members`, { headers: { cookie } });
      const body = (await res.json()) as any;
      expect(body.data.members.length).toBeLessThanOrEqual(DEFAULT_PAGE_SIZE);
      expect(body.meta.pagination).toBeDefined();
    });
  });

  test("every paginated list endpoint reports meta.pagination", async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { org, cookie } = await ownerCookie(app, db);
      // All four surfaces F-14 named must answer in the same shape, so a client
      // can page any of them with one code path.
      for (const path of [
        `/api/orgs/${org.id}/members`,
        "/api/users/admin",
        "/api/auth/sessions",
        "/api/api-keys",
      ]) {
        const res = await app.request(path, { headers: { cookie } });
        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.meta?.pagination).toBeDefined();
        expect(typeof body.meta.pagination.hasMore).toBe("boolean");
      }
    });
  });

  test('"revoke all other sessions" is not limited by the page size', async () => {
    await withTestDb(async ({ db }) => {
      const app = createTestApp(db);
      const { user, cookie } = await ownerCookie(app, db);

      // 25 live sessions — more than DEFAULT_PAGE_SIZE. If the revoke path
      // iterated the paginated list it would stop at 20 and leave sessions
      // alive, which is a security action quietly doing part of its job.
      const { createSession } = await import("../services/auth/session");
      for (let i = 0; i < 25; i++) {
        await createSession(db, crypto.randomUUID(), user.id, `hash-${crypto.randomUUID()}`, false);
      }

      const res = await app.request("/api/auth/sessions/revoke-others", {
        method: "DELETE",
        headers: { cookie, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { revokedCount: number } };
      expect(body.data.revokedCount).toBeGreaterThan(DEFAULT_PAGE_SIZE);

      const { listAllLiveSessionIds } = await import("../services/auth/session");
      expect(await listAllLiveSessionIds(db, user.id)).toHaveLength(0);
    });
  });
});

describe("Pagination helpers — no DB needed", () => {
  test("cursors round-trip", () => {
    const payload = { v: "2026-09-21T10:00:00.000000+00", id: crypto.randomUUID() };
    expect(decodeCursor(encodeCursor(payload))).toEqual(payload);
  });

  test("cursors are opaque base64url — no padding, URL-safe", () => {
    const encoded = encodeCursor({ v: "2026-09-21T10:00:00Z", id: crypto.randomUUID() });
    // §2.6 tells clients to treat cursors as opaque; they must also survive a
    // query string without escaping.
    expect(encoded).not.toContain("=");
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encodeURIComponent(encoded)).toBe(encoded);
  });

  test("malformed cursors decode to null rather than throwing", () => {
    for (const bad of [
      "",
      "!!!",
      Buffer.from("not json").toString("base64url"),
      Buffer.from("null").toString("base64url"),
      Buffer.from("[]").toString("base64url"),
      Buffer.from('{"v":"x"}').toString("base64url"),
      Buffer.from('{"id":"x"}').toString("base64url"),
      Buffer.from('{"v":"","id":"3f2504e0-4f89-11d3-9a0c-0305e82c3301"}').toString("base64url"),
      Buffer.from('{"v":"x","id":"nope"}').toString("base64url"),
      Buffer.from(
        `{"v":"${"x".repeat(200)}","id":"3f2504e0-4f89-11d3-9a0c-0305e82c3301"}`,
      ).toString("base64url"),
    ]) {
      expect(decodeCursor(bad)).toBeNull();
    }
  });

  test("parsePagination defaults, accepts and rejects", () => {
    const base = "https://api.test/x";
    expect(parsePagination(new URL(base)).limit).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePagination(new URL(`${base}?limit=5`)).limit).toBe(5);
    expect(parsePagination(new URL(`${base}?limit=${MAX_PAGE_SIZE}`)).limit).toBe(MAX_PAGE_SIZE);
    for (const bad of ["0", "-3", "abc", "2.5", `${MAX_PAGE_SIZE + 1}`, "1e3"]) {
      expect(() => parsePagination(new URL(`${base}?limit=${bad}`))).toThrow();
    }
    expect(() => parsePagination(new URL(`${base}?cursor=garbage!`))).toThrow();
  });

  test("buildPage trims the probe row and only then reports hasMore", () => {
    // Real uuids: decodeCursor shape-validates the id, so a placeholder like
    // "id-3" would be rejected and mask what this test is checking.
    const rows: { id: string; v: string }[] = [1, 2, 3, 4].map((n) => ({
      id: crypto.randomUUID(),
      v: `v${n}`,
    }));
    const thirdId = rows[2]?.id ?? "";
    const full = buildPage(rows, 3, (r) => r.v);
    expect(full.items).toHaveLength(3);
    expect(full.pageInfo.hasMore).toBe(true);
    expect(decodeCursor(full.pageInfo.cursor as string)).toEqual({ v: "v3", id: thirdId });

    const short = buildPage(rows.slice(0, 2), 3, (r) => r.v);
    expect(short.items).toHaveLength(2);
    expect(short.pageInfo.hasMore).toBe(false);
    expect(short.pageInfo.cursor).toBeNull();

    const empty = buildPage([] as { id: string; v: string }[], 3, (r) => r.v);
    expect(empty.items).toHaveLength(0);
    expect(empty.pageInfo.hasMore).toBe(false);
    expect(empty.pageInfo.cursor).toBeNull();
  });
});
