import { describe, expect, test } from "bun:test";
import type { Ability } from "@casl/ability";
import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorHandler } from "../../server/middleware/error-handler";
import { requireAbility } from "../../server/middleware/rbac";
import { withTestDb } from "../helpers/test-db";
import { addMemberWithRole, createTestOrg, createTestUser } from "../helpers/test-factory";

type Actions = "create" | "read" | "update" | "delete" | "manage";
type Subjects = string;
type AppAbility = Ability<[Actions, Subjects]>;

describe("CASL ability scoping — no DB needed", () => {
  test("ability with org condition still allows the subject when checked without conditions", () => {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    can("update", "organization", { organizationId: "org_A" });
    const ability = build();

    // requireAbility calls ability.can(action, subject) — two args
    // This passes because there IS a rule for update+organization
    expect(ability.can("update", "organization")).toBe(true);
  });

  test("ability with no rules denies all actions", () => {
    const { build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    const ability = build();

    expect(ability.can("update", "organization")).toBe(false);
    expect(ability.can("manage", "users")).toBe(false);
    expect(ability.can("read", "posts")).toBe(false);
  });

  test("CASL v7 trap, pinned: a condition on a rule cannot deny a string-subject check", () => {
    // This is the whole reason `loadAbility` carries no `{ organizationId }`
    // condition (NWB-P0-018, F-06). The rule below is scoped to org_A, and yet
    // a bare string check — which is what `requireAbility` does — passes. A
    // condition attached to a rule is only ever evaluated against a subject
    // *instance*, so as long as every call site passes a string, conditions are
    // decorative. If a future CASL upgrade changes this, this test goes red and
    // the decision can be revisited deliberately instead of by accident.
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    can("update", "org", { organizationId: "org_A" });
    const ability = build();

    expect(ability.can("update", "org")).toBe(true);

    // The condition is stored on the rule; it simply never runs for a string subject.
    const rules = ability.possibleRulesFor("update", "org");
    expect(rules.length).toBe(1);
    expect(rules[0]!.conditions).toEqual({ organizationId: "org_A" });

    // Evaluated against an instance it *would* discriminate — proving the
    // condition is well-formed and that the gap is the call shape, not the rule.
    expect(
      ability.can("update", { constructor: { name: "org" }, organizationId: "org_B" } as any),
    ).toBe(false);
  });

  test("requireAbility rejects when ability has no matching rule", async () => {
    const { build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    const ability = build();

    const app = new Hono();
    app.use("*", cors());
    app.onError(errorHandler);

    app.get(
      "/api/admin",
      (c, next) => {
        c.set("ability", ability);
        return next();
      },
      requireAbility("manage", "users"),
      (c) => c.json({ ok: true }),
    );

    const res = await app.request("/api/admin");
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
  });

  test("requireAbility passes when ability has matching rule", async () => {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    can("read", "posts");
    const ability = build();

    const app = new Hono();
    app.use("*", cors());
    app.onError(errorHandler);

    app.get(
      "/api/posts",
      (c, next) => {
        c.set("ability", ability);
        return next();
      },
      requireAbility("read", "posts"),
      (c) => c.json({ ok: true }),
    );

    const res = await app.request("/api/posts");
    expect(res.status).toBe(200);
  });

  test("requireAbility rejects wrong action even with correct subject", async () => {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    can("read", "posts");
    const ability = build();

    const app = new Hono();
    app.use("*", cors());
    app.onError(errorHandler);

    app.get(
      "/api/posts",
      (c, next) => {
        c.set("ability", ability);
        return next();
      },
      requireAbility("delete", "posts"),
      (c) => c.json({ ok: true }),
    );

    const res = await app.request("/api/posts");
    expect(res.status).toBe(403);
  });
});

const hasDb = () => !!process.env.DATABASE_URL;

describe.skipIf(!hasDb())(
  "loadAbility — org scoping is the query, not a condition (with DB)",
  () => {
    test("rules carry no conditions: the scoping mechanism is the per-(user, org) load", async () => {
      await withTestDb(async ({ db }) => {
        const { loadAbility } = await import("../../services/auth/ability");

        const owner = await createTestUser(db);
        const org = await createTestOrg(db, { ownerId: owner.id });
        await addMemberWithRole(db, {
          organizationId: org.id,
          userId: owner.id,
          roleCode: "admin",
        });

        const ability = await loadAbility(db, owner.id, org.id);

        expect(ability.rules.length).toBeGreaterThan(0);
        // NWB-P0-018: not one rule may carry the inert `{ organizationId }`
        // condition. If a future change re-adds it, this fails loudly rather
        // than quietly restoring a guard that cannot guard.
        const withConditions = ability.rules.filter((r) => r.conditions !== undefined);
        expect(withConditions).toEqual([]);
      });
    });

    test("a member of org A loads an empty ability for org B", async () => {
      await withTestDb(async ({ db }) => {
        const { loadAbility } = await import("../../services/auth/ability");

        const userA = await createTestUser(db);
        const orgA = await createTestOrg(db, { ownerId: userA.id });
        await addMemberWithRole(db, {
          organizationId: orgA.id,
          userId: userA.id,
          roleCode: "admin",
        });

        const userB = await createTestUser(db);
        const orgB = await createTestOrg(db, { ownerId: userB.id });
        await addMemberWithRole(db, {
          organizationId: orgB.id,
          userId: userB.id,
          roleCode: "admin",
        });

        const inOwnOrg = await loadAbility(db, userA.id, orgA.id);
        expect(inOwnOrg.can("read", "users")).toBe(true);

        // No membership in org B ⇒ no rows ⇒ no rules ⇒ every check denies.
        const inForeignOrg = await loadAbility(db, userA.id, orgB.id);
        expect(inForeignOrg.rules).toEqual([]);
        expect(inForeignOrg.can("read", "users")).toBe(false);
        expect(inForeignOrg.can("update", "org")).toBe(false);
      });
    });

    test("an inactive membership grants nothing, in its own org", async () => {
      await withTestDb(async ({ db }) => {
        const { loadAbility } = await import("../../services/auth/ability");

        const owner = await createTestUser(db);
        const org = await createTestOrg(db, { ownerId: owner.id });
        const member = await createTestUser(db);
        await addMemberWithRole(db, {
          organizationId: org.id,
          userId: member.id,
          roleCode: "admin",
          status: "suspended",
        });

        const ability = await loadAbility(db, member.id, org.id);
        expect(ability.rules).toEqual([]);
        expect(ability.can("read", "users")).toBe(false);
      });
    });
  },
);
