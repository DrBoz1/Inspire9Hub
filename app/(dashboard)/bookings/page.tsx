import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import BookingClient from "./BookingClient";
import { cancelPendingBooking } from "./actions";
import { INDUCTION_STATUS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, Clock, ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { getLocalDayBoundsUTC, HUB_TIMEZONE } from "@/lib/datetime";
import BookingsHero from "./BookingsHero";

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
    return (
      <div className="font-poppins pb-20 space-y-10">
        {/* Page header — still shown so the URL makes sense */}
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">
            Reserve <span className="text-[#E31E24]">Space</span>
          </h1>
          <p className="text-slate-500 font-medium max-w-xl">
            Book meeting rooms and workspaces across the Inspire9 Hub.
          </p>
        </div>

        {/* Gate card */}
        <div className="relative overflow-hidden rounded-[40px] bg-slate-900 text-white p-14 flex flex-col items-center text-center gap-8 shadow-2xl">
          {/* Background decoration */}
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/5 rounded-full pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-white/5 rounded-full pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-transparent via-[#E31E24]/60 to-transparent" />

          {/* Icon */}
          <div
            className={`relative z-10 h-20 w-20 rounded-[28px] flex items-center justify-center shadow-xl ${
              isUnderReview
                ? "bg-amber-500 shadow-amber-500/30"
                : "bg-[#E31E24] shadow-red-500/30"
            }`}
          >
            {isUnderReview ? (
              <Clock className="w-9 h-9 text-white" />
            ) : (
              <Lock className="w-9 h-9 text-white" />
            )}
          </div>

          {/* Message */}
          <div className="relative z-10 space-y-3 max-w-lg">
            <h2 className="text-3xl font-black tracking-tight">
              {isUnderReview
                ? "Induction Under Review"
                : "Induction Required"}
            </h2>
            <p className="text-slate-400 text-base leading-relaxed font-medium">
              {isUnderReview
                ? "Your safety induction is currently being reviewed by Hub management. Booking will unlock as soon as you're approved — usually within 24 hours."
                : "You need to complete the Inspire9 safety induction before you can book any workspace. It only takes a few minutes."}
            </p>
          </div>

          {/* Progress bar */}
          <div className="relative z-10 w-full max-w-xs space-y-2">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
              <span>Compliance Progress</span>
              <span>{isUnderReview ? "75%" : "25%"}</span>
            </div>
            <Progress
              value={isUnderReview ? 75 : 25}
              className={`h-2 bg-white/10 ${
                isUnderReview
                  ? "[&>div]:bg-amber-500"
                  : "[&>div]:bg-[#E31E24]"
              }`}
            />
            <div className="flex justify-between text-[10px] font-bold text-slate-600">
              <span>Pending</span>
              <span>Under Review</span>
              <span>Approved ✓</span>
            </div>
          </div>

          {/* CTA */}
          <div className="relative z-10 flex flex-col sm:flex-row gap-3">
            {!isUnderReview && (
              <Button
                asChild
                className="bg-[#E31E24] hover:bg-red-700 text-white rounded-2xl px-8 h-13 font-black uppercase tracking-wider shadow-lg shadow-red-500/30 transition-all active:scale-95"
              >
                <Link href="/induction">
                  Start Induction <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              className="rounded-2xl px-8 h-13 font-bold border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white transition-all"
            >
              <Link href="/dashboard">
                <ShieldCheck className="mr-2 w-4 h-4" />
                View Dashboard
              </Link>
            </Button>
          </div>

          {/* Fine print */}
          <p className="relative z-10 text-[11px] text-slate-600 font-medium">
            {isUnderReview
              ? "You'll receive an email notification when your induction is approved."
              : "Booking access is granted automatically once your induction is approved."}
          </p>
        </div>
      </div>
    );
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
    (todayBookingsRes.data ?? []).map((b: any) => b.workspace_id),
  );

  const rooms = (roomsRes.data ?? []).map((room) => ({
    ...room,
    busyToday: busyRoomIds.has(room.id),
  }));

  return (
    <div className="space-y-10 font-poppins pb-20">
      <BookingsHero roomCount={rooms.length} />

      <BookingClient
        initialBookings={bookingsRes.data || []}
        rooms={rooms}
      />
    </div>
  );
}
