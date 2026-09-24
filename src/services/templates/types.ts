import type { Platform, TemplateType } from "@/lib/validation";

export interface TemplateVariable {
  name: string;
  type?: ("text" | "number" | "date" | "url" | "select") | undefined;
  label?: string | undefined;
  description?: string | undefined;
  defaultValue?: string | undefined;
  required?: boolean | undefined;
  options?: string[] | undefined;
}

export interface TemplateRecord {
  id: string;
  organizationId: string | null;
  templateType: TemplateType;
  name: string;
  description: string | null;
  content: string | null;
  sharedContent: string | null;
  platformVariants: Record<string, unknown> | null;
  variables: TemplateVariable[] | null;
  config: Record<string, unknown> | null;
  campaignMetadata: Record<string, unknown> | null;
  platform: Platform | null;
  platforms?: Platform[] | undefined;
  mediaIds: string[] | null;
  categoryPath: string | null;
  category: string | null;
  tags: string[] | null;
  intentMatch: string | null;
  language: string;
  isPidginAppropriate: boolean;
  isOrganizationWide: boolean;
  isPublic: boolean;
  isPremium: boolean;
  requiresApproval: boolean;
  currentApprovalStatus: string | null;
  approvalStatus: string | null;
  approvedAt: Date | null;
  approvedById: string | null;
  usageCount: number;
  avgCsat: string | null;
  csat: number | null;
  avgConversionRate: string | null;
  conversionRate: number | null;
  lastUsedAt: Date | null;
  isActive: boolean;
  version: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateInput {
  templateType: TemplateType;
  name: string;
  description?: string | null | undefined;
  content?: string | null | undefined;
  sharedContent?: string | null | undefined;
  platformVariants?: Record<string, unknown> | null | undefined;
  variables?: TemplateVariable[] | null | undefined;
  config?: Record<string, unknown> | null | undefined;
  campaignMetadata?: Record<string, unknown> | null | undefined;
  platform?: Platform | null | undefined;
  platforms?: Platform[] | undefined;
  mediaIds?: string[] | undefined;
  categoryPath?: string | null | undefined;
  category?: string | null | undefined;
  tags?: string[] | undefined;
  intentMatch?: string | null | undefined;
  language?: string | undefined;
  isPidginAppropriate?: boolean | undefined;
  isOrganizationWide?: boolean | undefined;
  isPublic?: boolean | undefined;
  isPremium?: boolean | undefined;
  requiresApproval?: boolean | undefined;
  approvalStatus?: string | null | undefined;
}

export interface UpdateTemplateInput {
  name?: string | undefined;
  description?: string | null | undefined;
  content?: string | null | undefined;
  sharedContent?: string | null | undefined;
  platformVariants?: Record<string, unknown> | null | undefined;
  variables?: TemplateVariable[] | null | undefined;
  config?: Record<string, unknown> | null | undefined;
  campaignMetadata?: Record<string, unknown> | null | undefined;
  platform?: Platform | null | undefined;
  mediaIds?: string[] | undefined;
  categoryPath?: string | null | undefined;
  category?: string | null | undefined;
  tags?: string[] | undefined;
  intentMatch?: string | null | undefined;
  language?: string | undefined;
  isPidginAppropriate?: boolean | undefined;
  isOrganizationWide?: boolean | undefined;
  isPublic?: boolean | undefined;
  isPremium?: boolean | undefined;
  isActive?: boolean | undefined;
  requiresApproval?: boolean | undefined;
  approvalStatus?: string | null | undefined;
  version?: number | undefined;
}

export interface ListTemplatesOptions {
  orgId: string;
  userId: string;
  templateType?: TemplateType | undefined;
  platform?: Platform | undefined;
  category?: string | undefined;
  categoryPath?: string | undefined;
  intentMatch?: string | undefined;
  isPidginAppropriate?: boolean | undefined;
  tag?: string | undefined;
  q?: string | undefined;
  visibility?: ("all" | "organization" | "mine" | "system" | "private") | undefined;
  approvalStatus?: ("all" | "pending" | "approved" | "rejected") | undefined;
  includePending?: boolean | undefined;
  isActive?: boolean | undefined;
  sort?:
    | ("newest" | "most_used" | "recently_used" | "name" | "recent" | "highest_rated")
    | undefined;
  limit?: number | undefined;
  cursor?: { v: string; id: string } | null | undefined;
}

export interface RecordUsageInput {
  csat?: number | undefined;
  conversionRate?: number | undefined;
}

export interface ApproveTemplateInput {
  status: "approved" | "rejected";
  comment?: string | undefined;
}

export interface RenderResult {
  rendered: string;
  missingVariables: string[];
  platform?: string | undefined;
}
