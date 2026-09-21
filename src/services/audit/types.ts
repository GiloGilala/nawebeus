/**
 * The audit vocabulary, **derived from the schema rather than hand-mirrored** (NWB-P1-002).
 *
 * `db/shared/enums.ts` is the only place these lists may be written. Before this file existed,
 * `src/services/audit.ts` carried its own copies: 5 module values against the enum's 15, which is
 * how "audit is wired to 5 modules for 14 domains" (roadmap §12) stayed true for so long — the DB
 * was ready and the TypeScript was not. Deriving the unions from `pgEnum(...).enumValues` makes the
 * drift structurally impossible: adding an enum value widens the union in the same commit, and
 * `src/tests/audit/registry.test.ts` asserts the four lists still match the enums it reads.
 *
 * Note `src/server/auth/types/api-key-types.ts` still hand-mirrors its enums with a comment
 * ("If an enum changes there, change it here in the same commit"). Same technique applies; that is
 * out of scope here and worth a follow-up.
 */
import {
  auditActorTypeEnum,
  auditCategoryEnum,
  auditSeverityEnum,
  auditSourceModuleEnum,
} from "../../../db/shared/enums";

/**
 * The value lists, exported because a validator needs them at *runtime* and cannot re-derive them.
 * `z.enum(AUDIT_MODULE_VALUES)` in a route is the same 15 values the database will accept; a hand-written
 * list in `src/server/api/audit/audit.route.ts` would be a second source of truth, which is precisely
 * the thing this file exists to remove.
 */
export const AUDIT_MODULE_VALUES = auditSourceModuleEnum.enumValues;
export const AUDIT_CATEGORY_VALUES = auditCategoryEnum.enumValues;
export const AUDIT_SEVERITY_VALUES = auditSeverityEnum.enumValues;
export const AUDIT_ACTOR_TYPE_VALUES = auditActorTypeEnum.enumValues;

/** Which part of the application wrote the row. 15 values, from `audit_source_module`. */
export type AuditModule = (typeof auditSourceModuleEnum.enumValues)[number];
/** Who performed the action. */
export type AuditActorType = (typeof auditActorTypeEnum.enumValues)[number];
/** What kind of action it was (a *domain* taxonomy — not an operation; see the removed
 * `chk_ual_mutation_state` note in `db/shared/audit.ts` for why that distinction matters). */
export type AuditCategory = (typeof auditCategoryEnum.enumValues)[number];
/** How important it is. */
export type AuditSeverity = (typeof auditSeverityEnum.enumValues)[number];

/**
 * The three modules whose CHECK constraints demand a hash-chain checksum:
 *
 *   chk_ual_admin_requires_checksum
 *   chk_ual_system_requires_checksum
 *   chk_ual_compliance_requires_checksum
 *
 * Nothing computes that chain yet, so a row in one of these modules is a `23514` at runtime. That
 * is the whole reason `src/lib/worker.ts` and `src/services/users/dsar.service.ts` write `core`
 * where `system` and `compliance` would be more accurate.
 *
 * **`writeAuditLog` takes `WritableAuditModule`, not `AuditModule`**, so those three are a type
 * error rather than a production 500 — a compile-time version of the rule the DB already enforces,
 * and the only place you need to look when NWB-P1-014 lands the chain: delete this `Exclude` and the
 * workarounds' comments with it.
 */
export const CHECKSUM_ONLY_MODULES = [
  "admin",
  "system",
  "compliance",
] as const satisfies readonly AuditModule[];

/** @see {@link CHECKSUM_ONLY_MODULES} */
export type WritableAuditModule = Exclude<AuditModule, (typeof CHECKSUM_ONLY_MODULES)[number]>;

/**
 * The acting principal, as a service receives it.
 *
 * These five fields used to be assembled at the HTTP edge (`actorOf(c)` in `api-keys.route.ts`) and
 * handed to `writeAuditLog` from the route, which meant the *service* could be called — by a CLI, by
 * a queue job, by another service — and mutate data with no audit row at all. Moving the write into
 * the service requires the actor to travel with the call, so it gets one named parameter instead of
 * five loose ones.
 *
 * `null` is a legal value at call sites that own a *bulk* audit event of their own (documented at
 * each). It is not a legal value inside `writeAuditLog`: a mutation with no actor is how an insider
 * search dies.
 */
export interface AuditActor {
  readonly actorId: string;
  readonly actorType: AuditActorType;
  /**
   * The tenant the actor was *acting in*, which is not always the tenant of the row being changed —
   * a session belongs to a user, not to an organization, but "who signed out of which workspace" is
   * exactly what an org's audit view needs. Omit it only for a genuinely tenant-less operation.
   */
  readonly organizationId?: string;
  /** Populated only when the caller has a request context to read it from. */
  readonly ip?: string | undefined;
  readonly userAgent?: string | undefined;
  readonly requestId?: string | undefined;
  readonly sessionId?: string | undefined;
}
