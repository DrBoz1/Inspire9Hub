import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const adminDb = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const [roomsRes, bookingsRes, todayBookingsRes] = await Promise.all([
    // All rooms
    supabase.from("workspaces").select("*").order("capacity", { ascending: true }),

    // Member's own bookings for My Schedule tab
    supabase
      .from("bookings")
      .select("*, workspaces (name, capacity)")
      .eq("member_id", user?.id)
      .neq("booking_status", "cancelled")
      .order("start_date_time", { ascending: true }),

    // Today's bookings across all rooms (for availability badges)
    adminDb
      .from("bookings")
      .select("workspace_id")
      .neq("booking_status", "cancelled")
      .gte("start_date_time", `${today}T00:00:00Z`)
      .lte("start_date_time", `${today}T23:59:59Z`),
  ]);

  // Set of room IDs that have at least one booking today
  const busyRoomIds = new Set(
    (todayBookingsRes.data ?? []).map((b: any) => b.workspace_id),
  );

  const rooms = (roomsRes.data ?? []).map((room) => ({
    ...room,
    busyToday: busyRoomIds.has(room.id),
  }));

  return (
    <div className="space-y-10 font-poppins pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">
          Reserve <span className="text-[#E31E24]">Space</span>
        </h1>
        <p className="text-slate-500 font-medium max-w-xl">
          Book meeting rooms and workspaces across the Inspire9 Hub. Real-time
          availability for members only.
        </p>
      </div>

      <BookingClient
        initialBookings={bookingsRes.data || []}
        rooms={rooms}
      />
    </div>
  );
}
