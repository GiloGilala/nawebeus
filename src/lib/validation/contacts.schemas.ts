import { z } from "zod";

export const CONTACT_KINDS = ["journalist", "influencer"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export const INTERACTION_TYPES = [
  "email",
  "whatsapp",
  "phone_call",
  "meeting",
  "video_call",
  "dm",
  "event",
  "social_dm",
  "interview_request",
  "press_release_open",
  "coverage_published",
  "briefing",
  "content_review",
  "negotiation",
  "campaign_briefing",
  "contract_signed",
] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const INTERACTION_DIRECTIONS = ["inbound", "outbound", "automatic"] as const;
export type InteractionDirection = (typeof INTERACTION_DIRECTIONS)[number];

export const INTERACTION_OUTCOMES = [
  "positive",
  "neutral",
  "negative",
  "no_response",
  "coverage",
  "meeting_scheduled",
  "interview_scheduled",
  "content_published",
  "contract_signed",
  "declined",
] as const;
export type InteractionOutcome = (typeof INTERACTION_OUTCOMES)[number];

export const INTERACTION_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type InteractionPriority = (typeof INTERACTION_PRIORITIES)[number];

export const INTERACTION_VISIBILITIES = ["private", "internal", "organization"] as const;
export type InteractionVisibility = (typeof INTERACTION_VISIBILITIES)[number];

export const FOLLOWUP_STATUSES = ["pending", "completed", "cancelled", "rescheduled"] as const;
export type FollowUpStatus = (typeof FOLLOWUP_STATUSES)[number];

export const CONTACT_ID_PATTERN = /^con_[0-9a-zA-Z_-]{8,50}$/;
export const INTERACTION_ID_PATTERN = /^ci_[0-9a-zA-Z_-]{8,50}$/;

export const contactIdSchema = z.object({
  id: z.string().trim().regex(CONTACT_ID_PATTERN, "Invalid contact ID; must match con_<chars>"),
});

export const interactionIdSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(INTERACTION_ID_PATTERN, "Invalid interaction ID; must match ci_<chars>"),
});

export const createContactSchema = z.object({
  kind: z.enum(CONTACT_KINDS, {
    message: "Kind must be 'journalist' or 'influencer'",
  }),
  fullName: z.string().trim().min(1, "Full name is required").max(200),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  displayName: z.string().trim().max(255).optional(),
  email: z.string().trim().email("Invalid email address").max(255).nullable().optional(),
  emailSecondary: z
    .string()
    .trim()
    .email("Invalid secondary email address")
    .max(255)
    .nullable()
    .optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  whatsapp: z.string().trim().max(20).nullable().optional(),
  telegram: z.string().trim().max(100).nullable().optional(),
  location: z.string().trim().max(500).nullable().optional(),
  tags: z.array(z.string().trim().max(50)).optional(),
  notes: z.string().max(10000).nullable().optional(),
});

export const updateContactSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  firstName: z.string().trim().max(100).nullable().optional(),
  lastName: z.string().trim().max(100).nullable().optional(),
  displayName: z.string().trim().max(255).nullable().optional(),
  email: z.string().trim().email("Invalid email address").max(255).nullable().optional(),
  emailSecondary: z
    .string()
    .trim()
    .email("Invalid secondary email address")
    .max(255)
    .nullable()
    .optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  whatsapp: z.string().trim().max(20).nullable().optional(),
  telegram: z.string().trim().max(100).nullable().optional(),
  location: z.string().trim().max(500).nullable().optional(),
  tags: z.array(z.string().trim().max(50)).optional(),
  notes: z.string().max(10000).nullable().optional(),
  isActive: z.boolean().optional(),
  version: z.number().int().positive().optional(),
});

export const mergeContactSchema = z.object({
  targetContactId: z
    .string()
    .trim()
    .regex(CONTACT_ID_PATTERN, "Invalid target contact ID; must match con_<chars>"),
});

export const mergeContactInputSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(CONTACT_ID_PATTERN, "Invalid source contact ID; must match con_<chars>"),
  targetContactId: z
    .string()
    .trim()
    .regex(CONTACT_ID_PATTERN, "Invalid target contact ID; must match con_<chars>"),
});

export const listInteractionsQuerySchema = z.object({
  contactId: z
    .string()
    .trim()
    .regex(CONTACT_ID_PATTERN, "Invalid contact ID; must match con_<chars>"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().trim().optional(),
});

export const listContactsQuerySchema = z.object({
  kind: z.enum(CONTACT_KINDS).optional(),
  tag: z.string().trim().optional(),
  isActive: z
    .preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
  q: z.string().trim().optional(),
  sort: z.enum(["recent", "name", "score", "interactions"]).optional().default("recent"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().trim().optional(),
});

export const createInteractionSchema = z.object({
  contactId: z
    .string()
    .trim()
    .regex(CONTACT_ID_PATTERN, "Invalid contact ID; must match con_<chars>"),
  interactionType: z.enum(INTERACTION_TYPES, {
    message: "Invalid interaction type",
  }),
  direction: z.enum(INTERACTION_DIRECTIONS).optional(),
  subject: z.string().trim().max(500).nullable().optional(),
  content: z.string().max(50000).nullable().optional(),
  outcome: z.enum(INTERACTION_OUTCOMES).nullable().optional(),
  responseTimeMinutes: z.number().int().min(0).nullable().optional(),
  durationMinutes: z.number().int().min(0).nullable().optional(),
  priority: z.enum(INTERACTION_PRIORITIES).default("medium"),
  visibility: z.enum(INTERACTION_VISIBILITIES).default("organization"),
  campaignId: z.string().trim().max(64).nullable().optional(),
  pressReleaseId: z.string().trim().max(64).nullable().optional(),
  assignmentId: z.string().trim().max(64).nullable().optional(),
  distributionId: z.string().trim().max(64).nullable().optional(),
  externalReference: z.string().trim().max(255).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  followUpAt: z.coerce.date().nullable().optional(),
  followUpNote: z.string().max(2000).nullable().optional(),
});

export const completeFollowUpSchema = z.object({
  completedAt: z.coerce.date().optional(),
});
