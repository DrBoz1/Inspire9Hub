"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { getRefundPolicy, calcRefundCents } from "@/lib/refund-policy";
import { revalidatePath } from "next/cache";

export async function cancelBookingAsAdmin(bookingId: string) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("bookings")
    .update({ booking_status: "cancelled" })
    .eq("id", bookingId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  return { success: true };
}

// Cancel + full refund in one action.
// Admin-initiated cancellations always warrant a 100% refund (the venue cancelled, not the member).
export async function cancelAndRefundBooking(bookingId: string) {
  const supabase = createAdminClient();

  // Cancel the booking first
  const { error: cancelErr } = await supabase
    .from("bookings")
    .update({ booking_status: "cancelled" })
    .eq("id", bookingId);

  if (cancelErr) return { success: false, error: cancelErr.message };

  // Look up the paid payment record
  const { data: payment } = await supabase
    .from("payments")
    .select("id, amount, payment_status, stripe_payment_intent_id")
    .eq("booking_id", bookingId)
    .eq("payment_status", "paid")
    .maybeSingle();

  if (!payment) {
    // Booking cancelled but no paid payment to refund
    revalidatePath("/admin/bookings");
    revalidatePath("/admin");
    return { success: true, refunded: false, message: "Booking cancelled. No paid payment found." };
  }

  if (!payment.stripe_payment_intent_id) {
    revalidatePath("/admin/bookings");
    revalidatePath("/admin");
    return {
      success: true,
      refunded: false,
      message: "Booking cancelled. Refund the payment manually via Stripe Dashboard.",
    };
  }

  // Full refund — admin cancellations always get 100% back
  try {
    await stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
    });

    await supabase
      .from("payments")
      .update({
        payment_status: "refunded",
        refunded_amount: payment.amount, // full refund
      })
      .eq("id", payment.id);

    revalidatePath("/admin/bookings");
    revalidatePath("/admin");
    return { success: true, refunded: true };
  } catch (err: any) {
    console.error("[admin] Stripe refund error:", err.message);
    return {
      success: true,
      refunded: false,
      error: `Booking cancelled but Stripe refund failed: ${err.message}`,
    };
  }
}

// Returns the refund policy for a booking so the UI can show it before confirming
export async function getBookingRefundPolicy(bookingId: string) {
  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("start_date_time")
    .eq("id", bookingId)
    .single();

  if (!booking) return null;
  return getRefundPolicy(booking.start_date_time);
}

export async function issueRefund(bookingId: string) {
  const supabase = createAdminClient();

  // Fetch booking + payment in parallel
  const [{ data: booking }, { data: payment }] = await Promise.all([
    supabase
      .from("bookings")
      .select("start_date_time")
      .eq("id", bookingId)
      .single(),
    supabase
      .from("payments")
      .select("id, amount, payment_status, stripe_payment_intent_id")
      .eq("booking_id", bookingId)
      .eq("payment_status", "paid")
      .single(),
  ]);

  if (!payment) return { error: "No paid payment found for this booking." };
  if (!payment.stripe_payment_intent_id) {
    return {
      error:
        "Payment intent ID not on record — process this refund manually in the Stripe Dashboard.",
    };
  }

  // Apply industry-standard refund policy
  const policy = booking
    ? getRefundPolicy(booking.start_date_time)
    : { percent: 100 as const, label: "Full Refund", description: "", color: "" };

  if (policy.percent === 0) {
    // Policy says no refund — admins can override via Stripe Dashboard
    return {
      error: `Refund not issued: ${policy.description} To override, use the Stripe Dashboard.`,
    };
  }

  const refundCents = calcRefundCents(payment.amount, policy.percent);

  try {
    await stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
      amount: refundCents,
    });
  } catch (err: any) {
    console.error("[refund] Stripe error:", err.message);
    return { error: `Stripe refund failed: ${err.message}` };
  }

  await supabase
    .from("payments")
    .update({
      payment_status: "refunded",
      refunded_amount: refundCents / 100, // store in dollars to match amount column
    })
    .eq("id", payment.id);

  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  return { success: true, policy };
}
