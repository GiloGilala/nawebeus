/**
 * Run one job now — `bun run queue:run <queue-name> ['{"json":"data"}']` (NWB-P1-001).
 *
 * The operator path that `bun run db:reclaim-rate-limits` used to be, with two differences that
 * are the whole point of the ticket: it goes through `runJobGuarded`, so a manual run writes the
 * **same audit events** as a scheduled one (an operator's purge is still a purge), and it covers
 * the retention jobs the old script could not reach. Unknown names fail with the list, never with
 * a silent zero.
 */

import { MAINTENANCE_JOBS, runMaintenanceJob } from "../jobs";
import { loadConfig } from "../lib/config";
import { closeDb, createDb } from "../lib/db";
import { describeError } from "../lib/errors";

const USAGE = `usage: bun run queue:run <queue-name> ['{json}']

Queues:
${MAINTENANCE_JOBS.map((job) => `  ${job.name.padEnd(44)}${job.description}`).join("\n")}
`;

function parseData(raw: string | undefined): Record<string, unknown> | null {
  if (raw === undefined) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`job data must be a JSON object, could not parse: ${raw}`);
  }
  if (parsed === null) return null;
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("job data must be a JSON object (or null)");
  }
  return parsed as Record<string, unknown>;
}

async function main(): Promise<void> {
  const [name, dataArg] = process.argv.slice(2);

  if (!name || name === "--list" || name === "-h" || name === "--help") {
    console.log(USAGE);
    if (!name) process.exitCode = 1;
    return;
  }

  const data = parseData(dataArg);

  loadConfig();
  const db = createDb();
  try {
    const result = await runMaintenanceJob(name, data, { db });
    console.log(
      `[queue:run] ${name} → ${result ? JSON.stringify(result) : "ok (no result reported)"}`,
    );
  } finally {
    await closeDb();
  }
}

main().catch((error: unknown) => {
  // A CLI has no log pipeline to be subtle for: print the message and the stack, exit 1.
  console.error(
    `[queue:run] failed: ${describeError(error)}`,
    error instanceof Error && error.stack ? `\n${error.stack}` : "",
  );
  process.exitCode = 1;
});
