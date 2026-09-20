import { defineConfig } from "drizzle-kit";
import { resolveDbCredentials } from "./src/lib/db-config";

// `DATABASE_URL` is the single source of truth for the connection (NWB-P0-009).
// The DB_* variables remain as a fallback (and are cross-checked against the
// URL when both are set) — see src/lib/db-config.ts.
const db = resolveDbCredentials(process.env);

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  verbose: true,
  strict: true,

  dbCredentials: {
    url: db.url,
  },
});
