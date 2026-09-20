// @ts-nocheck

/**
 * TanStack Start server entry — mounts Hono at `/api/*`.
 *
 * ADR-002: TanStack Start + Hono as a single deployable service.
 * ADR-007: Single deployable service with two entry points.
 *
 * The Start server handles:
 *   - SSR, file-based routing (`src/app/routes/*`), and Server Functions
 *     (`src/app/server-functions/*` → `src/services/*` in-process, no HTTP hop)
 *   - All requests whose path starts with `/api/` are forwarded to the Hono app
 *     from `src/server/api/*` (mobile, webhooks, third-party).
 *
 * This satisfies Principle 3 (Direct Calls): the web app never calls `/api/*`
 * for its own operations — it calls Server Functions which invoke `services/`
 * directly. The Hono API exists solely for the mobile app and external callers.
 */

import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start";
import { createRouter } from "./router";
import { createApp } from "@/server";

/**
 * Hono app for the API entry point. In production the same `services/` are
 * shared — the Start handler below forwards `/api/*` here, so there is exactly
 * one `services/` implementation and zero duplication.
 *
 * Tests keep using `createAppWithDb()` directly via `src/tests/helpers/test-client.ts`.
 *
 * Single deployable (ADR-007): TanStack Start serves SSR + Server Functions,
 * Hono serves `/api/*`. Both live in one Bun process.
 */
const honoApp = createApp();
const startHandler = createStartHandler({
  createRouter,
})(defaultStreamHandler);

// TanStack Start handler with Hono mounted at `/api/*` (ADR-002).
// Requests for mobile / webhooks / third-party go to Hono; everything else
// goes through Start's SSR + Server Functions.
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return honoApp.fetch(request);
    }
    return startHandler(request as never) as unknown as Promise<Response>;
  },
};
