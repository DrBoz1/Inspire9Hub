import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Is the hub actually working?
 *
 * Built for an uptime monitor: it answers 200 when a member could use the site
 * and 503 when they couldn't, so a check every few minutes notices an outage
 * before anyone has to report one. A page loading is not proof of much — the
 * thing that breaks is usually the database behind it — so this does one real
 * read.
 *
 * It says what is wrong, never why: no error messages, no counts, nothing about
 * the data. This endpoint is public, and a health check is a favourite place to
 * go looking for stack traces.
 */
const TIMEOUT_MS = 4000;

export async function GET() {
  const checks: Record<string, boolean> = {
    database: await databaseReachable(),
    // Configuration, not a call: pinging Stripe on every health check would
    // spend rate limit on something a monitor can't fix anyway.
    payments: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    email: Boolean(process.env.RESEND_API_KEY),
  };
  const ok = Object.values(checks).every(Boolean);
  return NextResponse.json(
    { ok, checks, time: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

/** One tiny read. A wedged connection fails the check rather than hanging the monitor. */
async function databaseReachable(): Promise<boolean> {
  try {
    const { error } = await createAdminClient()
      .from("workspaces")
      .select("id")
      .limit(1)
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS));
    if (error) console.error("[health] database:", error.message);
    return !error;
  } catch (err) {
    console.error("[health] database:", err instanceof Error ? err.message : err);
    return false;
  }
}
