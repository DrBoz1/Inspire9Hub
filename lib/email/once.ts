import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, type SendEmailOptions } from "./send";

export type OnceResult = "sent" | "already-sent" | "no-log" | "failed";

const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

/**
 * Sends an email at most once per key: the key is claimed in sent_emails first,
 * and only the caller that claims it sends. For emails driven by Stripe events,
 * which can arrive twice or out of order.
 *
 * Never throws: an email must never fail the thing it reports on. If the send
 * fails the claim is released, so a later event can try again. Without the
 * table (add_sent_emails.sql not run yet) nothing is sent, because there would
 * be no way to stop repeats: every update to a subscription would re-send its
 * welcome email.
 */
export async function sendOnce(key: string, kind: string, email: SendEmailOptions): Promise<OnceResult> {
  const db = createAdminClient();
  const recipient = Array.isArray(email.to) ? email.to.join(", ") : email.to;
  const { error: claimError } = await db.from("sent_emails").insert({ key, kind, recipient });
  if (claimError) {
    if (claimError.code === "23505") return "already-sent";
    if (MISSING_TABLE.has(claimError.code ?? "")) {
      console.warn(`[email] ${kind} held back: run add_sent_emails.sql so it can be sent once`);
      return "no-log";
    }
    console.error(`[email] ${kind} claim:`, claimError.message);
    return "failed";
  }
  try {
    await sendEmail(email);
    return "sent";
  } catch (err) {
    console.error(`[email] ${kind} send:`, err instanceof Error ? err.message : err);
    await db.from("sent_emails").delete().eq("key", key);
    return "failed";
  }
}

/** For emails a person's own action causes once, like a cancellation: sends, logs a failure, never throws. */
export async function sendQuietly(kind: string, email: SendEmailOptions): Promise<boolean> {
  try {
    await sendEmail(email);
    return true;
  } catch (err) {
    console.error(`[email] ${kind}:`, err instanceof Error ? err.message : err);
    return false;
  }
}
