import { createClient } from "@/lib/supabase/server";
import BookingClient from "./BookingClient";
import { cancelPendingBooking } from "./actions";

export default async function BookingsPage(props: {
  searchParams: Promise<{ status?: string; bookingId?: string }>;
}) {
  const searchParams = await props.searchParams;

  // Release the reserved slot when the user cancels Stripe checkout
  if (searchParams.status === "cancelled" && searchParams.bookingId) {
    await cancelPendingBooking(searchParams.bookingId);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Fetch real rooms from DB
  const { data: dbRooms } = await supabase
    .from("workspaces")
    .select("*")
    .order("capacity", { ascending: true });

  // 2. Fetch existing bookings
  const { data: userBookings } = await supabase
    .from("bookings")
    .select(
      `
      *,
      workspaces (name, capacity)
    `,
    )
    .eq("member_id", user?.id)
    .neq("booking_status", "cancelled")
    .order("start_date_time", { ascending: true });

  return (
    <div className="space-y-10 font-poppins pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase italic">
          Reserve <span className="text-[#E31E24]">Space</span>
        </h1>
        <p className="text-slate-500 font-medium max-w-xl">
          Book meeting rooms and workspaces across the Inspire9 Hub. Real-time
          availability for members only.
        </p>
      </div>

      {/* Pass the DB rooms here instead of ROOMS constant */}
      <BookingClient
        initialBookings={userBookings || []}
        rooms={dbRooms || []}
      />
    </div>
  );
}
