// @ts-nocheck

import { defineConfig } from "@tanstack/react-start/config";
import tsConfigPaths from "vite-tsconfig-paths";

/**
 * TanStack Start configuration — single deployable service (ADR-007).
 *
 * The Start server handles SSR and Server Functions (web). Hono is mounted
 * at `/api/*` inside the same process (ADR-002) for mobile / webhooks.
 * Both entry points share `src/services/*` via direct in-process calls
 * (Principle 3: Direct Calls — no HTTP hop for web).
 *
 * @see docs/technical/ADRs.md#adr-002
 * @see docs/technical/Architecture.md#5.1
 */
export default defineConfig({
  vite: {
    plugins: [
      tsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
    ],
  },
  // Hono mount is done in the custom server entry `src/app/start.ts` via
  // `createStartHandler({ createRouter })` — all `/api/*` requests are
  // forwarded to the Hono app from `src/server/api/*`.
  server: {
    preset: "bun",
  },
});
