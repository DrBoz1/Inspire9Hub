"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { getRefundPolicy, calcRefundCents } from "@/lib/refund-policy";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { isUuid } from "@/lib/admin-compliance";

export type BookingActionResult = { success: boolean; error?: string; refunded?: boolean; message?: string };

const NOT_FOUND = "That booking couldn’t be found.";

function revalidateSchedule() {
  revalidatePath("/admin", "layout");
  revalidatePath("/bookings");
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Shared by both cancel actions. The caller has already passed the admin check. */
async function cancelBooking(bookingId: string): Promise<{ error?: string }> {
  if (!isUuid(bookingId)) return { error: NOT_FOUND };
  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("booking_status, start_date_time")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: NOT_FOUND };
  if (booking.booking_status === "cancelled") return { error: "This booking is already cancelled." };
  if (new Date(booking.start_date_time) <= new Date()) return { error: "This booking has already started, so it can’t be cancelled here." };

  const { data: updated, error } = await supabase
    .from("bookings")
    .update({ booking_status: "cancelled" })
    .eq("id", bookingId)
    .neq("booking_status", "cancelled")
    .select("id");
  if (error || !updated?.length) {
    console.error("[admin] cancel booking:", error?.message ?? "no rows updated");
    return { error: "Couldn’t cancel this booking. Please try again." };
  }
  return {};
}

export async function cancelBookingAsAdmin(bookingId: string): Promise<BookingActionResult> {
  const guard = await requireAdmin();
  if ("error" in guard) return { success: false, error: guard.error };

  const cancelled = await cancelBooking(bookingId);
  if (cancelled.error) return { success: false, error: cancelled.error };

  revalidateSchedule();
  return { success: true };
}

// Cancel + full refund in one action.
// Admin-initiated cancellations always warrant a 100% refund (the venue cancelled, not the member).
export async function cancelAndRefundBooking(bookingId: string): Promise<BookingActionResult> {
  const guard = await requireAdmin();
  if ("error" in guard) return { success: false, error: guard.error };

  const cancelled = await cancelBooking(bookingId);
  if (cancelled.error) return { success: false, error: cancelled.error };
  revalidateSchedule();

  const supabase = createAdminClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, amount, stripe_payment_intent_id")
    .eq("booking_id", bookingId)
    .eq("payment_status", "paid")
    .maybeSingle();

  if (!payment) return { success: true, refunded: false, message: "Booking cancelled. There was no payment to refund." };
  if (!payment.stripe_payment_intent_id) {
    return { success: true, refunded: false, message: "Booking cancelled. Refund the payment manually in the Stripe Dashboard." };
  }

  try {
    // The key makes a double click or retry return the same refund instead of a second one.
    await stripe.refunds.create({ payment_intent: payment.stripe_payment_intent_id }, { idempotencyKey: `admin-full-refund-${payment.id}` });
  } catch (err) {
    console.error("[admin] Stripe refund error:", errorMessage(err));
    return { success: true, refunded: false, error: `Booking cancelled, but the Stripe refund failed: ${errorMessage(err)}` };
  }

  const { error: recordError } = await supabase
    .from("payments")
    .update({ payment_status: "refunded", refunded_amount: payment.amount })
    .eq("id", payment.id);
  if (recordError) {
    console.error("[admin] refund record:", recordError.message);
    return { success: true, refunded: true, message: "Refunded in Stripe, but the payment record didn’t update. Check it in Stripe." };
  }

  revalidateSchedule();
  return { success: true, refunded: true };
}

export async function issueRefund(bookingId: string): Promise<BookingActionResult> {
  const guard = await requireAdmin();
  if ("error" in guard) return { success: false, error: guard.error };
  if (!isUuid(bookingId)) return { success: false, error: NOT_FOUND };

  const supabase = createAdminClient();
  const [{ data: booking }, { data: payment }] = await Promise.all([
    supabase.from("bookings").select("booking_status, start_date_time").eq("id", bookingId).maybeSingle(),
    // refund_failed: a member's own cancellation couldn't refund automatically; this is where it gets retried.
    supabase
      .from("payments")
      .select("id, amount, stripe_payment_intent_id")
      .eq("booking_id", bookingId)
      .in("payment_status", ["paid", "refund_failed"])
      .maybeSingle(),
  ]);

  if (!booking) return { success: false, error: NOT_FOUND };
  if (booking.booking_status !== "cancelled") return { success: false, error: "Cancel the booking before refunding it." };
  if (!payment) return { success: false, error: "There’s no payment to refund for this booking." };
  if (!payment.stripe_payment_intent_id) {
    return { success: false, error: "There’s no Stripe payment on record. Refund it manually in the Stripe Dashboard." };
  }

  // Industry-standard refund policy
  const policy = getRefundPolicy(booking.start_date_time);
  if (policy.percent === 0) {
    return { success: false, error: `No refund issued: ${policy.description} To override, use the Stripe Dashboard.` };
  }

  const refundCents = calcRefundCents(Number(payment.amount), policy.percent);
  try {
    await stripe.refunds.create(
      { payment_intent: payment.stripe_payment_intent_id, amount: refundCents },
      { idempotencyKey: `admin-refund-${payment.id}-${refundCents}` },
    );
  } catch (err) {
    console.error("[refund] Stripe error:", errorMessage(err));
    return { success: false, error: `Stripe refund failed: ${errorMessage(err)}` };
  }

  const { error: recordError } = await supabase
    .from("payments")
    .update({ payment_status: "refunded", refunded_amount: refundCents / 100 })
    .eq("id", payment.id);
  if (recordError) console.error("[refund] record:", recordError.message);

  revalidateSchedule();
  return { success: true, refunded: true, message: `${policy.label}: $${(refundCents / 100).toFixed(2)} returned.` };
}
