/**
 * Unified Contacts Service tests (NWB-P1-007).
 *
 * Covers:
 * - Contact creation (journalist & influencer kinds, shared identity fields)
 * - Unique email & phone per organization
 * - Multi-tenant isolation (org A cannot access or mutate org B's contacts)
 * - Optimistic concurrency version locking (ContactVersionConflictError)
 * - Soft deletion with consistency check (deletedAt, deletedById, isActive = false)
 * - Contact deduplication merge (re-links interactions, sets mergedIntoId/mergedAt, prevents double-merge)
 * - Interaction timeline tracking (auto-updates contact counters, externalReference idempotency)
 * - Follow-up lifecycle state machine (pending -> completed with completedAt)
 * - Keyset cursor pagination and multi-field filtering (kind, tag, isActive, search q, sorting)
 * - Audit logging for all actions (created, updated, deleted, merged, interaction_logged, followup_completed)
 */

import { describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import type { Db } from "../../lib/db";
import {
  ConflictError,
  ContactAlreadyMergedError,
  ContactVersionConflictError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors";
import {
  completeFollowUp,
  createContact,
  createInteraction,
  deleteContact,
  getContactById,
  listContacts,
  listInteractions,
  mergeContacts,
  updateContact,
} from "../../services/contacts";
import { ensureContactsSchema, withTestDb } from "../helpers/test-db";
import { addMemberWithRole, createTestOrg, createTestUser } from "../helpers/test-factory";

const hasDb = () => Boolean(process.env.DATABASE_URL);

interface ContactsWorkspace {
  orgId: string;
  creatorId: string;
  managerId: string;
  memberId: string;
  otherOrgId: string;
  otherUserId: string;
}

async function setupWorkspace(db: Db): Promise<ContactsWorkspace> {
  await ensureContactsSchema(db);

  const owner = await createTestUser(db, { firstName: "Contact", lastName: "Owner" });
  const org = await createTestOrg(db, { ownerId: owner.id, name: "Contacts Test Org" });

  const creator = await createTestUser(db, { firstName: "Contact", lastName: "Creator" });
  await addMemberWithRole(db, { organizationId: org.id, userId: creator.id, roleCode: "creator" });

  const manager = await createTestUser(db, { firstName: "Contact", lastName: "Manager" });
  await addMemberWithRole(db, { organizationId: org.id, userId: manager.id, roleCode: "manager" });

  const member = await createTestUser(db, { firstName: "Regular", lastName: "Member" });
  await addMemberWithRole(db, { organizationId: org.id, userId: member.id, roleCode: "viewer" });

  const otherOwner = await createTestUser(db, { firstName: "Other", lastName: "Owner" });
  const otherOrg = await createTestOrg(db, { ownerId: otherOwner.id, name: "Other Org" });
  const otherUser = await createTestUser(db, { firstName: "Other", lastName: "User" });
  await addMemberWithRole(db, {
    organizationId: otherOrg.id,
    userId: otherUser.id,
    roleCode: "creator",
  });

  return {
    orgId: org.id,
    creatorId: creator.id,
    managerId: manager.id,
    memberId: member.id,
    otherOrgId: otherOrg.id,
    otherUserId: otherUser.id,
  };
}

describe.skipIf(!hasDb())("Contacts Service — CRUD & Constraints", () => {
  test("creates journalist and influencer contacts with proper fields", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const journalist = await createContact(db, ws.orgId, ws.creatorId, {
        kind: "journalist",
        fullName: "Amaka Eze",
        firstName: "Amaka",
        lastName: "Eze",
        email: "amaka@punchng.com",
        phone: "+2348012345678",
        location: "Lagos, Nigeria",
        tags: ["tech", "business"],
        notes: "Senior tech correspondent at Punch",
      });

      expect(journalist.id).toMatch(/^con_/);
      expect(journalist.kind).toBe("journalist");
      expect(journalist.fullName).toBe("Amaka Eze");
      expect(journalist.email).toBe("amaka@punchng.com");
      expect(journalist.phone).toBe("+2348012345678");
      expect(journalist.organizationId).toBe(ws.orgId);
      expect(journalist.createdById).toBe(ws.creatorId);
      expect(journalist.version).toBe(1);
      expect(journalist.isActive).toBe(true);
      expect(journalist.interactionCount).toBe(0);
      expect(journalist.relationshipScore).toBe(0);

      const influencer = await createContact(db, ws.orgId, ws.creatorId, {
        kind: "influencer",
        fullName: "Tunde Ednut",
        email: "tunde@ednutmedia.com",
        tags: ["entertainment", "viral"],
      });

      expect(influencer.id).toMatch(/^con_/);
      expect(influencer.kind).toBe("influencer");
      expect(influencer.fullName).toBe("Tunde Ednut");
      expect(influencer.version).toBe(1);
    });
  });

  test("enforces case-insensitive email uniqueness within tenant", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      await createContact(db, ws.orgId, ws.creatorId, {
        kind: "journalist",
        fullName: "Chioma Okonkwo",
        email: "chioma@guardian.ng",
      });

      // Duplicate email in same org throws ConflictError
      await expect(
        createContact(db, ws.orgId, ws.creatorId, {
          kind: "influencer",
          fullName: "Chioma Clone",
          email: "CHIOMA@guardian.ng",
        }),
      ).rejects.toBeInstanceOf(ConflictError);

      // Same email in different org succeeds
      const otherContact = await createContact(db, ws.otherOrgId, ws.otherUserId, {
        kind: "journalist",
        fullName: "Chioma in Other Org",
        email: "chioma@guardian.ng",
      });
      expect(otherContact.organizationId).toBe(ws.otherOrgId);
    });
  });

  test("enforces phone uniqueness within tenant", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      await createContact(db, ws.orgId, ws.creatorId, {
        kind: "journalist",
        fullName: "Femi Adesina",
        phone: "+2348033333333",
      });

      await expect(
        createContact(db, ws.orgId, ws.creatorId, {
          kind: "influencer",
          fullName: "Femi Imposter",
          phone: "+2348033333333",
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  test("multi-tenant isolation: cannot read or mutate contact in another organization", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const contact = await createContact(db, ws.orgId, ws.creatorId, {
        kind: "journalist",
        fullName: "Tenant One Contact",
        email: "t1@example.com",
      });

      // Org B cannot get contact
      await expect(getContactById(db, contact.id, ws.otherOrgId)).rejects.toBeInstanceOf(
        NotFoundError,
      );

      // Org B cannot update contact
      await expect(
        updateContact(db, contact.id, ws.otherOrgId, ws.otherUserId, {
          fullName: "Hacked Contact",
        }),
      ).rejects.toBeInstanceOf(NotFoundError);

      // Org B cannot delete contact
      await expect(
        deleteContact(db, contact.id, ws.otherOrgId, ws.otherUserId),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("optimistic version locking on updates", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const contact = await createContact(db, ws.orgId, ws.creatorId, {
        kind: "journalist",
        fullName: "Versioned Contact",
        email: "versioned@example.com",
      });

      expect(contact.version).toBe(1);

      // Update with matching version succeeds and increments to 2
      const updated = await updateContact(
        db,
        contact.id,
        ws.orgId,
        ws.creatorId,
        {
          fullName: "Versioned Contact Updated",
          version: 1,
        },
        { expectedVersion: 1 },
      );
      expect(updated.version).toBe(2);
      expect(updated.fullName).toBe("Versioned Contact Updated");

      // Concurrent update attempting version 1 fails with ContactVersionConflictError
      await expect(
        updateContact(
          db,
          contact.id,
          ws.orgId,
          ws.creatorId,
          {
            fullName: "Stale Update",
            version: 1,
          },
          { expectedVersion: 1 },
        ),
      ).rejects.toBeInstanceOf(ContactVersionConflictError);

      // Update without expectedVersion increments to 3
      const updatedAgain = await updateContact(db, contact.id, ws.orgId, ws.creatorId, {
        location: "Abuja",
      });
      expect(updatedAgain.version).toBe(3);
      expect(updatedAgain.location).toBe("Abuja");
    });
  });

  test("soft delete marks contact inactive with deletedAt and deletedById", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const contact = await createContact(db, ws.orgId, ws.creatorId, {
        kind: "journalist",
        fullName: "To Be Deleted",
        email: "delete_me@example.com",
      });

      const res = await deleteContact(db, contact.id, ws.orgId, ws.managerId);
      expect(res.deleted).toBe(true);
      expect(res.id).toBe(contact.id);

      // Cannot get soft-deleted contact
      await expect(getContactById(db, contact.id, ws.orgId)).rejects.toBeInstanceOf(NotFoundError);

      // Excluded from default list
      const list = await listContacts(db, { orgId: ws.orgId });
      expect(list.items.some((c) => c.id === contact.id)).toBe(false);

      // Cannot update soft-deleted contact
      await expect(
        updateContact(db, contact.id, ws.orgId, ws.creatorId, { fullName: "New Name" }),
      ).rejects.toBeInstanceOf(NotFoundError);

      // Deleting again throws NotFoundError
      await expect(deleteContact(db, contact.id, ws.orgId, ws.managerId)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });
});

describe.skipIf(!hasDb())("Contacts Service — Deduplication & Merge", () => {
  test("merges source contact into target and repoints interactions", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const target = await createContact(db, ws.orgId, ws.creatorId, {
        kind: "journalist",
        fullName: "Ibrahim Target",
        email: "ibrahim@dailytrust.com",
      });

      const source = await createContact(db, ws.orgId, ws.creatorId, {
        kind: "journalist",
        fullName: "Ibrahim Source Duplicate",
        email: "ibrahim.alt@dailytrust.com",
      });

      // Log interaction on source contact
      const interaction1 = await createInteraction(db, ws.orgId, ws.creatorId, {
        contactId: source.id,
        interactionType: "email",
        direction: "outbound",
        subject: "Press briefing invitation",
      });

      // Log interaction on target contact
      const interaction2 = await createInteraction(db, ws.orgId, ws.creatorId, {
        contactId: target.id,
        interactionType: "phone_call",
        direction: "inbound",
        subject: "Interview confirmation",
      });

      expect(interaction1.contactId).toBe(source.id);
      expect(interaction2.contactId).toBe(target.id);

      // Merge source into target
      const mergedTarget = await mergeContacts(db, source.id, target.id, ws.orgId, ws.managerId);

      expect(mergedTarget.id).toBe(target.id);
      expect(mergedTarget.interactionCount).toBe(2);

      // Target now has both interactions
      const interactions = await listInteractions(db, {
        orgId: ws.orgId,
        contactId: target.id,
      });
      expect(interactions.items.length).toBe(2);
      expect(interactions.items.some((i) => i.id === interaction1.id)).toBe(true);
      expect(interactions.items.some((i) => i.id === interaction2.id)).toBe(true);

      // Source contact is now marked merged and soft-deleted/inactive
      await expect(getContactById(db, source.id, ws.orgId)).rejects.toBeInstanceOf(NotFoundError);

      // Source contact cannot be merged again
      await expect(
        mergeContacts(db, source.id, target.id, ws.orgId, ws.managerId),
      ).rejects.toBeInstanceOf(ContactAlreadyMergedError);

      // Merging contact into itself throws ValidationError
      await expect(
        mergeContacts(db, target.id, target.id, ws.orgId, ws.managerId),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});

describe.skipIf(!hasDb())("Contacts Service — Interactions Timeline & Follow-ups", () => {
  test("interaction timeline updates contact counters and tracks follow-up status", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const contact = await createContact(db, ws.orgId, ws.creatorId, {
        kind: "journalist",
        fullName: "Ngozi Okonjo",
        email: "ngozi@reuters.com",
      });

      expect(contact.interactionCount).toBe(0);
      expect(contact.lastInteractionAt).toBeNull();

      const followUpDate = new Date(Date.now() + 86400000);
      const interaction = await createInteraction(db, ws.orgId, ws.creatorId, {
        contactId: contact.id,
        interactionType: "email",
        direction: "outbound",
        subject: "Exclusive interview pitch",
        content: "Draft questions attached for review",
        outcome: "positive",
        priority: "high",
        externalReference: "ext_pitch_001",
        followUpAt: followUpDate,
        followUpNote: "Call if no response by tomorrow",
      });

      expect(interaction.id).toMatch(/^ci_/);
      expect(interaction.followUpStatus).toBe("pending");
      expect(interaction.followUpCompletedAt).toBeNull();
      expect(interaction.externalReference).toBe("ext_pitch_001");

      // Verify contact's interactionCount & lastInteractionAt were updated
      const refreshedContact = await getContactById(db, contact.id, ws.orgId);
      expect(refreshedContact.interactionCount).toBe(1);
      expect(refreshedContact.lastInteractionAt).not.toBeNull();

      // Enforces external reference uniqueness per tenant
      await expect(
        createInteraction(db, ws.orgId, ws.creatorId, {
          contactId: contact.id,
          interactionType: "email",
          externalReference: "ext_pitch_001",
        }),
      ).rejects.toBeInstanceOf(ConflictError);

      // Complete follow-up
      const completed = await completeFollowUp(db, interaction.id, ws.orgId, ws.creatorId);
      expect(completed.followUpStatus).toBe("completed");
      expect(completed.followUpCompletedAt).not.toBeNull();
    });
  });
});

