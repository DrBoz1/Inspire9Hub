"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Stripe from "stripe";

export async function checkRoomAvailability(
  workspaceId: string,
  startISO: string,
  endISO: string,
) {
  const supabase = await createClient();

  //Here I search for any existing booking that overlaps with these times
  const { data: conflicts, error } = await supabase
    .from("bookings")
    .select("id")
    .eq("workspace_id", workspaceId)
    .neq("booking_status", "cancelled")
    .lt("start_date_time", endISO)
    .gt("end_date_time", startISO);

  if (error) {
    return { error: "Database error during availability check." };
  }

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

  //cuz stripe prices are in cents for some reason
  const unitAmount = Math.round(bookingData.amount * 100);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "aud", // Australia specific
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
    //where the user gets redirected for payment or smth idk me tired bruh frick stripe
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard?status=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/bookings?status=cancelled`,
    metadata: {
      userId: user.id,
      workspaceId: bookingData.workspaceId,
      startTime: `${bookingData.date}T${bookingData.startTime}:00Z`,
      endTime: `${bookingData.date}T${bookingData.endTime}:00Z`,
    },
  });

  return redirect(session.url!);
}
