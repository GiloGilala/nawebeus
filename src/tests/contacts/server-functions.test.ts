/**
 * TanStack Start Server Functions Tests for Contacts (NWB-P1-007).
 *
 * Tests in-process execution:
 * - createContactServerFn
 * - listContactsServerFn
 * - getContactServerFn
 * - updateContactServerFn
 * - deleteContactServerFn
 * - mergeContactsServerFn
 * - createInteractionServerFn
 * - listInteractionsServerFn
 * - completeFollowUpServerFn
 */

import { describe, expect, test } from "bun:test";
import {
  completeFollowUpServerFn,
  createContactServerFn,
  createInteractionServerFn,
  deleteContactServerFn,
  getContactServerFn,
  listContactsServerFn,
  listInteractionsServerFn,
  mergeContactsServerFn,
  updateContactServerFn,
} from "@/app/server-functions";
import {
  clearServerDbForTest,
  clearServerHeadersForTest,
  setServerDbForTest,
  setServerHeadersForTest,
} from "@/app/server-functions/helpers";
import { getConfig } from "@/lib/config";
import { createTestDb } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { signAccessToken } from "@/services/auth/jwt";
import { ensureContactsSchema } from "../helpers/test-db";
import { addMemberWithRole, createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => Boolean(process.env.DATABASE_URL);

describe("Contact Server Functions — Validation (No DB)", () => {
  test("createContactServerFn with invalid kind throws ValidationError", async () => {
    try {
      await createContactServerFn({
        data: {
          fullName: "Invalid Contact",
          kind: "unsupported_kind" as any,
        },
      });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
    }
  });

  test("getContactServerFn with invalid ID pattern throws ValidationError", async () => {
    try {
      await getContactServerFn({ data: { id: "not_a_valid_id" } });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
    }
  });

  test("createInteractionServerFn with missing contactId throws ValidationError", async () => {
    try {
      await createInteractionServerFn({
        data: {
          contactId: "invalid",
          interactionType: "email",
        },
      });
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
    }
  });
});

describe.skipIf(!hasDb())("Contact Server Functions — Integration (with DB)", () => {
  test("full server function flow: create, list, get, update, interaction, followup, merge, delete", async () => {
    const ctx = await createTestDb();
    const { db } = ctx;

    try {
      await ensureContactsSchema(db);

      const owner = await createTestUser(db, { firstName: "Owner", lastName: "ServerFn" });
      const org = await createTestOrg(db, { ownerId: owner.id, name: "ServerFn Org" });

      const manager = await createTestUser(db, { firstName: "Manager", lastName: "ServerFn" });
      await addMemberWithRole(db, {
        organizationId: org.id,
        userId: manager.id,
        roleCode: "manager",
      });

      const config = getConfig();
      const token = await signAccessToken(
        manager.id,
        org.id,
        config.JWT_ACCESS_SECRET || "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      );

      setServerDbForTest(db as never);
      setServerHeadersForTest({ cookie: `nawebeus_access=${token}` });

      // 1. Create target contact
      const { contact: target } = await createContactServerFn({
        data: {
          kind: "journalist",
          fullName: "Target ServerFn",
          email: "target@serverfn.com",
        },
      });
      expect(target.id).toMatch(/^con_/);
      expect(target.fullName).toBe("Target ServerFn");

      // 2. Create source contact
      const { contact: source } = await createContactServerFn({
        data: {
          kind: "journalist",
          fullName: "Source ServerFn",
          email: "source@serverfn.com",
        },
      });

      // 3. Get contact by ID
      const { contact: fetched } = await getContactServerFn({
        data: { id: target.id },
      });
      expect(fetched.id).toBe(target.id);

      // 4. Update contact
      const { contact: updated } = await updateContactServerFn({
        data: {
          id: target.id,
          location: "Abuja, NG",
          version: target.version,
        },
      });
      expect(updated.location).toBe("Abuja, NG");
      expect(updated.version).toBe(2);

      // 5. Create interaction on source
      const { interaction } = await createInteractionServerFn({
        data: {
          contactId: source.id,
          interactionType: "email",
          direction: "outbound",
          subject: "ServerFn Test Pitch",
          followUpAt: new Date(Date.now() + 50000),
        },
      });
      expect(interaction.id).toMatch(/^ci_/);
      expect(interaction.followUpStatus).toBe("pending");

      // 6. Complete follow-up
      const { interaction: completed } = await completeFollowUpServerFn({
        data: {
          id: interaction.id,
        },
      });
      expect(completed.followUpStatus).toBe("completed");

      // 7. Merge source into target
      const { contact: merged } = await mergeContactsServerFn({
        data: {
          id: source.id,
          targetContactId: target.id,
        },
      });
      expect(merged.id).toBe(target.id);
      expect(merged.interactionCount).toBe(1);

      // 8. List interactions on target
      const { interactions } = await listInteractionsServerFn({
        data: {
          contactId: target.id,
          limit: 10,
        },
      });
      expect(interactions.length).toBe(1);
      expect(interactions[0]!.id).toBe(interaction.id);

      // 9. List contacts
      const { contacts: contactList } = await listContactsServerFn({
        data: {
          kind: "journalist",
          limit: 10,
        },
      });
      expect(contactList.some((c: { id: string }) => c.id === target.id)).toBe(true);
      expect(contactList.some((c: { id: string }) => c.id === source.id)).toBe(false);

      // 10. Delete target contact
      const deleteResult = await deleteContactServerFn({
        data: { id: target.id },
      });
      expect(deleteResult.deleted).toBe(true);
      expect(deleteResult.id).toBe(target.id);
    } finally {
      clearServerHeadersForTest();
      clearServerDbForTest();
      await ctx.done();
    }
  });
});
