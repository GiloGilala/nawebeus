/**
 * Impersonation ability stripping (NWB-P1-011, BR-ADMIN-009) — pure unit test, no DB.
 *
 * The deny-list is a security control; this pins its exact shape so "one more
 * subject won't hurt" cannot silently widen it.
 */

import { describe, expect, test } from "bun:test";
import { type Ability, AbilityBuilder, createMongoAbility } from "@casl/ability";
import type { Actions } from "../../services/auth/ability";
import { impersonationAbility } from "../../services/impersonation";

function abilityOf(pairs: [Actions, string][]): Ability<[Actions, string]> {
  const { can, build } = new AbilityBuilder<Ability<[Actions, string]>>(createMongoAbility);
  for (const [action, subject] of pairs) can(action, subject);
  return build();
}

describe("impersonationAbility — the BR-ADMIN-009 deny-list", () => {
  test("strips billing entirely, org.delete, team writes, and nested impersonation", () => {
    // An owner-target's full ability, shaped like `loadAbility` builds it — one rule per
    // permission string, never a `manage` wildcard: the session inherits it minus the
    // deny-list.
    const owner = abilityOf([
      ["update", "org"],
      ["delete", "org"],
      ["update", "billing"],
      ["read", "billing"],
      ["create", "roles"],
      ["update", "roles"],
      ["delete", "roles"],
      ["create", "members"],
      ["update", "members"],
      ["delete", "members"],
      ["impersonate", "users"],
      ["read", "users"],
      ["create", "posts"],
    ]);

    const impersonated = impersonationAbility(owner);

    // Denied: the module spec's three abuses, plus chaining.
    expect(impersonated.can("delete", "org")).toBe(false);
    expect(impersonated.can("update", "billing")).toBe(false);
    expect(impersonated.can("read", "billing")).toBe(false);
    expect(impersonated.can("create", "roles")).toBe(false);
    expect(impersonated.can("update", "roles")).toBe(false);
    expect(impersonated.can("delete", "roles")).toBe(false);
    expect(impersonated.can("create", "members")).toBe(false);
    expect(impersonated.can("update", "members")).toBe(false);
    expect(impersonated.can("delete", "members")).toBe(false);
    expect(impersonated.can("impersonate", "users")).toBe(false);

    // Survivors: everything an owner-target could legitimately do in the product.
    expect(impersonated.can("read", "users")).toBe(true);
    expect(impersonated.can("create", "posts")).toBe(true);
    // org survives minus delete — support renames settings, it does not raze tenants.
    expect(impersonated.can("update", "org")).toBe(true);
  });

  test("a `manage` wildcard on a denied subject is stripped wholesale (it implies every verb)", () => {
    const platform = abilityOf([
      ["manage", "billing"],
      ["manage", "posts"],
    ]);
    const impersonated = impersonationAbility(platform);
    expect(impersonated.can("read", "billing")).toBe(false);
    expect(impersonated.can("update", "billing")).toBe(false);
    expect(impersonated.can("read", "posts")).toBe(true);
  });

  test("a target who never had a power still has none (impersonation grants nothing)", () => {
    const viewer = abilityOf([
      ["read", "analytics"],
      ["read", "posts"],
    ]);
    const impersonated = impersonationAbility(viewer);
    expect(impersonated.can("read", "analytics")).toBe(true);
    expect(impersonated.can("update", "org")).toBe(false);
    expect(impersonated.can("delete", "posts")).toBe(false);
  });
});
