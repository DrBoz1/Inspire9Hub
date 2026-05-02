import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;

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
  return NextResponse.json({ received: true });
}
