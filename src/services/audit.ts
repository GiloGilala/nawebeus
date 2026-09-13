import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export type AuditModule = "core" | "admin" | "system" | "compliance" | "security";
export type AuditActorType = "user" | "admin" | "system" | "api_key" | "impersonation";
export type AuditCategory =
  | "authentication"
  | "authorization"
  | "user_management"
  | "content"
  | "billing"
  | "security"
  | "compliance"
  | "system_config"
  | "feature_flag"
  | "engagement"
  | "publishing"
  | "listening"
  | "data_ops";
export type AuditSeverity = "info" | "warning" | "critical" | "emergency";

export interface WriteAuditLogEntryParams {
  db: NodePgDatabase<Record<string, any>>;
  module: AuditModule;
  organizationId?: string;
  actorId?: string;
  actorType?: AuditActorType;
  actorIp?: string;
  actorUserAgent?: string;
  action: string;
  category?: AuditCategory;
  resourceType?: string;
  resourceId?: string;
  targetUserId?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  changes?: Record<string, unknown>;
  severity?: AuditSeverity;
  reason?: string;
  requestId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(params: WriteAuditLogEntryParams): Promise<void> {
  const {
    db,
    module,
    organizationId,
    actorId,
    actorType,
    actorIp,
    actorUserAgent,
    action,
    category = "user_management",
    resourceType,
    resourceId,
    targetUserId,
    beforeState,
    afterState,
    changes,
    severity = "info",
    reason,
    requestId,
    sessionId,
    metadata,
  } = params;

  const id = `al_${crypto.randomUUID().slice(0, 21)}`;

  await db.execute(
    sql`
      INSERT INTO unified_audit_log (
        id, module, organization_id, actor_id, actor_type, actor_ip,
        actor_user_agent, action, category, resource_type, resource_id,
        target_user_id, before_state, after_state, changes, severity,
        reason, request_id, session_id, metadata
      ) VALUES (
        ${id}, ${module}, ${organizationId ?? null}, ${actorId ?? null},
        ${actorType ?? null}, ${actorIp ?? null}, ${actorUserAgent ?? null},
        ${action}, ${category}, ${resourceType ?? null}, ${resourceId ?? null},
        ${targetUserId ?? null}, ${JSON.stringify(beforeState ?? null)},
        ${JSON.stringify(afterState ?? null)}, ${JSON.stringify(changes ?? null)},
        ${severity}, ${reason ?? null}, ${requestId ?? null},
        ${sessionId ?? null}, ${JSON.stringify(metadata ?? null)}
      )
    `,
  );
}
