import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";
import AdminBookingsClient from "./AdminBookingsClient";
import Link from "next/link";

export default async function AdminBookingsPage(props: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const searchParams = await props.searchParams;
  const filter = searchParams.filter ?? "upcoming";

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  let query = supabase
    .from("bookings")
    .select(
      "id, start_date_time, end_date_time, booking_status, workspaces(name, location), members(full_name, email)",
    )
    .order("start_date_time", { ascending: filter === "upcoming" });

  if (filter === "upcoming") {
    query = query.gte("start_date_time", now).neq("booking_status", "cancelled");
  } else if (filter === "past") {
    query = query.lt("start_date_time", now);
  } else if (filter === "cancelled") {
    query = query.eq("booking_status", "cancelled");
  }

  const { data: bookings } = await query.limit(50);

  // Fetch which cancelled bookings have a refundable (paid) payment with a payment intent on record
  const cancelledIds = (bookings ?? [])
    .filter((b) => b.booking_status === "cancelled")
    .map((b) => b.id);

  const { data: refundablePayments } =
    cancelledIds.length > 0
      ? await supabase
          .from("payments")
          .select("booking_id")
          .in("booking_id", cancelledIds)
          .eq("payment_status", "paid")
          .not("stripe_payment_intent_id", "is", null)
      : { data: [] };

  const refundableIds = (refundablePayments ?? []).map((p: any) => p.booking_id);

  const filters = [
    { key: "upcoming", label: "Upcoming" },
    { key: "past",     label: "Past" },
    { key: "all",      label: "All" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="space-y-8 font-poppins pb-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
            Booking Schedule
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Monitor all workspace reservations and resolve conflicts.
          </p>
        </div>
        <Badge className="rounded-full px-5 py-2 bg-slate-900 text-white font-black text-[10px] tracking-widest uppercase">
          {bookings?.length ?? 0} Shown
        </Badge>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {filters.map(({ key, label }) => (
          <Link
            key={key}
            href={`/admin/bookings?filter=${key}`}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
              filter === key
                ? "bg-slate-900 text-white shadow-lg"
                : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <Card className="rounded-[32px] border-slate-100 shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-8 py-5">
          <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-500" />
            {filters.find((f) => f.key === filter)?.label} Bookings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <AdminBookingsClient bookings={bookings ?? []} refundableIds={refundableIds} />
        </CardContent>
      </Card>
    </div>
  );
}
