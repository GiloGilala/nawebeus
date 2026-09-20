import { describe, expect, test } from "bun:test";
import { ForbiddenError } from "../../lib/errors";
import {
  assertMemberActionAllowed,
  assertRoleChangeAllowed,
  NO_ROLE,
  ORG_ROLE_CODES,
  ROLE_LEVELS,
  type RoleCode,
} from "../../services/orgs/role-policy";

/**
 * The role hierarchy matrix (DEC-039), exercised without a database.
 * Integration coverage of the same rules through the HTTP routes lives in
 * role-assignment.test.ts; this file pins the pure decision table so a
 * change to any rule shows up as an exact cell flipping.
 */

const who = (code: RoleCode, userId = `user-${code}`) => ({
  userId,
  code,
  level: ROLE_LEVELS[code],
});
const role = (code: RoleCode) => ({ code, level: ROLE_LEVELS[code] });

const allowed = (fn: () => void) => {
  expect(fn).not.toThrow();
};
const forbidden = (fn: () => void, message?: RegExp) => {
  expect(fn).toThrow(ForbiddenError);
  if (message) expect(fn).toThrow(message);
};

describe("role-policy — role change matrix (spec 'Who Can Assign' table)", () => {
  // Rows: actor; columns: role being granted (to a Viewer, so the target's
  // current rank never interferes). Mirrors the module spec table:
  //   Admin ← Owner only; Manager ← Owner, Admin; Creator/Analyst/Viewer ← Owner, Admin, Manager.
  const table: Record<RoleCode, Partial<Record<RoleCode, boolean>>> = {
    super_admin: { admin: true, manager: true, creator: true, analyst: true, viewer: true },
    owner: { admin: true, manager: true, creator: true, analyst: true, viewer: true },
    admin: { admin: false, manager: true, creator: true, analyst: true, viewer: true },
    manager: { admin: false, manager: false, creator: true, analyst: true, viewer: true },
    creator: { admin: false, manager: false, creator: false, analyst: true, viewer: true },
    analyst: { admin: false, manager: false, creator: false, analyst: false, viewer: true },
    viewer: { admin: false, manager: false, creator: false, analyst: false, viewer: false },
  };

  for (const [actorCode, grants] of Object.entries(table) as Array<
    [RoleCode, Partial<Record<RoleCode, boolean>>]
  >) {
    for (const [newCode, expected] of Object.entries(grants) as Array<[RoleCode, boolean]>) {
      test(`${actorCode} granting ${newCode} to a viewer → ${expected ? "allowed" : "403"}`, () => {
        const check = () =>
          assertRoleChangeAllowed({
            actor: who(actorCode),
            target: { ...who("viewer"), level: ROLE_LEVELS.viewer - 1 }, // rank below viewer so viewer→viewer isn't a no-op
            newRole: role(newCode),
          });
        if (expected) allowed(check);
        else forbidden(check);
      });
    }
  }

  test("the Owner role is never granted, not even by the Owner (BR-AUTH-031)", () => {
    for (const actorCode of ["super_admin", "owner", "admin"] as const) {
      forbidden(
        () =>
          assertRoleChangeAllowed({
            actor: who(actorCode),
            target: who("admin"),
            newRole: role("owner"),
          }),
        /transferred, not granted/,
      );
    }
  });

  test("the Owner's own role is never changed, whoever asks (BR-AUTH-031)", () => {
    for (const actorCode of ["super_admin", "owner", "admin", "manager"] as const) {
      forbidden(
        () =>
          assertRoleChangeAllowed({
            actor: who(actorCode),
            target: who("owner"),
            newRole: role("viewer"),
          }),
        /Owner's role cannot be changed/,
      );
    }
  });

  test("nobody changes their own role (§6.3 'Cannot demote self')", () => {
    for (const code of ORG_ROLE_CODES) {
      if (code === "owner") continue; // already covered by the Owner rule
      forbidden(
        () =>
          assertRoleChangeAllowed({
            actor: who(code, "same-user"),
            target: who(code, "same-user"),
            newRole: role("viewer"),
          }),
        /your own role/,
      );
    }
  });

  test("peers and superiors are out of reach: admin cannot demote another admin", () => {
    forbidden(
      () =>
        assertRoleChangeAllowed({
          actor: who("admin", "admin-1"),
          target: who("admin", "admin-2"),
          newRole: role("viewer"),
        }),
      /below your own role/,
    );
    forbidden(() =>
      assertRoleChangeAllowed({
        actor: who("manager"),
        target: who("admin"),
        newRole: role("viewer"),
      }),
    );
  });

  test("a member with no role yet can be given any role below the actor", () => {
    allowed(() =>
      assertRoleChangeAllowed({
        actor: who("manager"),
        target: { userId: "invitee", ...NO_ROLE },
        newRole: role("creator"),
      }),
    );
    forbidden(() =>
      assertRoleChangeAllowed({
        actor: who("manager"),
        target: { userId: "invitee", ...NO_ROLE },
        newRole: role("manager"),
      }),
    );
  });
});

describe("role-policy — member actions (remove / suspend)", () => {
  test("the Owner is never removed or suspended", () => {
    for (const actorCode of ["super_admin", "owner", "admin"] as const) {
      forbidden(
        () => assertMemberActionAllowed({ actor: who(actorCode), target: who("owner") }),
        /Owner cannot be removed/,
      );
    }
  });

  test("nobody removes or suspends themselves (§6.3 'Cannot suspend self')", () => {
    forbidden(
      () =>
        assertMemberActionAllowed({
          actor: who("admin", "same"),
          target: who("admin", "same"),
        }),
      /yourself/,
    );
  });

  test("only members strictly below the actor can be acted on", () => {
    allowed(() => assertMemberActionAllowed({ actor: who("admin"), target: who("manager") }));
    allowed(() => assertMemberActionAllowed({ actor: who("manager"), target: who("creator") }));
    forbidden(() =>
      assertMemberActionAllowed({ actor: who("manager"), target: who("manager", "other") }),
    );
    forbidden(() => assertMemberActionAllowed({ actor: who("manager"), target: who("admin") }));
    // creator (40) outranks viewer (10), so the pure rank rule allows it — a
    // creator is stopped one layer up, by the route's members.delete ability
    // check (creators don't hold it; see the seed matrix test).
    allowed(() => assertMemberActionAllowed({ actor: who("creator"), target: who("viewer") }));
  });
});