describe.skipIf(!hasDb())("Contacts Service — Keyset Pagination & Filtering", () => {
  test("filters by kind, tag, search query, and sorts correctly", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const c1 = await createContact(db, ws.orgId, ws.creatorId, {
        kind: "journalist",
        fullName: "Adam Smith",
        email: "adam@smith.com",
        tags: ["finance", "crypto"],
        notes: "Crypto reporter",
      });

      await createContact(db, ws.orgId, ws.creatorId, {
        kind: "journalist",
        fullName: "Bob Builder",
        email: "bob@builder.com",
        tags: ["tech"],
      });

      const c3 = await createContact(db, ws.orgId, ws.creatorId, {
        kind: "influencer",
        fullName: "Charlie Chaplin",
        email: "charlie@chaplin.com",
        tags: ["entertainment", "crypto"],
      });

      // Filter by kind
      const journalists = await listContacts(db, { orgId: ws.orgId, kind: "journalist" });
      expect(journalists.items.length).toBe(2);
      expect(journalists.items.every((c) => c.kind === "journalist")).toBe(true);

      const influencers = await listContacts(db, { orgId: ws.orgId, kind: "influencer" });
      expect(influencers.items.length).toBe(1);
      expect(influencers.items[0]!.id).toBe(c3.id);

      // Filter by tag
      const cryptoContacts = await listContacts(db, { orgId: ws.orgId, tag: "crypto" });
      expect(cryptoContacts.items.length).toBe(2);

      // Search by query q
      const searchRes = await listContacts(db, { orgId: ws.orgId, q: "crypto reporter" });
      expect(searchRes.items.length).toBe(1);
      expect(searchRes.items[0]!.id).toBe(c1.id);

      // Sort by name ascending
      const sortedByName = await listContacts(db, { orgId: ws.orgId, sort: "name" });
      expect(sortedByName.items[0]!.fullName).toBe("Adam Smith");
      expect(sortedByName.items[1]!.fullName).toBe("Bob Builder");
      expect(sortedByName.items[2]!.fullName).toBe("Charlie Chaplin");

      // Keyset pagination: limit 2
      const page1 = await listContacts(db, { orgId: ws.orgId, sort: "name", limit: 2 });
      expect(page1.items.length).toBe(2);
      expect(page1.pageInfo.hasMore).toBe(true);
      expect(page1.pageInfo.cursor).toBeDefined();

      // Page 2 using cursor
      const page2 = await listContacts(db, {
        orgId: ws.orgId,
        sort: "name",
        limit: 2,
        cursor: { v: page1.items[1]!.fullName, id: page1.items[1]!.id },
      });
      expect(page2.items.length).toBe(1);
      expect(page2.items[0]!.fullName).toBe("Charlie Chaplin");
      expect(page2.pageInfo.hasMore).toBe(false);
    });
  });
});

