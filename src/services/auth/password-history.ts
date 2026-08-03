import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { hashPassword } from "./password";
import { PASSWORD_RULES } from "../../lib/password";

export async function recordPasswordChange(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  newPlaintextPassword: string,
): Promise<string> {
  const now = new Date().toISOString();

  const historyRows = await db.execute<{ password_history: string[] | null }>(
    sql`SELECT password_history FROM users WHERE id = ${userId} LIMIT 1`,
  );
  const currentHistory = ((historyRows as any).rows?.[0] as any)?.password_history ?? [];

  const newHash = await hashPassword(newPlaintextPassword);

  const updated = [newHash, ...currentHistory].slice(0, PASSWORD_RULES.HISTORY_SIZE);

  await db.execute(
    sql`UPDATE users SET password = ${newHash}, password_history = ${JSON.stringify(updated)}::jsonb, last_password_change_at = ${now} WHERE id = ${userId}`,
  );

  return newHash;
}

export async function isPasswordInHistory(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  plaintextPassword: string,
): Promise<boolean> {
  const historyRows = await db.execute<{ password_history: string[] | null }>(
    sql`SELECT password_history FROM users WHERE id = ${userId} LIMIT 1`,
  );
  const history = ((historyRows as any).rows?.[0] as any)?.password_history ?? [];

  for (const hash of history) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ok = await Bun.password.verify(plaintextPassword, hash);
    if (ok) return true;
  }
  return false;
}
