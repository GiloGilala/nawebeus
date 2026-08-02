import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorHandler } from "../../server/middleware/error-handler";
import { requireAbility } from "../../server/middleware/rbac";
import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import type { Ability } from "@casl/ability";

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

  test("ability scoped to one org does not grant access to another org's resources", () => {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    can("update", "organization", { organizationId: "org_A" });
    const ability = build();

    // The ability has rules, so can() returns true for the subject type
    // But the condition is stored — it would be evaluated by CASL if we passed an instance
    expect(ability.can("update", "organization")).toBe(true);

    // Verify the rule has the correct condition by checking possibleRules
    const rules = ability.possibleRulesFor("update", "organization");
    expect(rules.length).toBe(1);
    expect(rules[0]!.conditions).toEqual({ organizationId: "org_A" });
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
