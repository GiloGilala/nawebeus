import { createTestDb } from "../../lib/db";
import type { Db } from "../../lib/db";

export { createTestDb };

export interface TestDbContext {
  db: Db;
  done: () => Promise<void>;
}

export async function withTestDb<T>(
  fn: (ctx: TestDbContext) => Promise<T>,
  databaseUrl?: string,
): Promise<T> {
  const ctx = await createTestDb(databaseUrl);
  try {
    return await fn(ctx);
  } finally {
    await ctx.done();
  }
}
