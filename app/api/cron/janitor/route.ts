import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { cronAuthorised } from "@/lib/cron-auth";
import { holdCutoff, splitHolds, sweepIsUnusual, sweepSummary, type PendingHold } from "@/lib/janitor";
import { notifyStaff } from "@/lib/notify-staff";
import { hubLongDay, hubTime } from "@/lib/email/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The nightly sweep.
 *
 * Bookings normally tidy themselves: Stripe's expiry event releases an abandoned
 * hold, and checkout ignores stale ones anyway. This is the belt to that pair of
 * braces — if the expiry event ever stops arriving, nothing else would ever
 * notice, and the pending rows would pile up in members' lists and the admin
 * schedule looking like real bookings.
 *
 * It is deliberately conservative: it cancels only unpaid holds that are past
 * the grace window, and a hold with a payment against it is never touched, only
 * reported. Read the rules in lib/janitor.ts; they're tested there.
 */
async function sweep(dryRun: boolean) {
  const db = createAdminClient();
  const now = new Date();

  const { data, error } = await db
    .from("bookings")
    .select("id, member_id, start_date_time, created_at")
    .eq("booking_status", "pending")
    .lt("created_at", holdCutoff(now))
    .limit(500);
  if (error) {
    console.error("[janitor] reading holds:", error.message);
    return { ok: false as const, error: "Couldn’t read the pending holds." };
  }

  const holds: PendingHold[] = (data ?? []).map((row) => ({
    id: row.id as string,
    memberId: (row.member_id as string | null) ?? null,
    startISO: (row.start_date_time as string | null) ?? null,
    createdISO: (row.created_at as string | null) ?? null,
  }));

  // Paid is asked, never assumed: a booking with any payment row is left alone.
  let paid = new Set<string>();
  if (holds.length) {
    const { data: payments, error: paymentError } = await db
      .from("payments")
      .select("booking_id")
      .in("booking_id", holds.map((h) => h.id));
    if (paymentError) {
      console.error("[janitor] reading payments:", paymentError.message);
      return { ok: false as const, error: "Couldn’t check which holds were paid for." };
    }
    paid = new Set((payments ?? []).map((p) => p.booking_id as string));
  }

  const { release, stranded } = splitHolds(holds, paid);

  let released = 0;
  if (release.length && !dryRun) {
    const { data: cancelled, error: cancelError } = await db
      .from("bookings")
      .update({
        booking_status: "cancelled",
        cancelled_at: now.toISOString(),
        cancel_reason: "Checkout was never finished",
      })
      .in("id", release.map((h) => h.id))
      .eq("booking_status", "pending") // still pending a moment ago; don't fight a live webhook
      .select("id");
    if (cancelError) {
      console.error("[janitor] releasing holds:", cancelError.message);
      return { ok: false as const, error: "Couldn’t release the holds." };
    }
    released = cancelled?.length ?? 0;
  } else {
    released = release.length;
  }

  const summary = sweepSummary(released, stranded.length);
  console.log(`[janitor] ${dryRun ? "dry run: " : ""}${summary}`);

  if (!dryRun) {
    // Money in, booking not confirmed: the one thing here a person must see.
    if (stranded.length) {
      await notifyStaff({
        kind: "booking-unconfirmed",
        headline: `${stranded.length} paid booking${stranded.length === 1 ? " is" : "s are"} still waiting to be confirmed`,
        ref: stranded.map((h) => h.id).join(","),
        facts: Object.fromEntries(
          stranded.slice(0, 5).map((h) => [
            `Booking ${h.id.slice(0, 8)}`,
            h.startISO ? `${hubLongDay(h.startISO)}, ${hubTime(h.startISO)}` : "no start time",
          ]),
        ),
        action: "Check the Stripe event for each one. If the payment went through, confirm the booking in Admin → Booking schedule; if it didn't, refund it and tell the member.",
      }, now);
    }
    // A pile of abandoned holds at once usually means the expiry event stopped arriving.
    if (sweepIsUnusual(released)) {
      await notifyStaff({
        kind: "janitor",
        headline: `${released} abandoned holds released in one night`,
        facts: { Released: released, "Usual night": "one or two" },
        action: "Check the Stripe webhook is still enabled and that checkout.session.expired is one of its events. Bookings are confirmed through the same endpoint.",
      }, now);
    }
  }

  return { ok: true as const, dryRun, released, stranded: stranded.length, summary };
}

/**
 * Vercel Cron, nightly. With ?dryRun=true it reports what it would do and
 * changes nothing, which is how to check it against real data safely.
 */
export async function GET(request: NextRequest) {
  if (!cronAuthorised(request.headers.get("authorization"))) {
    console.warn("[janitor] unauthorised GET");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sweep(new URL(request.url).searchParams.get("dryRun") === "true");
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

/** An admin running it by hand, with ?dryRun=true to see what it would do. */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: 403 });
  const result = await sweep(new URL(request.url).searchParams.get("dryRun") === "true");
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
