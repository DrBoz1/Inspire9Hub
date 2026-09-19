"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getRefundPolicy, calcRefundCents } from "@/lib/refund-policy";
import { memberTotal } from "@/lib/billing/discount";
import { memberDiscountPercent } from "@/lib/billing/member-discount";
import { stampRow } from "@/lib/audit";
import { emailBookingCancelled } from "@/lib/email/booking-notices";
import type { CancelRefund } from "@/lib/email/templates/booking-cancelled";
import { checkBookingWindow, checkLookupWindow, isUuidLike, MAX_ACTIVE_HOLDS, staleHoldCutoff } from "@/lib/booking-rules";
import { hubLongDay, hubTime } from "@/lib/email/format";

export async function checkRoomAvailability(
  workspaceId: string,
  startISO: string,
  endISO: string,
): Promise<{ available: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // A public endpoint like every server action: members only, one room, one day at most.
  if (!user) return { available: false, error: "Sign in to check availability." };
  const window = checkLookupWindow(startISO, endISO);
  if (!isUuidLike(workspaceId) || !window.ok) return { available: false, error: "That time can’t be checked." };

  // Admin client so we see ALL bookings, not just the current user's (RLS would hide others).
  const adminDb = createAdminClient();

  // 1. Any confirmed booking overlapping this range is a hard block.
  const { data: confirmed, error: e1 } = await adminDb
    .from("bookings")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("booking_status", "confirmed")
    .lt("start_date_time", window.endISO)
    .gt("end_date_time", window.startISO)
    .limit(1);

  if (e1) return { available: false, error: "Database error during availability check." };
  if (confirmed && confirmed.length > 0) return { available: false };

  // 2. Pending holds from OTHER members block while their checkout is in progress.
  //    The current member's own hold is ignored, so they can start checkout again.
  //    A hold older than a checkout can last is left over and doesn't count; the
  //    next checkout for this slot releases it (see createCheckoutSession).
  const { data: pending, error: e2 } = await adminDb
    .from("bookings")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("booking_status", "pending")
    .neq("member_id", user.id)
    .gte("created_at", staleHoldCutoff(new Date()))
    .lt("start_date_time", window.endISO)
    .gt("end_date_time", window.startISO)
    .limit(1);
  if (e2) return { available: false, error: "Database error during availability check." };

  return { available: (pending ?? []).length === 0 };
}

// Exact-match allowlist for the post-payment redirect destination — NEVER
// interpolate a caller-supplied path directly into the Stripe success_url.
// An unvalidated path here would be an open-redirect vector once Stripe
// bounces the user's browser back to it after a real payment.
const SAFE_RETURN_PATHS = new Set(["/dashboard", "/support"]);

/**
 * Starts a room booking: holds the slot, then sends the member to Stripe.
 *
 * Everything that decides what happens is worked out here, never taken from the
 * browser: the room and its price from the database, the times checked against
 * opening hours (lib/booking-rules.ts), the text on the Stripe receipt written
 * from those. The browser's roomName, amount, date and times are only what it
 * showed the member.
 */
