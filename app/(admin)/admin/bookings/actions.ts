"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { getRefundPolicy, calcRefundCents } from "@/lib/refund-policy";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { isUuid } from "@/lib/admin-compliance";
import { formatLongDay, formatRange } from "@/lib/admin-dashboard";
import { recordAudit, stampRow, type AuditActor } from "@/lib/audit";
import { emailBookingCancelled, emailRefundIssued } from "@/lib/email/booking-notices";

export type BookingActionResult = { success: boolean; error?: string; refunded?: boolean; message?: string };

const NOT_FOUND = "That booking couldn’t be found.";

type CancelledBooking = { room: string; start: string; end: string };

/** "Dream Room, Tuesday 16 September 9:00 am – 11:00 am" */
function describeBooking(b: CancelledBooking) {
  return `${b.room}, ${formatLongDay(new Date(b.start))} ${formatRange(b.start, b.end)}`;
}

function revalidateSchedule() {
  revalidatePath("/admin", "layout");
  revalidatePath("/bookings");
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Shared by both cancel actions. The caller has already passed the admin check. */
async function cancelBooking(
  bookingId: string,
  actor: AuditActor,
  reason: string,
): Promise<{ error?: string; booking?: CancelledBooking }> {
  if (!isUuid(bookingId)) return { error: NOT_FOUND };
  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("booking_status, start_date_time, end_date_time, workspaces(name)")
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
  // booking_status is overwritten in place, so without these the timing and the
  // actor are lost for good. Stamped after, so they can never block the cancel.
  await stampRow("bookings", bookingId, { cancelled_at: new Date().toISOString(), cancelled_by: actor?.id ?? null, cancel_reason: reason });

  // Supabase returns an embedded relation as an object or a one-item array.
  const room = Array.isArray(booking.workspaces) ? booking.workspaces[0] : booking.workspaces;
  return {
    booking: {
      room: (room as { name?: string | null } | null)?.name?.trim() || "Room",
      start: booking.start_date_time,
      end: booking.end_date_time,
    },
  };
}

export async function cancelBookingAsAdmin(bookingId: string): Promise<BookingActionResult> {
  const guard = await requireAdmin();
  if ("error" in guard) return { success: false, error: guard.error };
  const actor = { id: guard.user.id, email: guard.user.email };

  const cancelled = await cancelBooking(bookingId, actor, "Cancelled by an admin, no refund issued");
  if (cancelled.error || !cancelled.booking) return { success: false, error: cancelled.error ?? NOT_FOUND };

  await recordAudit({
    actor,
    action: "booking.cancel",
    entity: "booking",
    entityId: bookingId,
    summary: `Cancelled ${describeBooking(cancelled.booking)} without a refund`,
    meta: { refunded: false },
  });

  after(async () => {
    const { data: paid } = await createAdminClient().from("payments").select("id").eq("booking_id", bookingId).eq("payment_status", "paid").maybeSingle();
    await emailBookingCancelled(bookingId, "team", paid ? { kind: "none" } : { kind: "unpaid" });
  });

  revalidateSchedule();
  return { success: true };
}

// Cancel + full refund in one action.
// Admin-initiated cancellations always warrant a 100% refund (the venue cancelled, not the member).
export async function cancelAndRefundBooking(bookingId: string): Promise<BookingActionResult> {
  const guard = await requireAdmin();
  if ("error" in guard) return { success: false, error: guard.error };
  const actor = { id: guard.user.id, email: guard.user.email };

  const cancelled = await cancelBooking(bookingId, actor, "Cancelled by an admin with a full refund");
  if (cancelled.error || !cancelled.booking) return { success: false, error: cancelled.error ?? NOT_FOUND };
  const description = describeBooking(cancelled.booking);
  revalidateSchedule();

  const supabase = createAdminClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, amount, stripe_payment_intent_id")
    .eq("booking_id", bookingId)
    .eq("payment_status", "paid")
    .maybeSingle();

  if (!payment) {
    after(() => emailBookingCancelled(bookingId, "team", { kind: "unpaid" }));
    await recordAudit({ actor, action: "booking.cancel", entity: "booking", entityId: bookingId, summary: `Cancelled ${description}, nothing had been paid`, meta: { refunded: false } });
    return { success: true, refunded: false, message: "Booking cancelled. There was no payment to refund." };
  }
  // Owed in full whatever happens next; staff finish it by hand if Stripe can't.
  const owed = { amountAUD: Number(payment.amount), percent: 100 };
  if (!payment.stripe_payment_intent_id) {
    after(() => emailBookingCancelled(bookingId, "team", { kind: "pending", ...owed }));
    await recordAudit({ actor, action: "booking.cancel", entity: "booking", entityId: bookingId, summary: `Cancelled ${description}, refund must be issued by hand in Stripe`, meta: { refunded: false, paymentId: payment.id } });
    return { success: true, refunded: false, message: "Booking cancelled. Refund the payment manually in the Stripe Dashboard." };
  }

  try {
    // The key makes a double click or retry return the same refund instead of a second one.
    await stripe.refunds.create({ payment_intent: payment.stripe_payment_intent_id }, { idempotencyKey: `admin-full-refund-${payment.id}` });
  } catch (err) {
    console.error("[admin] Stripe refund error:", errorMessage(err));
    after(() => emailBookingCancelled(bookingId, "team", { kind: "pending", ...owed }));
    await recordAudit({ actor, action: "booking.cancel", entity: "booking", entityId: bookingId, summary: `Cancelled ${description}, but the Stripe refund failed`, meta: { refunded: false, paymentId: payment.id, error: errorMessage(err) } });
    return { success: true, refunded: false, error: `Booking cancelled, but the Stripe refund failed: ${errorMessage(err)}` };
  }

  // The money has gone back whether or not the record below saves.
  after(() => emailBookingCancelled(bookingId, "team", { kind: "refunded", ...owed }));

  const { error: recordError } = await supabase
    .from("payments")
    .update({ payment_status: "refunded", refunded_amount: payment.amount })
    .eq("id", payment.id);
  if (!recordError) await stampRow("payments", payment.id, { refunded_at: new Date().toISOString() });
  if (recordError) {
    console.error("[admin] refund record:", recordError.message);
    await recordAudit({ actor, action: "booking.cancel_refund", entity: "booking", entityId: bookingId, summary: `Refunded ${description} in Stripe, but the payment record didn’t update`, meta: { refunded: true, paymentId: payment.id, amount: Number(payment.amount) } });
    return { success: true, refunded: true, message: "Refunded in Stripe, but the payment record didn’t update. Check it in Stripe." };
  }

  await recordAudit({ actor, action: "booking.cancel_refund", entity: "booking", entityId: bookingId, summary: `Cancelled ${description} and refunded $${Number(payment.amount).toFixed(2)} in full`, meta: { refunded: true, paymentId: payment.id, amount: Number(payment.amount) } });

  revalidateSchedule();
  return { success: true, refunded: true };
}

export async function issueRefund(bookingId: string): Promise<BookingActionResult> {
  const guard = await requireAdmin();
  if ("error" in guard) return { success: false, error: guard.error };
  if (!isUuid(bookingId)) return { success: false, error: NOT_FOUND };
  const actor = { id: guard.user.id, email: guard.user.email };

  const supabase = createAdminClient();
  const [{ data: booking }, { data: payment }] = await Promise.all([
    supabase.from("bookings").select("booking_status, start_date_time, end_date_time, workspaces(name)").eq("id", bookingId).maybeSingle(),
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

  after(() => emailRefundIssued(bookingId, refundCents / 100, policy.percent));

  const { error: recordError } = await supabase
    .from("payments")
    .update({ payment_status: "refunded", refunded_amount: refundCents / 100 })
    .eq("id", payment.id);
  if (recordError) console.error("[refund] record:", recordError.message);
  else await stampRow("payments", payment.id, { refunded_at: new Date().toISOString() });

  const room = Array.isArray(booking.workspaces) ? booking.workspaces[0] : booking.workspaces;
  await recordAudit({
    actor,
    action: "booking.refund",
    entity: "payment",
    entityId: payment.id,
    summary: `Refunded $${(refundCents / 100).toFixed(2)} (${policy.label}) on ${describeBooking({ room: (room as { name?: string | null } | null)?.name?.trim() || "Room", start: booking.start_date_time, end: booking.end_date_time })}`,
    meta: { bookingId, percent: policy.percent, amount: refundCents / 100, recorded: !recordError },
  });

  revalidateSchedule();
  return { success: true, refunded: true, message: `${policy.label}: $${(refundCents / 100).toFixed(2)} returned.` };
}
