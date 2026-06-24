import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateInvoicePDF } from "@/lib/email/pdf/generate";
import { getLogoDataUrl } from "@/lib/email/logo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // fs module needed for the logo, same as the webhook's PDF path

// On-demand re-generation of the same invoice PDF the booking confirmation
// email attaches — lets the Hub Assistant offer an immediate "view receipt"
// link after a chat-initiated booking instead of waiting on email delivery.
// Deliberately returns 404 (not 403) on a mismatched owner so a booking ID
// guess can't even confirm the booking exists.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const adminDb = createAdminClient();
  const { data: booking } = await adminDb
    .from("bookings")
    .select("id, member_id, start_date_time, end_date_time, booking_status, workspaces(name, price_per_hour)")
    .eq("id", bookingId)
    .single();

  if (!booking || booking.member_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (booking.booking_status !== "confirmed") {
    return NextResponse.json({ error: "Booking is not confirmed" }, { status: 400 });
  }

  const { data: payment } = await adminDb
    .from("payments")
    .select("amount, payment_date")
    .eq("booking_id", bookingId)
    .eq("payment_status", "paid")
    .maybeSingle();

  const { data: member } = await adminDb
    .from("members")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const workspace = booking.workspaces as unknown as
    | { name: string; price_per_hour: number }
    | null;

  const start = new Date(booking.start_date_time);
  const end = new Date(booking.end_date_time);
  const durationHours = (end.getTime() - start.getTime()) / 3_600_000;
  const totalAUD = payment?.amount ?? workspace?.price_per_hour
    ? (payment?.amount ?? (workspace!.price_per_hour * durationHours))
    : 0;

  const shortRef = `INV-${booking.id.slice(0, 8).toUpperCase()}`;
  const invoiceDateSource = payment?.payment_date ? new Date(payment.payment_date) : new Date();

  try {
    const pdfBuffer = await generateInvoicePDF({
      bookingRef: shortRef,
      invoiceDate: invoiceDateSource.toLocaleDateString("en-AU", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      memberName: member?.full_name ?? "Member",
      memberEmail: member?.email ?? user.email ?? "",
      roomName: workspace?.name ?? "Meeting Room",
      location: "Inspire9 Hub · Richmond",
      bookingDate: start.toLocaleDateString("en-AU", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      startTime: start.toLocaleTimeString("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      endTime: end.toLocaleTimeString("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      durationHours,
      hourlyRate: workspace?.price_per_hour ?? 0,
      totalAUD,
      logoDataUrl: getLogoDataUrl(),
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="inspire9-invoice-${shortRef}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[invoice] PDF generation failed:", err);
    return NextResponse.json({ error: "Could not generate invoice" }, { status: 500 });
  }
}
