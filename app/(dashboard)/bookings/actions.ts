"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";

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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export async function createCheckoutSession(bookingData: {
  workspaceId: string;
  roomName: string;
  amount: number;
  date: string;
  startTime: string;
  endTime: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please log in to book a room.");

  const startISO = `${bookingData.date}T${bookingData.startTime}:00Z`;
  const endISO = `${bookingData.date}T${bookingData.endTime}:00Z`;

  // Server-side validation
  const startMs = new Date(startISO).getTime();
  const endMs = new Date(endISO).getTime();
  if (startMs >= endMs) throw new Error("Start time must be before end time.");
  if (endMs - startMs < 3600000) throw new Error("Minimum booking is 1 hour.");

  const bookingDay = new Date(bookingData.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (bookingDay < today) throw new Error("Cannot book dates in the past.");

  // Final server-side conflict check
  const { available } = await checkRoomAvailability(
    bookingData.workspaceId,
    startISO,
    endISO,
  );
  if (!available) throw new Error("This time slot is no longer available.");

  // Cinema-style: reserve the slot with a pending booking BEFORE Stripe redirect.
  // The DB exclusion constraint makes this atomic — if two requests race, only one succeeds.
  const { data: booking, error: bookingError } = await supabase
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
    throw new Error(
      "This slot was just taken by someone else. Please choose a different time.",
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

  await supabase
    .from("bookings")
    .update({ booking_status: "cancelled" })
    .eq("id", bookingId)
    .eq("member_id", user.id)
    .eq("booking_status", "pending");
}

// Self-service cancellation for confirmed/upcoming bookings
export async function cancelConfirmedBooking(bookingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: booking } = await supabase
    .from("bookings")
    .select("start_date_time, booking_status")
    .eq("id", bookingId)
    .eq("member_id", user.id)
    .single();

  if (!booking) return { error: "Booking not found." };
  if (new Date(booking.start_date_time) <= new Date())
    return { error: "Cannot cancel a booking that has already started or passed." };
  if (booking.booking_status === "cancelled")
    return { error: "This booking is already cancelled." };

  const { error } = await supabase
    .from("bookings")
    .update({ booking_status: "cancelled" })
    .eq("id", bookingId)
    .eq("member_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/bookings");
  revalidatePath("/history");
  revalidatePath("/dashboard");
  return { success: true };
}