export async function createCheckoutSession(bookingData: {
  workspaceId: string;
  roomName: string;
  amount: number;
  date: string;
  startTime: string;
  endTime: string;
  startISO: string; // pre-computed UTC ISO from the browser (timezone-correct)
  endISO: string;
  returnTo?: string; // validated against SAFE_RETURN_PATHS below; defaults to /dashboard
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please log in to book a room.");

  // Server-side induction gate — blocks API-level bypass attempts
  const { data: member } = await supabase
    .from("members")
    .select("induction_status")
    .eq("id", user.id)
    .single();

  if (member?.induction_status !== "Complete") {
    throw new Error(
      member?.induction_status === "Submitted"
        ? "Your induction is still under review. Booking will unlock once approved."
        : "Complete your safety induction before booking a space.",
    );
  }

  const now = new Date();
  const checked = checkBookingWindow(bookingData.startISO, bookingData.endISO, now);
  if (!checked.ok) throw new Error(checked.error);
  const { startISO, endISO, hours: durationHours } = checked.value;

  if (!isUuidLike(bookingData.workspaceId)) throw new Error("Workspace not found.");
  // Price is read server-side from the workspace's stored price_per_hour —
  // the client's amount is display-only and never trusted for the actual charge.
  // select("*") because active and bookable only exist once the floor plan migration has run.
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", bookingData.workspaceId)
    .single();
  if (!workspace) throw new Error("Workspace not found.");
  if (workspace.active === false || workspace.bookable === false) throw new Error("This room isn’t open for booking.");
  const pricePerHour = Number(workspace.price_per_hour);
  if (!Number.isFinite(pricePerHour) || pricePerHour <= 0) throw new Error("This room doesn’t have a price yet. Ask the team.");

  // A member's plan can take a percentage off, looked up here like the price and
  // never taken from the browser. Without one, the charge is worked out exactly
  // as it always was.
  const discountPercent = await memberDiscountPercent(user.id);
  const serverAmount = discountPercent > 0 ? memberTotal(pricePerHour, durationHours, discountPercent) : pricePerHour * durationHours;

  const adminDb = createAdminClient();
  const staleCutoff = staleHoldCutoff(now);

  // Release this member's own earlier hold on the same slot (an abandoned checkout),
  // and any hold on it old enough to be left over from a checkout that ended
  // without Stripe telling us: otherwise that slot would stay blocked for good.
  const released = await adminDb
    .from("bookings")
    .update({ booking_status: "cancelled" })
    .eq("workspace_id", bookingData.workspaceId)
    .eq("booking_status", "pending")
    .lt("start_date_time", endISO)
    .gt("end_date_time", startISO)
    .or(`member_id.eq.${user.id},created_at.lt.${staleCutoff},created_at.is.null`)
    .select("id, member_id");
  for (const hold of released.data ?? []) {
    await stampRow("bookings", hold.id, {
      cancelled_at: now.toISOString(),
      cancel_reason: hold.member_id === user.id ? "Replaced by a new checkout for the same slot" : "Checkout hold expired",
    });
  }

  // One member can't hold the whole building: a few checkouts in progress at most.
  const { count: holding } = await adminDb
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("member_id", user.id)
    .eq("booking_status", "pending")
    .gte("created_at", staleCutoff);
  if ((holding ?? 0) >= MAX_ACTIVE_HOLDS) {
    throw new Error(`You have ${MAX_ACTIVE_HOLDS} checkouts in progress. Finish or cancel one before starting another.`);
  }

  // Final server-side conflict check
  const { available } = await checkRoomAvailability(bookingData.workspaceId, startISO, endISO);
  if (!available) throw new Error("This time slot is no longer available.");

  // Cinema-style: reserve the slot with a pending booking BEFORE Stripe redirect.
  // Uses the admin client to bypass RLS — the member_id is explicitly set to the
  // authenticated user so this is safe and auditable. Two members racing for the
  // same slot both get here; the bookings_no_overlap constraint lets exactly one in.
  const { data: booking, error: bookingError } = await adminDb
    .from("bookings")
    .insert({
      member_id: user.id,
      workspace_id: bookingData.workspaceId,
      start_date_time: startISO,
      end_date_time: endISO,
      booking_status: "pending",
    })
    .select()
    .single();

  if (bookingError || !booking) {
    // Surface the real DB error so it's debuggable, not a misleading "slot taken"
    console.error("[booking] Insert failed:", JSON.stringify(bookingError));
    // 23P01 is the overlap rule turning this one away. 40P01 is two members'
    // holds for the same slot waiting on each other at the same instant: Postgres
    // cancels one, the other wins, so for this member the slot has gone too.
    // (Both seen in the booking-rush test: 100 members, one slot, at once.)
    throw new Error(
      bookingError?.code === "23P01" || bookingError?.code === "40P01"
        ? "This slot was just reserved by someone else. Pick a different time."
        : "Could not reserve the slot. Please try again.",
    );
  }

  const unitAmount = Math.round(serverAmount * 100);
  const returnPath = SAFE_RETURN_PATHS.has(bookingData.returnTo ?? "")
    ? bookingData.returnTo!
    : "/dashboard";
  const roomName = String(workspace.name ?? "").trim() || "Meeting room";

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: {
              name: `${roomName} Booking`,
              description: `Date: ${hubLongDay(startISO)} | ${hubTime(startISO)} - ${hubTime(endISO)}${discountPercent ? ` | Member rate, ${discountPercent}% off` : ""}`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      expires_at: Math.floor(Date.now() / 1000) + 1800, // 30-min window
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}${returnPath}?status=success&bookingId=${booking.id}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/bookings?status=cancelled&bookingId=${booking.id}`,
      metadata: {
        userId: user.id,
        workspaceId: bookingData.workspaceId,
        bookingId: booking.id,
        startTime: startISO,
        endTime: endISO,
        // Only when there's a discount, so the invoice can show the rate that was charged.
        ...(discountPercent ? { discountPercent: String(discountPercent) } : {}),
      },
    });
  } catch {
    // Stripe failed: release the slot. The admin client, because members can't
    // update bookings: with their own client this silently did nothing, and with
    // no Stripe session there's no expiry to release it either, so it stayed held.
    await adminDb
      .from("bookings")
      .update({ booking_status: "cancelled" })
      .eq("id", booking.id);
    await stampRow("bookings", booking.id, { cancelled_at: new Date().toISOString(), cancel_reason: "Stripe couldn’t start the checkout" });
    throw new Error("Payment system unavailable. Please try again.");
  }

  return redirect(session.url!);
}


// Called when Stripe cancel URL is hit — releases the reserved pending slot
export async function cancelPendingBooking(bookingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Admin client bypasses the missing UPDATE RLS policy; member_id check enforces ownership
  const adminDb = createAdminClient();
  const { data: released } = await adminDb
    .from("bookings")
    .update({ booking_status: "cancelled" })
    .eq("id", bookingId)
    .eq("member_id", user.id)
    .eq("booking_status", "pending")
    .select("id");
  if (released?.length) {
    await stampRow("bookings", bookingId, { cancelled_at: new Date().toISOString(), cancelled_by: user.id, cancel_reason: "Checkout abandoned before payment" });
  }
}

// Self-service cancellation — cancels the booking and automatically processes
// whatever Stripe refund the policy entitles the member to.
export async function cancelConfirmedBooking(bookingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const adminDb = createAdminClient();

  const { data: booking } = await adminDb
    .from("bookings")
    .select("start_date_time, booking_status, member_id")
    .eq("id", bookingId)
    .single();

  if (!booking) return { error: "Booking not found." };
  if (booking.member_id !== user.id) return { error: "Not authorised." };
  if (new Date(booking.start_date_time) <= new Date())
    return { error: "Cannot cancel a booking that has already started or passed." };
  if (booking.booking_status === "cancelled")
    return { error: "This booking is already cancelled." };

  // Determine refund amount from policy BEFORE cancelling
  const policy = getRefundPolicy(booking.start_date_time);

  const { error: cancelErr } = await adminDb
    .from("bookings")
    .update({ booking_status: "cancelled" })
    .eq("id", bookingId);

  if (cancelErr) return { error: cancelErr.message };
  // Stamped after the cancel, so the audit columns can never block it.
  await stampRow("bookings", bookingId, { cancelled_at: new Date().toISOString(), cancelled_by: user.id, cancel_reason: `Cancelled by the member, ${policy.label.toLowerCase()}` });

  // What the cancellation email tells them about the money; the branches below fill it in.
  let refund: CancelRefund = policy.percent > 0 ? { kind: "unpaid" } : { kind: "late" };

  // Auto-process Stripe refund if the policy entitles the member to one
  if (policy.percent > 0) {
    const { data: payment } = await adminDb
      .from("payments")
      .select("id, amount, payment_status, stripe_payment_intent_id")
      .eq("booking_id", bookingId)
      .eq("payment_status", "paid")
      .maybeSingle();

    if (payment?.stripe_payment_intent_id) {
      const refundCents = calcRefundCents(payment.amount, policy.percent);
      try {
        await stripe.refunds.create({
          payment_intent: payment.stripe_payment_intent_id,
          amount: refundCents,
        });
        await adminDb
          .from("payments")
          .update({
            payment_status: "refunded",
            refunded_amount: refundCents / 100,
          })
          .eq("id", payment.id);
        await stampRow("payments", payment.id, { refunded_at: new Date().toISOString() });
        refund = { kind: "refunded", amountAUD: refundCents / 100, percent: policy.percent };
      } catch (err) {
        // Refund failed — flag the payment so it surfaces in the admin
        // bookings page, where the Issue Refund button can retry it.
        console.error("[cancel] Stripe refund error:", err);
        await adminDb
          .from("payments")
          .update({ payment_status: "refund_failed" })
          .eq("id", payment.id);
        refund = { kind: "pending", amountAUD: refundCents / 100, percent: policy.percent };
      }
    }
  }

  after(() => emailBookingCancelled(bookingId, "member", refund));

  revalidatePath("/bookings");
  revalidatePath("/history");
  revalidatePath("/dashboard");
  return { success: true, refundPolicy: policy };
}

// Looks up a booking by id, scoped to the current user — used by the
// post-payment success popup on the dashboard. Same trust model as
// getBookingConfirmation below: the ?bookingId in the URL only unlocks a
// lookup, never a write, and the lookup itself re-checks ownership.
export async function getBookingById(bookingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, booking_status, start_date_time, end_date_time, workspaces(name)")
    .eq("id", bookingId)
    .eq("member_id", user.id)
    .maybeSingle();
  if (!booking) return null;

  const { data: payment } = await supabase
    .from("payments")
    .select("amount")
    .eq("booking_id", bookingId)
    .eq("payment_status", "paid")
    .maybeSingle();

  return { ...booking, amount: payment?.amount ?? null };
}

// Verifies a booking belongs to the current user before reporting its status —
// used by the Hub Assistant to confirm a chat-initiated booking after the
// Stripe redirect back, without ever trusting the success URL on its own
// (the webhook is what actually confirms the booking; this just reads that
// result back, scoped to the authenticated owner).
export async function getBookingConfirmation(
  workspaceId: string,
  startISO: string,
  endISO: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("bookings")
    .select("id, booking_status")
    .eq("member_id", user.id)
    .eq("workspace_id", workspaceId)
    .eq("start_date_time", startISO)
    .eq("end_date_time", endISO)
    .neq("booking_status", "cancelled")
    .maybeSingle();

  return data;
}

// Booked time ranges for a room within one hub day, for the booking form's time
// list. Members only, one room, one day. Leftover holds (see createCheckoutSession)
// don't show as taken, because the next checkout releases them.
export async function getBookedSlotsForDate(
  roomId: string,
  dayStartUTC: string,
  dayEndUTC: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const window = checkLookupWindow(dayStartUTC, dayEndUTC);
  if (!user || !isUuidLike(roomId) || !window.ok) return [];

  const adminDb = createAdminClient();
  const { data } = await adminDb
    .from("bookings")
    .select("start_date_time, end_date_time")
    .eq("workspace_id", roomId)
    .in("booking_status", ["confirmed", "pending"])
    .or(`booking_status.eq.confirmed,created_at.gte.${staleHoldCutoff(new Date())}`)
    .gte("start_date_time", window.startISO)
    .lte("start_date_time", window.endISO)
    .order("start_date_time")
    .limit(200);
  return data ?? [];
}
