import { AsyncLocalStorage } from "node:async_hooks";

export interface OrgContext {
  orgId: string;
  userId: string;
}

const als = new AsyncLocalStorage<OrgContext>();

export function runWithOrgContext<T>(ctx: OrgContext, fn: () => T): T {
  return als.run(ctx, fn);
}

export function getOrgContext(): OrgContext {
  const ctx = als.getStore();
  if (!ctx) throw new Error("No org context available — not in a request scope");
  return ctx;
}
