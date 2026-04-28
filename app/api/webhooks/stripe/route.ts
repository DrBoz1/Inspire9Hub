import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export async function POST(request: NextRequest) {
  const text = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      text,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const userId = session.metadata?.userId;
    const workspaceId = session.metadata?.workspaceId;
    const startTime = session.metadata?.startTime;
    const endTime = session.metadata?.endTime;

    if (!userId || !workspaceId || !startTime || !endTime) {
      console.error("Missing metadata in Stripe session:", session.id);
      return NextResponse.json({ error: "Missing booking metadata" }, { status: 400 });
    }

    const amount = (session.amount_total ?? 0) / 100;
    const supabase = createAdminClient();

    // 1. Insert booking record
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        member_id: userId,
        workspace_id: workspaceId,
        start_date_time: startTime,
        end_date_time: endTime,
        booking_status: "confirmed",
      })
      .select()
      .single();

    if (bookingError || !booking) {
      console.error("Failed to insert booking:", bookingError);
      return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
    }

    // 2. Insert payment record
    const { error: paymentError } = await supabase.from("payments").insert({
      member_id: userId,
      booking_id: booking.id,
      amount,
      payment_method: "card",
      payment_date: new Date().toISOString().split("T")[0],
      payment_status: "paid",
    });

    if (paymentError) {
      console.error("Failed to insert payment:", paymentError);
    }

    // 3. Insert access pass (valid for the booking day)
    const expiryDate = new Date(endTime).toISOString().split("T")[0];
    const { error: passError } = await supabase.from("access_passes").insert({
      member_id: userId,
      issued_date: new Date().toISOString().split("T")[0],
      expiry_date: expiryDate,
      pass_type: "room_booking",
      pass_status: "active",
    });

    if (passError) {
      console.error("Failed to insert access pass:", passError);
    }

    // 4. Fetch workspace name for the activity log
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

    // 5. Log community entry (shows in dashboard Recent Activity)
    const { error: entryError } = await supabase.from("community_entries").insert({
      member_id: userId,
      entry_type: "Room Booking",
      entry_description: `Booked ${workspace?.name ?? "a room"} for ${bookingDate}.`,
      entry_date: new Date(startTime).toISOString().split("T")[0],
      tags: "Approved",
    });

    if (entryError) {
      console.error("Failed to insert community entry:", entryError);
    }
  }

  return NextResponse.json({ received: true });
}
