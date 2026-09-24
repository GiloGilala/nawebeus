import type {
  ContactKind,
  FollowUpStatus,
  InteractionDirection,
  InteractionOutcome,
  InteractionPriority,
  InteractionType,
  InteractionVisibility,
} from "@/lib/validation";

export interface ContactRecord {
  id: string;
  organizationId: string;
  kind: ContactKind;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  emailSecondary: string | null;
  phone: string | null;
  whatsapp: string | null;
  telegram: string | null;
  location: string | null;
  tags: string[] | null;
  notes: string | null;
  relationshipScore: number;
  lastInteractionAt: Date | null;
  interactionCount: number;
  isActive: boolean;
  deletedAt: Date | null;
  deletedById: string | null;
  mergedIntoId: string | null;
  mergedAt: Date | null;
  version: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactInteractionRecord {
  id: string;
  organizationId: string;
  contactId: string;
  campaignId: string | null;
  pressReleaseId: string | null;
  assignmentId: string | null;
  distributionId: string | null;
  interactionType: InteractionType;
  direction: InteractionDirection | null;
  subject: string | null;
  content: string | null;
  outcome: InteractionOutcome | null;
  responseTimeMinutes: number | null;
  durationMinutes: number | null;
  priority: InteractionPriority;
  visibility: InteractionVisibility;
  externalReference: string | null;
  metadata: Record<string, unknown> | null;
  followUpAt: Date | null;
  followUpNote: string | null;
  followUpStatus: FollowUpStatus;
  followUpCompletedAt: Date | null;
  createdById: string;
  createdAt: Date;
}

export interface CreateContactInput {
  kind: ContactKind;
  fullName: string;
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  displayName?: string | null | undefined;
  email?: string | null | undefined;
  emailSecondary?: string | null | undefined;
  phone?: string | null | undefined;
  whatsapp?: string | null | undefined;
  telegram?: string | null | undefined;
  location?: string | null | undefined;
  tags?: string[] | undefined;
  notes?: string | null | undefined;
}

export interface UpdateContactInput {
  fullName?: string | undefined;
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  displayName?: string | null | undefined;
  email?: string | null | undefined;
  emailSecondary?: string | null | undefined;
  phone?: string | null | undefined;
  whatsapp?: string | null | undefined;
  telegram?: string | null | undefined;
  location?: string | null | undefined;
  tags?: string[] | undefined;
  notes?: string | null | undefined;
  isActive?: boolean | undefined;
  version?: number | undefined;
}

export interface ListContactsOptions {
  orgId: string;
  kind?: ContactKind | undefined;
  tag?: string | undefined;
  isActive?: boolean | undefined;
  q?: string | undefined;
  sort?: ("recent" | "name" | "score" | "interactions") | undefined;
  limit?: number | undefined;
  cursor?: { v: string; id: string } | null | undefined;
}

export interface CreateInteractionInput {
  contactId: string;
  interactionType: InteractionType;
  direction?: InteractionDirection | null | undefined;
  subject?: string | null | undefined;
  content?: string | null | undefined;
  outcome?: InteractionOutcome | null | undefined;
  responseTimeMinutes?: number | null | undefined;
  durationMinutes?: number | null | undefined;
  priority?: InteractionPriority | undefined;
  visibility?: InteractionVisibility | undefined;
  campaignId?: string | null | undefined;
  pressReleaseId?: string | null | undefined;
  assignmentId?: string | null | undefined;
  distributionId?: string | null | undefined;
  externalReference?: string | null | undefined;
  metadata?: Record<string, unknown> | null | undefined;
  followUpAt?: Date | null | undefined;
  followUpNote?: string | null | undefined;
}

export interface ListInteractionsOptions {
  orgId: string;
  contactId?: string | undefined;
  limit?: number | undefined;
  cursor?: { v: string; id: string } | null | undefined;
}
