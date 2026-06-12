import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import BookingConfirmation from "@/lib/email/templates/booking-confirmation";
import { generateInvoicePDF } from "@/lib/email/pdf/generate";
import { getLogoUrl, getLogoDataUrl } from "@/lib/email/logo";
import { getRoomPrice } from "@/lib/constants";
import { createElement } from "react";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const text = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(text, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[webhook] Signature verification failed:", message);
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 });
  }

  // ── Checkout expired: release the reserved pending slot ──────────────────
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.bookingId;
    if (bookingId) {
      const supabase = createAdminClient();
      await supabase
        .from("bookings")
        .update({ booking_status: "cancelled" })
        .eq("id", bookingId)
        .eq("booking_status", "pending");
      console.log("[webhook] Expired — released pending slot:", bookingId);
    }
    return NextResponse.json({ received: true });
  }

  // ── Only continue for payment success ────────────────────────────────────
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("[webhook] SUPABASE_SERVICE_ROLE_KEY is not set — get it from Supabase Dashboard → Project Settings → API → service_role (the long JWT starting with eyJ...)");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const { userId, workspaceId, bookingId, startTime, endTime } =
    session.metadata ?? {};

  console.log("[webhook] checkout.session.completed — metadata:", {
    userId, workspaceId, bookingId, startTime, endTime,
  });

  if (!userId || !workspaceId || !startTime || !endTime) {
    console.error("[webhook] Missing metadata in session:", session.id);
    return NextResponse.json({ error: "Missing booking metadata" }, { status: 400 });
  }

  const amount = (session.amount_total ?? 0) / 100;
  const supabase = createAdminClient();

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;

  // Idempotency guard — Stripe retries webhooks on timeout. If this payment
  // intent is already recorded, the event was fully processed before; ack and
  // skip so we never create duplicate payments, passes, or emails.
  if (paymentIntentId) {
    const { data: alreadyProcessed } = await supabase
      .from("payments")
      .select("id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();

    if (alreadyProcessed) {
      console.log("[webhook] Duplicate delivery ignored:", session.id);
      return NextResponse.json({ received: true });
    }
  }

  // 1. Confirm the pending booking (cinema-style: it already exists, just confirm it)
  let confirmedBooking: { id: string } | null = null;

  if (bookingId) {
    const { data, error } = await supabase
      .from("bookings")
      .update({ booking_status: "confirmed" })
      .eq("id", bookingId)
      .select("id")
      .single();

    if (error) {
      console.error("[webhook] Failed to confirm booking:", JSON.stringify(error));
      return NextResponse.json({ error: "Failed to confirm booking" }, { status: 500 });
    }
    confirmedBooking = data;
    console.log("[webhook] Booking confirmed:", confirmedBooking?.id);
  } else {
    // Fallback for sessions created before the atomic flow
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        member_id: userId,
        workspace_id: workspaceId,
        start_date_time: startTime,
        end_date_time: endTime,
        booking_status: "confirmed",
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("[webhook] Failed to insert booking:", JSON.stringify(error));
      return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
    }
    confirmedBooking = data;
    console.log("[webhook] Booking created (fallback):", confirmedBooking?.id);
  }

  // 2. Payment record — store payment_intent_id so admins can issue Stripe refunds later
  const { error: paymentError } = await supabase.from("payments").insert({
    member_id: userId,
    booking_id: confirmedBooking?.id,
    amount,
    payment_method: "card",
    payment_date: new Date().toISOString().split("T")[0],
    payment_status: "paid",
    stripe_payment_intent_id: paymentIntentId,
  });
  if (paymentError)
    console.error("[webhook] Payment insert error:", JSON.stringify(paymentError));

  // 3. Access pass (expires on booking day)
  const expiryDate = new Date(endTime).toISOString().split("T")[0];
  const { error: passError } = await supabase.from("access_passes").insert({
    member_id: userId,
    issued_date: new Date().toISOString().split("T")[0],
    expiry_date: expiryDate,
    pass_type: "room_booking",
    pass_status: "active",
  });
  if (passError)
    console.error("[webhook] Access pass error:", JSON.stringify(passError));

  // 4. Workspace name for activity log
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .single();

  const bookingDate = new Date(startTime).toLocaleDateString("en-AU", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // 5. Community entry (Recent Activity on dashboard)
  const { error: entryError } = await supabase.from("community_entries").insert({
    member_id: userId,
    entry_type: "Room Booking",
    entry_description: `Booked ${workspace?.name ?? "a room"} for ${bookingDate}.`,
    entry_date: new Date(startTime).toISOString().split("T")[0],
    tags: "Approved",
  });
  if (entryError)
    console.error("[webhook] Community entry error:", JSON.stringify(entryError));

  console.log("[webhook] All records created for session:", session.id);

  // 6. Send booking confirmation email with PDF invoice
  // Non-blocking — email failure must never fail the webhook response
  try {
    const { data: member } = await supabase
      .from("members")
      .select("full_name, email")
      .eq("id", userId)
      .single();

    if (member?.email) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      const durationHours = (end.getTime() - start.getTime()) / 3_600_000;
      const roomName = workspace?.name ?? "Meeting Room";
      const location = "Inspire9 Hub · Richmond";
      const hourlyRate = getRoomPrice(
        (() => {
          // derive capacity from room name via known mapping
          const cap: Record<string, number> = {
            "Dream Room": 4,
            "Elbow Room": 5,
            "Green Room": 5,
            "Boiler Room": 10,
            "Pool Room": 20,
          };
          return cap[roomName] ?? 5;
        })(),
      );

      const bookingDateFormatted = start.toLocaleDateString("en-AU", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const startTimeFormatted = start.toLocaleTimeString("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const endTimeFormatted = end.toLocaleTimeString("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const invoiceDate = new Date().toLocaleDateString("en-AU", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // Short booking reference shown to the user
      const shortRef = `INV-${confirmedBooking?.id?.slice(0, 8).toUpperCase()}`;

      const emailData = {
        memberName: member.full_name ?? "Member",
        memberEmail: member.email,
        roomName,
        location,
        bookingDate: bookingDateFormatted,
        startTime: startTimeFormatted,
        endTime: endTimeFormatted,
        durationHours,
        totalAUD: amount,
        bookingRef: shortRef,
        dashboardUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/bookings`,
        logoDataUrl: getLogoUrl(),
      };

      // Generate PDF invoice — if this fails, email still sends without attachment
      let pdfAttachment:
        | { filename: string; content: Buffer }
        | undefined;
      try {
        const pdfBuffer = await generateInvoicePDF({
          ...emailData,
          bookingRef: shortRef,
          invoiceDate,
          hourlyRate,
          logoDataUrl: getLogoDataUrl(),
        });
        pdfAttachment = {
          filename: `inspire9-invoice-${shortRef}.pdf`,
          content: pdfBuffer,
        };
      } catch (pdfErr) {
        console.error("[webhook] PDF generation failed (email will still send without attachment):", pdfErr);
      }

      // Send confirmation email — always attempted whether or not PDF succeeded
      await sendEmail({
        to: member.email,
        subject: `Booking Confirmed — ${roomName} · ${bookingDateFormatted}`,
        react: createElement(BookingConfirmation, emailData),
        attachments: pdfAttachment ? [pdfAttachment] : undefined,
      });

      console.log("[webhook] Confirmation email sent to:", member.email);
    }
  } catch (emailErr) {
    // Log but never throw — email failure must never roll back the booking
    console.error("[webhook] Email send failed:", emailErr);
  }

  return NextResponse.json({ received: true });
}