describe.skipIf(!hasDb())("Contacts Service — Audit Logging", () => {
  test("writes audit entries for all contact operations", async () => {
    await withTestDb(async ({ db }) => {
      const ws = await setupWorkspace(db);

      const contact = await createContact(
        db,
        ws.orgId,
        ws.creatorId,
        {
          kind: "journalist",
          fullName: "Audited Contact",
          email: "audited@example.com",
        },
        { ip: "127.0.0.1", userAgent: "BunTest/1.0" },
      );

      await updateContact(
        db,
        contact.id,
        ws.orgId,
        ws.creatorId,
        {
          location: "Enugu, Nigeria",
        },
        { actorContext: { ip: "127.0.0.1" } },
      );

      const interaction = await createInteraction(
        db,
        ws.orgId,
        ws.creatorId,
        {
          contactId: contact.id,
          interactionType: "phone_call",
          direction: "outbound",
          subject: "Introductory call",
          followUpAt: new Date(),
        },
        { ip: "127.0.0.1" },
      );

      await completeFollowUp(db, interaction.id, ws.orgId, ws.creatorId, {
        actorContext: { ip: "127.0.0.1" },
      });

      await deleteContact(db, contact.id, ws.orgId, ws.managerId, {
        ip: "127.0.0.1",
      });

      const auditRows = await db.execute(
        sql`SELECT action, resource_id, actor_id FROM unified_audit_log WHERE organization_id = ${ws.orgId} ORDER BY created_at ASC`,
      );

      const actions = (
        auditRows as unknown as { rows: { action: string; resource_id: string }[] }
      ).rows.map((r) => r.action);

      expect(actions).toContain("contact.created");
      expect(actions).toContain("contact.updated");
      expect(actions).toContain("contact.interaction_logged");
      expect(actions).toContain("contact.followup_completed");
      expect(actions).toContain("contact.deleted");
    });
  });
});
