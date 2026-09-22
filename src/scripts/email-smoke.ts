/**
 * Send one real email through the configured transport — `bun run email:smoke -- --to <addr>`
 * (NWB-P1-004).
 *
 * The Phase 2 exit gate says *"email actually sends via Resend in a dev sandbox (evidence in
 * spec.md)"*. This is the evidence-producing command: it builds the transport exactly as the
 * server would (`createEmailTransport(loadConfig())`), bypasses the outbox (no queue, no worker,
 * no database — the point is the provider hop and nothing else) and prints the provider's message
 * id, which is what goes into the spec table. It refuses to run against the console transport
 * unless told to, because a smoke test that "passes" by printing to stdout proves nothing.
 *
 *   RESEND_API_KEY=re_… EMAIL_FROM="Nawebeus <no-reply@your-domain>" \
 *     bun run email:smoke -- --to you@example.com
 *
 * Options:
 *   --to <addr>        recipient (required)
 *   --kind <kind>      template kind to tag the message with (default `verification`)
 *   --allow-console    accept the console transport (prints instead of sending)
 */

import { loadConfig } from "../lib/config";
import { describeError } from "../lib/errors";
import {
  createEmailTransport,
  type EmailKind,
  maskRecipients,
  toEnvelope,
} from "../services/email";

const USAGE = `usage: bun run email:smoke -- --to <address> [--kind <kind>] [--allow-console]

Sends one message through the transport config selects (RESEND_API_KEY + EMAIL_FROM → Resend;
otherwise the console, which this command refuses without --allow-console).`;

const KINDS: readonly EmailKind[] = [
  "verification",
  "password_reset",
  "email_change",
  "mfa_enabled",
  "invitation",
];

interface SmokeArgs {
  readonly to: string;
  readonly kind: EmailKind;
  readonly allowConsole: boolean;
}

export function parseSmokeArgs(argv: readonly string[]): SmokeArgs | { readonly error: string } {
  let to: string | undefined;
  let kind: EmailKind = "verification";
  let allowConsole = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--to") {
      to = argv[i + 1];
      i += 1;
    } else if (arg === "--kind") {
      const value = argv[i + 1];
      i += 1;
      if (!value || !(KINDS as readonly string[]).includes(value)) {
        return { error: `--kind must be one of ${KINDS.join(", ")}` };
      }
      kind = value as EmailKind;
    } else if (arg === "--allow-console") {
      allowConsole = true;
    } else if (arg === "-h" || arg === "--help") {
      return { error: "" };
    } else {
      return { error: `unknown argument: ${arg}` };
    }
  }

  if (!to || !to.includes("@")) return { error: "--to <address> is required" };
  return { to, kind, allowConsole };
}

async function main(): Promise<void> {
  const parsed = parseSmokeArgs(process.argv.slice(2));
  if ("error" in parsed) {
    if (parsed.error) console.error(`[email:smoke] ${parsed.error}\n`);
    console.log(USAGE);
    process.exitCode = parsed.error ? 1 : 0;
    return;
  }

  const config = loadConfig();
  if (config.EMAIL_PROVIDER_RESOLVED === "console" && !parsed.allowConsole) {
    console.error(
      "[email:smoke] no real transport configured: set RESEND_API_KEY and EMAIL_FROM (the console transport proves nothing; pass --allow-console to use it anyway)",
    );
    process.exitCode = 1;
    return;
  }

  const transport = createEmailTransport(config);
  const envelope = toEnvelope({
    kind: parsed.kind,
    to: parsed.to,
    subject: `Nawebeus email smoke test (${parsed.kind})`,
    html: `<h2>Nawebeus email smoke test</h2>
<p>This message was sent by <code>bun run email:smoke</code> at ${new Date().toISOString()} through the <strong>${transport.name}</strong> transport.</p>
<p>If you are reading it, DEC-028's transport works end to end for this deployment.</p>`,
    text: `Nawebeus email smoke test, sent through the ${transport.name} transport at ${new Date().toISOString()}.`,
  });

  console.log(
    `[email:smoke] sending ${envelope.messageId} (${envelope.kind}) to ${maskRecipients(envelope.to)} via ${transport.name} (${config.EMAIL_PROVIDER_RESOLVED === "resend" ? config.RESEND_API_BASE_URL : "stdout"})`,
  );
  const started = performance.now();
  const receipt = await transport.send(envelope);
  const ms = Math.round(performance.now() - started);
  console.log(
    `[email:smoke] accepted by ${receipt.provider} in ${ms}ms — provider id ${receipt.providerMessageId ?? "(none returned)"}, our id ${envelope.messageId}`,
  );
  console.log(
    "[email:smoke] evidence line for spec.md: " +
      `${new Date().toISOString().slice(0, 10)} · ${receipt.provider} · ${receipt.providerMessageId ?? envelope.messageId} · ${maskRecipients(envelope.to)}`,
  );
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(`[email:smoke] failed: ${describeError(error)}`);
    process.exitCode = 1;
  });
}
