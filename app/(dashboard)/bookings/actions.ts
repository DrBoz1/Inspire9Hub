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
  const { data: conflicts, error } = await supabase
    .from("bookings")
    .select("id")
    .eq("workspace_id", workspaceId)
    .neq("booking_status", "cancelled")
    .lt("start_date_time", endISO)
    .gt("end_date_time", startISO);

  if (error) return { error: "Database error during availability check." };
  return { available: conflicts.length === 0 };
}

export async function createCheckoutSession(bookingData: {
  workspaceId: string;
  roomName: string;
  amount: number;
  date: string;
  startTime: string;
  endTime: string;
  startISO: string; // pre-computed UTC ISO from the browser (timezone-correct)
  endISO: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please log in to book a room.");

  // Use the timezone-correct UTC ISOs built by the browser
  const { startISO, endISO } = bookingData;

  // Server-side validation
  const startMs = new Date(startISO).getTime();
  const endMs = new Date(endISO).getTime();
  if (startMs >= endMs) throw new Error("Start time must be before end time.");
  if (endMs - startMs < 3600000) throw new Error("Minimum booking is 1 hour.");
  if (startMs < Date.now()) throw new Error("Cannot book a time that has already passed.");

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

  const unitAmount = Math.round(bookingData.amount * 100);

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
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?status=success`,
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
        // Refund attempt failed — log but don't block the cancellation
        console.error("[cancel] Stripe refund error:", err);
      }
    }
  }

  revalidatePath("/bookings");
  revalidatePath("/history");
  revalidatePath("/dashboard");
  return { success: true, refundPolicy: policy };
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
