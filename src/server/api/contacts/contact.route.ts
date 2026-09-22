import type { Context } from "hono";
import { Hono } from "hono";
import { getConfig } from "@/lib/config";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getClientIp } from "@/lib/ip";
import { paginationMeta, parsePagination } from "@/lib/pagination";
import { success } from "@/lib/response";
import {
  CONTACT_ID_PATTERN,
  completeFollowUpSchema,
  createContactSchema,
  createInteractionSchema,
  INTERACTION_ID_PATTERN,
  listContactsQuerySchema,
  mergeContactSchema,
  updateContactSchema,
} from "@/lib/validation";
import { authMiddleware } from "@/server/middleware/auth";
import { requireAbility } from "@/server/middleware/rbac";
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

const router = new Hono();

router.use("/contacts/*", authMiddleware);
router.use("/contacts", authMiddleware);

async function readJsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

function validationDetails(error: import("zod").ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join(".") || "(root)",
    message: issue.message,
  }));
}

function contactIdParam(c: Context): string {
  const id = c.req.param("id") ?? "";
  if (!CONTACT_ID_PATTERN.test(id)) {
    throw new NotFoundError("Contact not found");
  }
  return id;
}

function interactionIdParam(c: Context): string {
  const id = c.req.param("interactionId") ?? "";
  if (!INTERACTION_ID_PATTERN.test(id)) {
    throw new NotFoundError("Interaction not found");
  }
  return id;
}

function actorContext(c: Context): { ip?: string | undefined; userAgent?: string | undefined } {
  const ip = getClientIp(c, getConfig());
  const userAgent = c.req.header("user-agent");
  return {
    ...(ip ? { ip } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}

// ── POST /api/contacts — create contact ──────────────────────────────────────

router.post("/contacts", requireAbility("create", "contacts"), async (c) => {
  const parsed = createContactSchema.safeParse(await readJsonBody(c));
  if (!parsed.success) {
    throw new ValidationError("Invalid contact input", validationDetails(parsed.error));
  }

  const created = await createContact(
    c.var.db,
    c.var.user.orgId,
    c.var.user.userId,
    parsed.data,
    actorContext(c),
  );

  return c.json(success({ contact: created }), 201);
});

// ── GET /api/contacts — list contacts ────────────────────────────────────────

router.get("/contacts", requireAbility("read", "contacts"), async (c) => {
  const url = new URL(c.req.url);
  const pagination = parsePagination(url, { idPattern: CONTACT_ID_PATTERN });

  const queryParams = c.req.query();
  const parsedQuery = listContactsQuerySchema.safeParse(queryParams);
  if (!parsedQuery.success) {
    throw new ValidationError("Invalid query parameters", validationDetails(parsedQuery.error));
  }

  const data = parsedQuery.data;

  const page = await listContacts(c.var.db, {
    orgId: c.var.user.orgId,
    kind: data.kind,
    tag: data.tag,
    isActive: data.isActive,
    q: data.q,
    sort: data.sort,
    limit: pagination.limit,
    cursor: pagination.cursor,
  });

  return c.json(
    {
      ...success({ contacts: page.items }),
      meta: paginationMeta(page.pageInfo),
    },
    200,
  );
});

// ── GET /api/contacts/:id — get contact ──────────────────────────────────────

router.get("/contacts/:id", requireAbility("read", "contacts"), async (c) => {
  const id = contactIdParam(c);

  const contact = await getContactById(c.var.db, id, c.var.user.orgId);

  return c.json(success({ contact }), 200);
});

// ── PATCH /api/contacts/:id — update contact ─────────────────────────────────

router.patch("/contacts/:id", requireAbility("update", "contacts"), async (c) => {
  const id = contactIdParam(c);
  const parsed = updateContactSchema.safeParse(await readJsonBody(c));
  if (!parsed.success) {
    throw new ValidationError("Invalid update input", validationDetails(parsed.error));
  }

  const updated = await updateContact(
    c.var.db,
    id,
    c.var.user.orgId,
    c.var.user.userId,
    parsed.data,
    {
      expectedVersion: parsed.data.version,
      actorContext: actorContext(c),
    },
  );

  return c.json(success({ contact: updated }), 200);
});

// ── DELETE /api/contacts/:id — delete contact ─────────────────────────────────

router.delete("/contacts/:id", requireAbility("delete", "contacts"), async (c) => {
  const id = contactIdParam(c);

  const result = await deleteContact(
    c.var.db,
    id,
    c.var.user.orgId,
    c.var.user.userId,
    actorContext(c),
  );

  return c.json(success(result), 200);
});

// ── POST /api/contacts/:id/merge — merge contact ─────────────────────────────

router.post("/contacts/:id/merge", requireAbility("update", "contacts"), async (c) => {
  const sourceId = contactIdParam(c);
  const parsed = mergeContactSchema.safeParse(await readJsonBody(c));
  if (!parsed.success) {
    throw new ValidationError("Invalid merge input", validationDetails(parsed.error));
  }

  const surviving = await mergeContacts(
    c.var.db,
    sourceId,
    parsed.data.targetContactId,
    c.var.user.orgId,
    c.var.user.userId,
    actorContext(c),
  );

  return c.json(success({ contact: surviving }), 200);
});

// ── POST /api/contacts/:id/interactions — log interaction ────────────────────

router.post("/contacts/:id/interactions", requireAbility("create", "contacts"), async (c) => {
  const contactId = contactIdParam(c);
  const body = (await readJsonBody(c)) as Record<string, unknown>;
  const parsed = createInteractionSchema.safeParse({ ...body, contactId });
  if (!parsed.success) {
    throw new ValidationError("Invalid interaction input", validationDetails(parsed.error));
  }

  const created = await createInteraction(
    c.var.db,
    c.var.user.orgId,
    c.var.user.userId,
    parsed.data,
    actorContext(c),
  );

  return c.json(success({ interaction: created }), 201);
});

// ── GET /api/contacts/:id/interactions — list interactions for contact ────────

router.get("/contacts/:id/interactions", requireAbility("read", "contacts"), async (c) => {
  const contactId = contactIdParam(c);
  const url = new URL(c.req.url);
  const pagination = parsePagination(url, { idPattern: INTERACTION_ID_PATTERN });

  const page = await listInteractions(c.var.db, {
    orgId: c.var.user.orgId,
    contactId,
    limit: pagination.limit,
    cursor: pagination.cursor,
  });

  return c.json(
    {
      ...success({ interactions: page.items }),
      meta: paginationMeta(page.pageInfo),
    },
    200,
  );
});

// ── POST /api/contacts/interactions/:interactionId/complete-followup ──────────

router.post(
  "/contacts/interactions/:interactionId/complete-followup",
  requireAbility("update", "contacts"),
  async (c) => {
    const interactionId = interactionIdParam(c);
    const parsed = completeFollowUpSchema.safeParse(await readJsonBody(c));
    if (!parsed.success) {
      throw new ValidationError("Invalid input", validationDetails(parsed.error));
    }

    const updated = await completeFollowUp(
      c.var.db,
      interactionId,
      c.var.user.orgId,
      c.var.user.userId,
      {
        completedAt: parsed.data.completedAt,
        actorContext: actorContext(c),
      },
    );

    return c.json(success({ interaction: updated }), 200);
  },
);

export { router as contactRouter };
