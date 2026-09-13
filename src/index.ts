import { loadConfig } from "./lib/config";
import { closeDb, createDb } from "./lib/db";
import { createAppWithDb } from "./server";

loadConfig();

const db = createDb();
const app = createAppWithDb({ db });

const config = loadConfig();

const server = Bun.serve({
  fetch: app.fetch,
  port: config.PORT,
});

console.log(`Server running on http://localhost:${config.PORT}`);

process.on("SIGTERM", async () => {
  server.stop();
  await closeDb();
  process.exit(0);
});
