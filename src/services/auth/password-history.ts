import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { PASSWORD_RULES } from "../../lib/password";
import { hashPassword } from "./password";

export async function recordPasswordChange(
  db: NodePgDatabase<Record<string, any>>,
  userId: string,
  newPlaintextPassword: string,
): Promise<string> {
  const now = new Date().toISOString();

  const historyRows = await db.execute<{ password_history: string[] | null }>(
    sql`SELECT password_history FROM users WHERE id = ${userId} LIMIT 1`,
  );
  const rawHistory = ((historyRows as any).rows?.[0] as any)?.password_history;

  // Defensive for the same reason as `isPasswordInHistory`: if this column
  // holds a bare string (the F-28 corruption), spreading it would splice the
  // hash into individual *characters* and silently destroy the history.
  const currentHistory: string[] = Array.isArray(rawHistory)
    ? rawHistory.filter((h) => typeof h === "string")
    : [];

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
  const raw = ((historyRows as any).rows?.[0] as any)?.password_history;

  // `password_history` is jsonb and has held non-array values in the past: the
  // change-password path once wrote a bare hash string here (F-28). A row of
  // bad data must not make password reset unrecoverable, so anything that is
  // not an array of strings is treated as "no history" rather than iterated.
  const history: string[] = Array.isArray(raw) ? raw.filter((h) => typeof h === "string") : [];

  for (const hash of history) {
    // A malformed or foreign-algorithm hash makes Bun.password.verify *throw*,
    // not return false. Left unguarded that propagates out of the reset flow
    // and locks the user out of account recovery entirely — the single stored
    // string in F-28 did exactly that. A hash we cannot parse simply does not
    // match; skip it and keep checking the rest.
    try {
      if (await Bun.password.verify(plaintextPassword, hash)) return true;
    } catch {
      // unparseable history entry — cannot match, so ignore it
    }
  }
  return false;
}
