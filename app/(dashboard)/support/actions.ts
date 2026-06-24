"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { getLogoUrl } from "@/lib/email/logo";
import SupportRequest from "@/lib/email/templates/support-request";
import { summarizePayments } from "@/lib/member-stats";
import { createElement } from "react";

const VALID_TOPICS = [
  "Booking Issue",
  "Payments & Refunds",
  "Induction",
  "Access Pass",
  "General Enquiry",
];

export async function sendSupportRequest(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in to contact support." };

  const topic = (formData.get("topic") as string)?.trim();
  const message = (formData.get("message") as string)?.trim();

  if (!VALID_TOPICS.includes(topic)) return { error: "Please pick a topic." };
  if (!message || message.length < 10)
    return { error: "Tell us a little more — at least 10 characters." };
  if (message.length > 2000)
    return { error: "Message is too long (max 2000 characters)." };

  const { data: member } = await supabase
    .from("members")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const memberName = member?.full_name || "Member";
  const memberEmail = member?.email || user.email || "unknown";

  try {
    await sendEmail({
      to: process.env.SUPPORT_INBOX || "hello@inspire9.com",
      subject: `[Support] ${topic} — ${memberName}`,
      react: createElement(SupportRequest, {
        memberName,
        memberEmail,
        topic,
        message,
        logoDataUrl: getLogoUrl(),
      }),
    });
  } catch (err) {
    console.error("[support] Email failed:", err);
    return { error: "Could not send your message. Please try again." };
  }

  return { success: true };
}

export async function getAssistantContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [memberRes, paymentsRes, bookingsRes, passesRes, roomsRes] = await Promise.all([
    supabase
      .from("members")
      .select("full_name, induction_status, member_status")
      .eq("id", user.id)
      .single(),
    supabase
      .from("payments")
      .select("amount, refunded_amount, payment_status, payment_date")
      .eq("member_id", user.id),
    supabase
      .from("bookings")
      .select("booking_status, start_date_time, end_date_time, workspaces(name)")
      .eq("member_id", user.id)
      .order("start_date_time", { ascending: true }),
    supabase
      .from("access_passes")
      .select("id", { count: "exact", head: true })
      .eq("member_id", user.id)
      .eq("pass_status", "active"),
    // Needed so the assistant can match room names, show feature summaries,
    // and quote prices for conversational bookings without an extra
    // round-trip per message.
    supabase
      .from("workspaces")
      .select("id, name, location, capacity, price_per_hour, amenities")
      .order("capacity", { ascending: true }),
  ]);

  const member = memberRes.data;
  const payments = paymentsRes.data ?? [];
  const bookings = bookingsRes.data ?? [];
  const rooms = (roomsRes.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    location: r.location,
    capacity: r.capacity,
    pricePerHour: r.price_per_hour,
    amenities: r.amenities ?? [],
  }));

  const { totalPaid, totalRefunded, netSpend } = summarizePayments(payments);

  const now = Date.now();
  const active = bookings.filter(
    (b) => b.booking_status === "confirmed" || b.booking_status === "pending",
  );
  const cancelled = bookings.filter((b) => b.booking_status === "cancelled");
  const upcoming = active
    .filter((b) => new Date(b.start_date_time).getTime() > now)
    .map((b) => ({
      room:
        (b.workspaces as unknown as { name: string } | null)?.name ??
        "Meeting Room",
      startISO: b.start_date_time,
      endISO: b.end_date_time,
      status: b.booking_status as string,
    }));

  return {
    firstName: member?.full_name?.split(" ")[0] || "there",
    memberSince: user.created_at,
    inductionStatus: member?.induction_status || "Pending",
    memberStatus: member?.member_status || "Inactive",
    totalPaid,
    totalRefunded,
    netSpend,
    payments: payments.map((p) => ({
      amount: Number(p.amount) || 0,
      refunded: Number(p.refunded_amount) || 0,
      status: p.payment_status ?? "unknown",
      dateISO: p.payment_date ?? null,
    })),
    confirmedBookings: bookings.filter((b) => b.booking_status === "confirmed")
      .length,
    cancelledBookings: cancelled.length,
    upcomingBookings: upcoming,
    activePasses: passesRes.count ?? 0,
    rooms,
  };
}
