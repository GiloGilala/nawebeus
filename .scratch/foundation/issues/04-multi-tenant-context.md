# 04 — Multi-tenant context middleware

**What to build:** The organization scoping layer that ensures every authenticated request is automatically associated with the correct organization. An AsyncLocalStorage context is populated from the JWT's `orgId` claim on every request. Service functions call `getOrgContext()` instead of parsing headers or cookies. After this ticket, no service function needs to know how the org ID was authenticated — it's always available from context.

**Blocked by:** 03 — Auth: signin + sessions + JWT

**Status:** done

- [x] `OrgContext` type: `{ orgId: string; userId: string }`
- [x] AsyncLocalStorage instance created and wrapped with `run(requestId, ctx, handler)`
- [x] Middleware: extracts `orgId` from JWT (already verified by auth middleware), stores in AsyncLocalStorage
- [x] `getOrgContext()` helper: returns current `OrgContext` or throws if not in a request context
- [x] All existing service functions updated to use `getOrgContext()` instead of receiving orgId as a parameter
- [x] Integration test: authenticated request to test route returns `orgId` from context in response body
- [x] Integration test: request without auth context throws appropriate error
