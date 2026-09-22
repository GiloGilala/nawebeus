/**
 * TanStack Start Server Functions — Contacts domain
 *
 * Thin adapters: validate with shared Zod schemas, derive orgId & userId from
 * the session (never the payload), assert CASL abilities, and delegate to services.
 */

import { ValidationError } from "@/lib/errors";
import { decodeCursor } from "@/lib/pagination";
import {
  CONTACT_ID_PATTERN,
  completeFollowUpSchema,
  contactIdSchema,
  createContactSchema,
  createInteractionSchema,
  INTERACTION_ID_PATTERN,
  interactionIdSchema,
  listContactsQuerySchema,
  listInteractionsQuerySchema,
  mergeContactInputSchema,
  updateContactSchema,
} from "@/lib/validation";
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
} from "@/services/contacts";
import { createServerFn } from "../lib/createServerFn";
import { assertServerAbility, getServerAuth, getServerDb, withServerOrgContext } from "./helpers";

export const createContactServerFn = createServerFn({ method: "POST" })
  .validator(createContactSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof createContactSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "create", "contacts");
    const db = getServerDb();

    const created = await withServerOrgContext(auth, () =>
      createContact(db, auth.orgId, auth.userId, parsed),
    );
    return { contact: created };
  });

export const listContactsServerFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => listContactsQuerySchema.parse(raw ?? {}))
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof listContactsQuerySchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "contacts");
    const db = getServerDb();

    let cursor: { v: string; id: string } | null = null;
    if (parsed.cursor) {
      cursor = decodeCursor(parsed.cursor, { idPattern: CONTACT_ID_PATTERN });
      if (cursor === null) {
        throw new ValidationError("Invalid pagination parameter", [
          { field: "cursor", message: "Malformed cursor" },
        ]);
      }
    }

    const result = await withServerOrgContext(auth, () =>
      listContacts(db, {
        orgId: auth.orgId,
        kind: parsed.kind,
        tag: parsed.tag,
        isActive: parsed.isActive,
        q: parsed.q,
        sort: parsed.sort,
        limit: parsed.limit,
        cursor,
      }),
    );
    return { contacts: result.items, pageInfo: result.pageInfo };
  });

export const getContactServerFn = createServerFn({ method: "GET" })
  .validator(contactIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as { id: string };
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "contacts");
    const db = getServerDb();

    const contact = await withServerOrgContext(auth, () =>
      getContactById(db, parsed.id, auth.orgId),
    );
    return { contact };
  });

export const updateContactServerFn = createServerFn({ method: "POST" })
  .validator(contactIdSchema.and(updateContactSchema))
  .handler(async ({ data }) => {
    const parsed = data as { id: string } & ReturnType<typeof updateContactSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "contacts");
    const db = getServerDb();

    const { id, ...updateFields } = parsed;
    const updated = await withServerOrgContext(auth, () =>
      updateContact(db, id, auth.orgId, auth.userId, updateFields, {
        ...(parsed.version !== undefined ? { expectedVersion: parsed.version } : {}),
      }),
    );
    return { contact: updated };
  });

export const deleteContactServerFn = createServerFn({ method: "POST" })
  .validator(contactIdSchema)
  .handler(async ({ data }) => {
    const parsed = data as { id: string };
    const auth = await getServerAuth();
    assertServerAbility(auth, "delete", "contacts");
    const db = getServerDb();

    const result = await withServerOrgContext(auth, () =>
      deleteContact(db, parsed.id, auth.orgId, auth.userId),
    );
    return result;
  });

export const mergeContactsServerFn = createServerFn({ method: "POST" })
  .validator(mergeContactInputSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof mergeContactInputSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "contacts");
    const db = getServerDb();

    const surviving = await withServerOrgContext(auth, () =>
      mergeContacts(db, parsed.id, parsed.targetContactId, auth.orgId, auth.userId),
    );
    return { contact: surviving };
  });

export const createInteractionServerFn = createServerFn({ method: "POST" })
  .validator(createInteractionSchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof createInteractionSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "create", "contacts");
    const db = getServerDb();

    const created = await withServerOrgContext(auth, () =>
      createInteraction(db, auth.orgId, auth.userId, parsed),
    );
    return { interaction: created };
  });

export const listInteractionsServerFn = createServerFn({ method: "GET" })
  .validator(listInteractionsQuerySchema)
  .handler(async ({ data }) => {
    const parsed = data as ReturnType<typeof listInteractionsQuerySchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "read", "contacts");
    const db = getServerDb();

    let cursor: { v: string; id: string } | null = null;
    if (parsed.cursor) {
      cursor = decodeCursor(parsed.cursor, { idPattern: INTERACTION_ID_PATTERN });
      if (cursor === null) {
        throw new ValidationError("Invalid pagination parameter", [
          { field: "cursor", message: "Malformed cursor" },
        ]);
      }
    }

    const result = await withServerOrgContext(auth, () =>
      listInteractions(db, {
        orgId: auth.orgId,
        contactId: parsed.contactId,
        limit: parsed.limit,
        cursor,
      }),
    );
    return { interactions: result.items, pageInfo: result.pageInfo };
  });

export const completeFollowUpServerFn = createServerFn({ method: "POST" })
  .validator(interactionIdSchema.and(completeFollowUpSchema))
  .handler(async ({ data }) => {
    const parsed = data as { id: string } & ReturnType<typeof completeFollowUpSchema.parse>;
    const auth = await getServerAuth();
    assertServerAbility(auth, "update", "contacts");
    const db = getServerDb();

    const updated = await withServerOrgContext(auth, () =>
      completeFollowUp(db, parsed.id, auth.orgId, auth.userId, {
        completedAt: parsed.completedAt,
      }),
    );
    return { interaction: updated };
  });
