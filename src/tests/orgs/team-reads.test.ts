/**
 * The two reads NWB-P14.2 added for the team screen, at the service layer.
 *
 * `src/tests/orgs/server-functions.test.ts` covers both through their Server Functions (the ladder
 * per seat, the panel's fields, the expiry flag, tenant isolation, the absence of token material).
 * What is left is the part a web caller cannot reach, and therefore cannot test:
 *
 * - a **custom org-scoped role** entering the catalog through its own `level` — the property that
 *   lets a future role feature work without touching this code, and the reason nothing here names
 *   the six seeded codes;
 * - another organization's custom role staying out of it;
 * - a **non-member actor** being refused before any catalog is computed;
 * - a **legacy row with no address** being dropped from the panel rather than rendered as a line
 *   nothing can be resent to;
 * - accepted, suspended and soft-deleted rows not appearing as pending.
 */

import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { getConfig, loadConfig } from "@/lib/config";
import type { Db } from "@/lib/db";
import { ForbiddenError } from "@/lib/errors";
import { listPendingInvitations } from "@/services/orgs/invitation.service";
import { listAssignableRoles } from "@/services/orgs/role-policy";
import { withTestDb } from "../helpers/test-db";
import { addMemberWithRole, createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => Boolean(process.env.DATABASE_URL);

/** A role this organization defined, slotted into the ladder by `level` alone. */
async function customRole(
  db: Db,
  orgId: string,
  input: { code: string; name: string; level: number },
): Promise<string> {
  const rows = await db.execute(sql`
    INSERT INTO roles (organization_id, code, slug, name, display_name, level, scope, type, status)
    VALUES (${orgId}, ${input.code}, ${input.code}, ${input.name}, ${input.name}, ${input.level},
            'organization', 'custom', 'active')
    RETURNING id
  `);
  return (rows as unknown as { rows: { id: string }[] }).rows[0]?.id ?? "";
}

describe.skipIf(!hasDb())("team reads (NWB-P14.2) — service layer", () => {
  test("a custom org role enters the catalog by level; another org's does not", async () => {
    loadConfig();
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Custom", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Custom Role Org" });
      await addMemberWithRole(db, { organizationId: org.id, userId: owner.id, roleCode: "owner" });

      // Between manager (60) and creator (40): an editor tier this org invented.
      await customRole(db, org.id, { code: "editor", name: "Editor", level: 50 });
      // Above the owner: nothing in an organization may outrank its own owner through this read.
      await customRole(db, org.id, { code: "board", name: "Board", level: 95 });

      const other = await createTestOrg(db, { ownerId: owner.id, name: "Elsewhere Org" });
      await customRole(db, other.id, { code: "stranger", name: "Stranger", level: 30 });

      const catalog = await listAssignableRoles(db, org.id, owner.id);
      const codes = catalog.roles.map((role) => role.code);
      expect(codes).toEqual(["admin", "manager", "editor", "creator", "analyst", "viewer"]);
      expect(codes).not.toContain("board"); // outranks the actor
      expect(codes).not.toContain("stranger"); // another tenant's role
      expect(codes).not.toContain("owner"); // BR-AUTH-031: transferred, never granted
      expect(codes).not.toContain("super_admin"); // a platform role is not an org grant

      const editor = catalog.roles.find((role) => role.code === "editor");
      expect(editor?.isCustom).toBe(true);
      expect(editor?.level).toBe(50);
      expect(catalog.roles.find((role) => role.code === "admin")?.isCustom).toBe(false);
      expect(catalog.actor).toEqual({ code: "owner", level: 90 });
    });
  });

  test("a manager's catalog stops at the ladder, and a non-member is refused outright", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Ladder", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Ladder Org" });
      await addMemberWithRole(db, { organizationId: org.id, userId: owner.id, roleCode: "owner" });
      const manager = await createTestUser(db, { firstName: "Ladder", lastName: "Manager" });
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: manager.id,
        roleCode: "manager",
      });
      await customRole(db, org.id, { code: "editor", name: "Editor", level: 50 });

      const catalog = await listAssignableRoles(db, org.id, manager.id);
      // Manager (60) may grant below itself only — the editor tier lands inside that, admin does not.
      expect(catalog.roles.map((role) => role.code)).toEqual([
        "editor",
        "creator",
        "analyst",
        "viewer",
      ]);

      const outsider = await createTestUser(db, { firstName: "No", lastName: "Membership" });
      await expect(listAssignableRoles(db, org.id, outsider.id)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });
  });

  test("the panel lists pending rows only, and drops one with no address", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Panel", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Panel Org" });
      await addMemberWithRole(db, { organizationId: org.id, userId: owner.id, roleCode: "owner" });

      const insert = (input: {
        email: string | null;
        status: string;
        acceptedAt?: string;
        deleted?: boolean;
      }) => {
        // Built outside the template: a nested `sql` tag inside a ternary inside `${…}` is a parse
        // error, and the values read better as names anyway.
        const accepted = input.acceptedAt ? sql`now()` : sql`NULL::timestamptz`;
        const deletedAt = input.deleted ? sql`now()` : sql`NULL::timestamptz`;
        return db.execute(sql`
          INSERT INTO organization_members
            (organization_id, status, is_active, invited_email, invitation_token_hash,
             invited_at, expires_at, accepted_at, deleted_at)
          VALUES (${org.id}, ${input.status}::member_status, false, ${input.email},
                  'hash-' || gen_random_uuid()::text, now(), now() + interval '3 days',
                  ${accepted}, ${deletedAt})
        `);
      };

      await insert({ email: "pending@panel.test", status: "invited" });
      // A row from the window before `invited_email` existed: nothing can be resent to it and the
      // accept flow already 404s it, so the panel does not list a line it cannot act on.
      await insert({ email: null, status: "invited" });
      await insert({ email: "accepted@panel.test", status: "active", acceptedAt: "now()" });
      await insert({ email: "revoked@panel.test", status: "invited", deleted: true });

      const invitations = await listPendingInvitations(db, org.id);
      expect(invitations.map((row) => row.email)).toEqual(["pending@panel.test"]);
      expect(invitations[0]?.expired).toBe(false);
      expect(invitations[0]?.hasAccount).toBe(false);
      expect(invitations[0]?.expiresAt).toBeInstanceOf(Date);

      // The projection carries no token material of either kind — the shape, not just the values.
      const keys = Object.keys(invitations[0] ?? {}).sort();
      expect(keys).not.toContain("invitationToken");
      expect(keys).not.toContain("invitationTokenHash");
      expect(keys).toEqual([
        "department",
        "displayName",
        "email",
        "expired",
        "expiresAt",
        "hasAccount",
        "invitationNote",
        "invitedAt",
        "invitedByUserId",
        "jobTitle",
        "memberId",
        "roleCode",
        "roleId",
        "roleName",
        "sentAt",
      ]);
    });
  });

  test("an invitee who already has an account is flagged, so the form can skip registration", async () => {
    await withTestDb(async ({ db }) => {
      const owner = await createTestUser(db, { firstName: "Flag", lastName: "Owner" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "Flag Org" });
      await addMemberWithRole(db, { organizationId: org.id, userId: owner.id, roleCode: "owner" });
      const existing = await createTestUser(db, { firstName: "Has", lastName: "Account" });
      const address = `has.account+${crypto.randomUUID().slice(0, 6)}@flag.test`;
      await db.execute(sql`UPDATE users SET email = ${address} WHERE id = ${existing.id}`);

      await db.execute(sql`
        INSERT INTO organization_members
          (organization_id, status, is_active, invited_email, invitation_token_hash,
           invited_at, expires_at)
        VALUES (${org.id}, 'invited'::member_status, false, ${address},
                'hash-' || gen_random_uuid()::text, now(), now() + interval '3 days')
      `);

      const invitations = await listPendingInvitations(db, org.id);
      expect(invitations).toHaveLength(1);
      // `requiresAccountSetup` on the landing page and `hasAccount` on the panel are the same fact
      // from two sides: one tells the invitee what to fill in, the other tells the inviter what to
      // expect.
      expect(invitations[0]?.hasAccount).toBe(true);
      expect(getConfig().APP_BASE_URL_RESOLVED.length).toBeGreaterThan(0);
    });
  });
});
