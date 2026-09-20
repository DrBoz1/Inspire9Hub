import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import BookingClient from "./BookingClient";
import { withMemberRates } from "@/lib/billing/discount";
import { memberDiscountPercent } from "@/lib/billing/member-discount";
import { cancelPendingBooking } from "./actions";
import { INDUCTION_STATUS } from "@/lib/constants";
import { Clock, ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { getLocalDayBoundsUTC, HUB_TIMEZONE } from "@/lib/datetime";
import BookingsHero from "./BookingsHero";
import { DayPassCard } from "./DayPassCard";
import { getDayPassOffer } from "./day-passes";
import { roomsOnly } from "@/lib/spaces";
import { todayIn } from "@/features/booking-map/zoned-time";

export default async function BookingsPage(props: {
  searchParams: Promise<{ status?: string; bookingId?: string }>;
}) {
  const searchParams = await props.searchParams;

  // Release the reserved slot when the user cancels Stripe checkout
  if (searchParams.status === "cancelled" && searchParams.bookingId) {
    await cancelPendingBooking(searchParams.bookingId);
  }

  const supabase = await createClient();
  const user = await getCurrentUser();

  // Fetch profile to check induction status before anything else
  const { data: profile } = await supabase
    .from("members")
    .select("induction_status, full_name")
    .eq("id", user?.id)
    .single();

  const inductionStatus = profile?.induction_status;
  const isInducted = inductionStatus === INDUCTION_STATUS.COMPLETE;
  const isUnderReview = inductionStatus === INDUCTION_STATUS.SUBMITTED;

  // ── Induction gate — block non-inducted members ──────────────────────────
  if (!isInducted) {
    return <div className="hub-page">
      <div className="hub-page-heading"><div><p className="hub-eyebrow">Make room for good work</p><h1>Your next great meeting<span className="hub-red">.</span></h1><p>Get ready to make yourself at home.</p></div></div>
      <div className="hub-empty-state hub-surface">{isUnderReview ? <Clock size={30} strokeWidth={1.3} /> : <Lock size={30} strokeWidth={1.3} />}
        <h3>{isUnderReview ? "Your induction is with the team." : "A small step before you settle in."}</h3>
        <p className="max-w-md">{isUnderReview ? "Booking opens once your induction is approved. You'll receive an email when the team has reviewed it." : "Complete your Inspire9 safety induction to get ready to book a workspace."}</p>
        <Link href={isUnderReview ? "/dashboard" : "/induction"} className="hub-button hub-button-primary">{isUnderReview ? "Back to your dashboard" : "Start your induction"}<ArrowRight size={15} /></Link>
      </div>
    </div>;
  }

  // ── Normal bookings page (inducted members only) ─────────────────────────
  const adminDb = createAdminClient();
  // The Hub is in Melbourne but this runs on a UTC server — computing "today"
  // from server-local time would check the wrong calendar day for a chunk of
  // every day (see lib/datetime.ts). Bound by Melbourne's actual calendar day
  // instead, and only count bookings that haven't finished yet, so a room
  // that was booked earlier today (or cancelled) doesn't stay flagged busy.
  const { startUTC: todayStartUTC, endUTC: todayEndUTC } = getLocalDayBoundsUTC(HUB_TIMEZONE);
  const nowUTC = new Date().toISOString();

  const [roomsRes, bookingsRes, todayBookingsRes] = await Promise.all([
    supabase.from("workspaces").select("*").order("capacity", { ascending: true }),

    supabase
      .from("bookings")
      .select("*, workspaces (name, capacity)")
      .eq("member_id", user?.id)
      .neq("booking_status", "cancelled")
      .order("start_date_time", { ascending: true }),

    adminDb
      .from("bookings")
      .select("workspace_id")
      .neq("booking_status", "cancelled")
      .gte("start_date_time", todayStartUTC)
      .lte("start_date_time", todayEndUTC)
      .gt("end_date_time", nowUTC),
  ]);

  const busyRoomIds = new Set(
    (todayBookingsRes.data ?? []).map((b) => b.workspace_id),
  );

  // Shown at the member's rate if their plan has one; checkout works the charge out again itself.
  const discount = user ? await memberDiscountPercent(user.id) : 0;
  // Desks are sold as day passes, by the card above, not as room cards.
  const rooms = withMemberRates(roomsOnly(roomsRes.data ?? []), discount).map((room) => ({
    ...room,
    busyToday: busyRoomIds.has(room.id),
  }));

  // Only shown once staff have put desks on sale.
  const dayPass = await getDayPassOffer();

  return (
    <div className="hub-page hub-bookings">
      <BookingsHero roomCount={rooms.length} />

      {dayPass.ok && <DayPassCard offer={dayPass} today={todayIn(HUB_TIMEZONE)} />}

      <BookingClient
        initialBookings={bookingsRes.data || []}
        rooms={rooms}
      />
    </div>
  );
}
