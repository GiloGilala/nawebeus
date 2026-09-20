// @ts-nocheck

import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * TanStack Start router — file-based routing (ADR-002).
 *
 * Routes live in `src/app/routes/*` and call Server Functions from
 * `src/app/server-functions/*` directly in-process, not via `fetch("/api")`.
 * Hono at `/api/*` (mounted in `src/app/start.ts`) remains for mobile.
 */
export function createRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
  });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
