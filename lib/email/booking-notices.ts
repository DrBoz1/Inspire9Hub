import { createElement } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { hubLongDay, hubTime } from "./format";
import { siteUrl, teamInbox } from "./links";
import { getLogoUrl } from "./logo";
import { sendOnce, sendQuietly } from "./once";
import BookingCancelled, { type CancelRefund } from "./templates/booking-cancelled";
import RefundIssued from "./templates/refund-issued";

/**
 * Emails about a booking after something changed it. Server only. Called from
 * after(), once the member or admin already has their answer, so a slow or
 * failing email never holds up or undoes the change. Never throws.
 */

type One<T> = T | T[] | null;
const one = <T,>(value: One<T>): T | null => (Array.isArray(value) ? (value[0] ?? null) : value);

async function bookingFacts(bookingId: string) {
  const { data, error } = await createAdminClient()
    .from("bookings")
    .select("start_date_time, end_date_time, workspaces(name), members(full_name, email)")
    .eq("id", bookingId)
    .maybeSingle();
  if (error || !data) {
    console.error("[email] booking lookup:", error?.message ?? `no booking ${bookingId}`);
    return null;
  }
  const member = one(data.members as One<{ full_name: string | null; email: string | null }>);
  if (!member?.email) return null;
  return {
    memberName: member.full_name?.trim() || "Member",
    memberEmail: member.email,
    roomName: one(data.workspaces as One<{ name: string | null }>)?.name?.trim() || "Meeting room",
    start: data.start_date_time as string,
    end: data.end_date_time as string,
  };
}

export async function emailBookingCancelled(bookingId: string, cancelledBy: "member" | "team", refund: CancelRefund) {
  const booking = await bookingFacts(bookingId);
  if (!booking) return;
  const bookingDate = hubLongDay(booking.start);
  await sendQuietly("booking cancelled", {
    to: booking.memberEmail,
    replyTo: teamInbox(),
    subject: `Booking cancelled: ${booking.roomName}, ${bookingDate}`,
    react: createElement(BookingCancelled, {
      memberName: booking.memberName,
      memberEmail: booking.memberEmail,
      roomName: booking.roomName,
      bookingDate,
      startTime: hubTime(booking.start),
      endTime: hubTime(booking.end),
      cancelledBy,
      refund,
      bookingsUrl: siteUrl("/bookings"),
      logoDataUrl: getLogoUrl(),
    }),
  });
}

/**
 * Payment went through for a slot another member had just taken, so it was
 * refunded in full. Sent once per checkout: Stripe may deliver the event twice.
 */
export async function emailSlotTaken(bookingId: string, amountAUD: number, checkoutSessionId: string) {
  const booking = await bookingFacts(bookingId);
  if (!booking) return;
  const bookingDate = hubLongDay(booking.start);
  await sendOnce(`booking.slot_taken:${checkoutSessionId}`, "booking.slot_taken", {
    to: booking.memberEmail,
    replyTo: teamInbox(),
    subject: `We couldn’t hold ${booking.roomName} for you, refunded in full`,
    react: createElement(BookingCancelled, {
      memberName: booking.memberName,
      memberEmail: booking.memberEmail,
      roomName: booking.roomName,
      bookingDate,
      startTime: hubTime(booking.start),
      endTime: hubTime(booking.end),
      cancelledBy: "team",
      refund: { kind: "refunded", amountAUD, percent: 100 },
      reason: "someone else booked this room in the moments before your payment went through, so we couldn’t confirm it. We’ve refunded you in full; sorry about that.",
      bookingsUrl: siteUrl("/bookings"),
      logoDataUrl: getLogoUrl(),
    }),
  });
}

export async function emailRefundIssued(bookingId: string, amountAUD: number, percent: number) {
  const booking = await bookingFacts(bookingId);
  if (!booking) return;
  const bookingDate = hubLongDay(booking.start);
  await sendQuietly("refund issued", {
    to: booking.memberEmail,
    replyTo: teamInbox(),
    subject: `Refund on its way: ${booking.roomName}, ${bookingDate}`,
    react: createElement(RefundIssued, {
      memberName: booking.memberName,
      memberEmail: booking.memberEmail,
      roomName: booking.roomName,
      bookingDate,
      amountAUD,
      percent,
      bookingsUrl: siteUrl("/bookings"),
      logoDataUrl: getLogoUrl(),
    }),
  });
}
