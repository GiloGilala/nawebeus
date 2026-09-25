/**
 * Request-scope impersonation context (NWB-P1-011).
 *
 * A third AsyncLocalStorage, alongside `org-context.ts` (who is acting, and in
 * which organization) and `request-context.ts` (which request this is). The
 * three scopes do not coincide and never will:
 *
 * - audit rows are written by workers and the CLI, where there is no request
 *   and no impersonation, but an organization may still be known;
 * - a request may be unauthenticated (signup, signin) — org unknown;
 * - and exactly one shape of request is *impersonated*: one whose access token
 *   was minted for an admin acting inside another account (NWB-P1-011). During
 *   such a request the org context belongs to the **target**, while the audit
 *   trail must name the **admin** — the whole point of the impersonation audit
 *   trail is that the human behind the action is never laundered away.
 *
 * The middleware enters this scope (`runWithImpersonationContext`) only for a
 * verified impersonation token whose `impersonation_sessions` row is still
 * live; `writeAuditLog` is the consumer (`currentImpersonationContext`), which
 * uses it to retag the row. Like the request id, the context never throws when
 * absent — "not impersonating" is the normal state of almost every request.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface ImpersonationContext {
  /** The `impersonation_sessions` row id (`imp_…`) — lands in `unified_audit_log.impersonation_session_id`. */
  readonly impersonationSessionId: string;
  /** The admin whose credentials started the session — becomes `actor_id` on audited writes. */
  readonly adminUserId: string;
  /** The account being impersonated — defaults `target_user_id` on audited writes. */
  readonly impersonatedUserId: string;
}

const store = new AsyncLocalStorage<ImpersonationContext>();

/** Run `fn` with `ctx` as the current request's impersonation scope. */
export function runWithImpersonationContext<T>(ctx: ImpersonationContext, fn: () => T): T {
  return store.run(ctx, fn);
}

/**
 * The current request's impersonation scope, or `undefined` when this is not an
 * impersonated request (the overwhelmingly normal case). Never throws.
 */
export function currentImpersonationContext(): ImpersonationContext | undefined {
  return store.getStore();
}
