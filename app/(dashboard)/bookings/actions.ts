"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getRefundPolicy, calcRefundCents } from "@/lib/refund-policy";

export async function checkRoomAvailability(
  workspaceId: string,
  startISO: string,
  endISO: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Admin client so we see ALL bookings, not just the current user's (RLS would hide others).
  const adminDb = createAdminClient();

  // 1. Any confirmed booking overlapping this range is a hard block.
  const { data: confirmed, error: e1 } = await adminDb
    .from("bookings")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("booking_status", "confirmed")
    .lt("start_date_time", endISO)
    .gt("end_date_time", startISO);

  if (e1) return { error: "Database error during availability check." };
  if (confirmed && confirmed.length > 0) return { available: false };

  // 2. Pending holds from OTHER users block (their checkout is in progress).
  //    The current user's own pending is ignored — they can re-initiate checkout.
  //    Stale-pending cleanup relies on Stripe's checkout.session.expired webhook.
  let pendingQuery = adminDb
    .from("bookings")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("booking_status", "pending")
    .lt("start_date_time", endISO)
    .gt("end_date_time", startISO);

  if (user?.id) pendingQuery = pendingQuery.neq("member_id", user.id);

  const { data: pending, error: e2 } = await pendingQuery;
  if (e2) return { error: "Database error during availability check." };

  return { available: (pending ?? []).length === 0 };
}

// Exact-match allowlist for the post-payment redirect destination — NEVER
// interpolate a caller-supplied path directly into the Stripe success_url.
// An unvalidated path here would be an open-redirect vector once Stripe
// bounces the user's browser back to it after a real payment.
const SAFE_RETURN_PATHS = new Set(["/dashboard", "/support"]);

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

  // Use the timezone-correct UTC ISOs built by the browser
  const { startISO, endISO } = bookingData;

  // Server-side validation
  const startMs = new Date(startISO).getTime();
  const endMs = new Date(endISO).getTime();
  if (startMs >= endMs) throw new Error("Start time must be before end time.");
  if (endMs - startMs < 3600000) throw new Error("Minimum booking is 1 hour.");
  if (startMs < Date.now()) throw new Error("Cannot book a time that has already passed.");

  // Price is read server-side from the workspace's stored price_per_hour —
  // the client's amount is display-only and never trusted for the actual charge.
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("price_per_hour")
    .eq("id", bookingData.workspaceId)
    .single();
  if (!workspace) throw new Error("Workspace not found.");

  const durationHours = (endMs - startMs) / 3600000;
  const serverAmount = workspace.price_per_hour * durationHours;

  // Final server-side conflict check
  const { available } = await checkRoomAvailability(
    bookingData.workspaceId,
    startISO,
    endISO,
  );
  if (!available) throw new Error("This time slot is no longer available.");

  // Cinema-style: reserve the slot with a pending booking BEFORE Stripe redirect.
  // Uses the admin client to bypass RLS — the member_id is explicitly set to the
  // authenticated user so this is safe and auditable.
  const adminDb = createAdminClient();

  // Cancel any previous pending hold this user has on the same slot (e.g. from an
  // abandoned checkout) before inserting a fresh one, so we don't hit a DB constraint.
  await adminDb
    .from("bookings")
    .update({ booking_status: "cancelled" })
    .eq("member_id", user.id)
    .eq("workspace_id", bookingData.workspaceId)
    .eq("booking_status", "pending")
    .lt("start_date_time", endISO)
    .gt("end_date_time", startISO);

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
    throw new Error(
      bookingError?.code === "23P01"
        ? "This slot was just reserved by someone else. Pick a different time."
        : "Could not reserve the slot. Please try again.",
    );
  }

  const unitAmount = Math.round(serverAmount * 100);
  const returnPath = SAFE_RETURN_PATHS.has(bookingData.returnTo ?? "")
    ? bookingData.returnTo!
    : "/dashboard";

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: {
              name: `${bookingData.roomName} Booking`,
              description: `Date: ${bookingData.date} | ${bookingData.startTime} - ${bookingData.endTime}`,
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
      },
    });
  } catch {
    // Stripe failed — release the reserved slot
    await supabase
      .from("bookings")
      .update({ booking_status: "cancelled" })
      .eq("id", booking.id);
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
  await adminDb
    .from("bookings")
    .update({ booking_status: "cancelled" })
    .eq("id", bookingId)
    .eq("member_id", user.id)
    .eq("booking_status", "pending");
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
      } catch (err) {
        // Refund failed — flag the payment so it surfaces in the admin
        // bookings page, where the Issue Refund button can retry it.
        console.error("[cancel] Stripe refund error:", err);
        await adminDb
          .from("payments")
          .update({ payment_status: "refund_failed" })
          .eq("id", payment.id);
      }
    }
  }

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

// Batched availability check across every room for one time window — powers
// the assistant's "here's what's free then" suggestion when a member hasn't
// named a specific room yet. Same conflict rules as checkRoomAvailability
// (confirmed always blocks; pending blocks unless it's the current user's
// own hold), just aggregated in two queries instead of one per room.
export async function getBusyRoomIds(startISO: string, endISO: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminDb = createAdminClient();

  const { data: confirmed } = await adminDb
    .from("bookings")
    .select("workspace_id")
    .eq("booking_status", "confirmed")
    .lt("start_date_time", endISO)
    .gt("end_date_time", startISO);

  let pendingQuery = adminDb
    .from("bookings")
    .select("workspace_id")
    .eq("booking_status", "pending")
    .lt("start_date_time", endISO)
    .gt("end_date_time", startISO);
  if (user?.id) pendingQuery = pendingQuery.neq("member_id", user.id);
  const { data: pending } = await pendingQuery;

  const busy = new Set<string>();
  for (const b of confirmed ?? []) busy.add(b.workspace_id);
  for (const b of pending ?? []) busy.add(b.workspace_id);
  return Array.from(busy);
}

// Returns booked time ranges for a room within a UTC day window.
// dayStartUTC and dayEndUTC are computed in the browser so they're timezone-correct.
export async function getBookedSlotsForDate(
  roomId: string,
  dayStartUTC: string,
  dayEndUTC: string,
) {
  const adminDb = createAdminClient();
  const { data } = await adminDb
    .from("bookings")
    .select("start_date_time, end_date_time")
    .eq("workspace_id", roomId)
    .neq("booking_status", "cancelled")
    .gte("start_date_time", dayStartUTC)
    .lte("start_date_time", dayEndUTC)
    .order("start_date_time");
  return data ?? [];
}
