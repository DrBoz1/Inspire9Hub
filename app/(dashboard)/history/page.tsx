import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  CreditCard,
  KeyRound,
  Activity,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { summarizePayments } from "@/lib/member-stats";

const PAGE_SIZE = 10;

function formatDateTime(iso: string) {
  try {
    return format(parseISO(iso), "d MMM yyyy, h:mm a");
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string) {
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return iso;
  }
}

function statusColor(status: string) {
  const s = status?.toLowerCase();
  if (s === "confirmed" || s === "paid" || s === "active" || s === "approved")
    return "bg-emerald-50 text-emerald-700";
  if (s === "pending") return "bg-amber-50 text-amber-700";
  if (s === "refunded") return "bg-violet-50 text-violet-700";
  if (s === "cancelled" || s === "rejected") return "bg-red-50 text-red-600";
  return "bg-slate-100 text-slate-600";
}

export default async function HistoryPage(props: {
  searchParams: Promise<{ bp?: string; pp?: string }>;
}) {
  const searchParams = await props.searchParams;
  const bookingPage = Math.max(1, parseInt(searchParams.bp ?? "1"));
  const paymentPage = Math.max(1, parseInt(searchParams.pp ?? "1"));

  const supabase = await createClient();
  const user = await getCurrentUser();

  const bFrom = (bookingPage - 1) * PAGE_SIZE;
  const pFrom = (paymentPage - 1) * PAGE_SIZE;

  const [bookingsRes, paymentsRes, passesRes, activityRes, allPaymentsRes] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("*, workspaces(name, location)", { count: "exact" })
        .eq("member_id", user?.id)
        .order("start_date_time", { ascending: false })
        .range(bFrom, bFrom + PAGE_SIZE - 1),

      supabase
        .from("payments")
        .select("*, bookings(start_date_time, workspaces(name))", { count: "exact" })
        .eq("member_id", user?.id)
        .order("payment_date", { ascending: false })
        .range(pFrom, pFrom + PAGE_SIZE - 1),

      supabase
        .from("access_passes")
        .select("*")
        .eq("member_id", user?.id)
        .order("issued_date", { ascending: false })
        .limit(50),

      // Use added_date (timestamptz) for precise ordering — entry_date is just a date
      supabase
        .from("community_entries")
        .select("*")
        .eq("member_id", user?.id)
        .order("added_date", { ascending: false })
        .limit(30),

      // Net spend uses the shared formula in lib/member-stats so the history
      // page and the Hub Assistant can never disagree about the numbers.
      supabase
        .from("payments")
        .select("amount, refunded_amount, payment_status")
        .eq("member_id", user?.id),
    ]);

  const bookings = bookingsRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const passes = passesRes.data ?? [];
  const activity = activityRes.data ?? [];

  const totalBookings = bookingsRes.count ?? 0;
  const totalPayments = paymentsRes.count ?? 0;
  const totalBookingPages = Math.ceil(totalBookings / PAGE_SIZE);
  const totalPaymentPages = Math.ceil(totalPayments / PAGE_SIZE);

  const { netSpend } = summarizePayments(allPaymentsRes.data ?? []);

  return (
    <div className="w-full space-y-10 font-poppins pb-16">
      <div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
          My History
        </h1>
        <p className="text-slate-500 mt-1 font-medium">
          A full record of your bookings, payments, and access passes.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Bookings", value: totalBookings, icon: CalendarDays, color: "text-blue-600 bg-blue-50" },
          { label: "Payments Made", value: totalPayments, icon: CreditCard, color: "text-emerald-600 bg-emerald-50" },
          { label: "Access Passes", value: passes.length, icon: KeyRound, color: "text-violet-600 bg-violet-50" },
          { label: "Net Spend", value: `$${netSpend.toFixed(2)}`, icon: Activity, color: "text-[#E31E24] bg-red-50" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="rounded-3xl border-slate-100 shadow-sm">
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {label}
                </p>
                <p className="text-2xl font-black text-slate-900">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Booking History ──────────────────────────────── */}
      <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-8 py-5 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#E31E24]" /> Booking History
          </CardTitle>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {totalBookings} total
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {bookings.length === 0 ? (
            <p className="text-slate-400 italic text-sm font-medium p-8">
              No bookings found.
            </p>
          ) : (
            <div className="divide-y divide-slate-50">
              {bookings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between px-8 py-5 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-11 w-11 bg-slate-900 rounded-2xl flex items-center justify-center text-white shrink-0">
                      <CalendarDays className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-black text-slate-900">
                        {b.workspaces?.name ?? "Meeting Room"}
                      </p>
                      <p className="text-xs text-slate-400 font-bold mt-0.5">
                        {formatDateTime(b.start_date_time)} →{" "}
                        {format(parseISO(b.end_date_time), "h:mm a")}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={`${statusColor(b.booking_status)} border-none px-4 py-1 rounded-full font-black text-[10px] uppercase`}
                  >
                    {b.booking_status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booking pagination */}
      {totalBookingPages > 1 && (
        <Pagination
          page={bookingPage}
          total={totalBookingPages}
          prevHref={`/history?bp=${bookingPage - 1}&pp=${paymentPage}`}
          nextHref={`/history?bp=${bookingPage + 1}&pp=${paymentPage}`}
        />
      )}

      {/* ── Payment History ──────────────────────────────── */}
      <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-8 py-5 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" /> Payment History
          </CardTitle>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {totalPayments} total
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <p className="text-slate-400 italic text-sm font-medium p-8">
              No payments found.
            </p>
          ) : (
            <div className="divide-y divide-slate-50">
              {payments.map((p) => {
                const isRefunded = p.payment_status === "refunded";
                const refundedAmt = p.refunded_amount ?? p.amount;
                const netAmt = isRefunded
                  ? (p.amount ?? 0) - (refundedAmt ?? 0)
                  : p.amount;

                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-8 py-5 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-11 w-11 rounded-2xl flex items-center justify-center text-white shrink-0 ${
                          isRefunded ? "bg-violet-600" : "bg-emerald-600"
                        }`}
                      >
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900">
                          {p.bookings?.workspaces?.name ?? "Room Booking"}
                        </p>
                        <p className="text-xs text-slate-400 font-bold mt-0.5 capitalize">
                          {formatDateShort(p.payment_date)} · {p.payment_method}
                        </p>
                        {isRefunded && (
                          <p className="text-xs text-violet-600 font-bold mt-0.5">
                            ${refundedAmt?.toFixed(2)} refunded ·{" "}
                            ${netAmt?.toFixed(2)} retained
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p
                          className={`font-black ${isRefunded ? "text-slate-400 line-through text-sm" : "text-slate-900"}`}
                        >
                          ${Number(p.amount).toFixed(2)} AUD
                        </p>
                        {isRefunded && netAmt !== null && (
                          <p className="text-xs font-black text-slate-900">
                            ${netAmt.toFixed(2)} AUD net
                          </p>
                        )}
                      </div>
                      <Badge
                        className={`${statusColor(p.payment_status)} border-none px-3 py-1 rounded-full font-black text-[10px] uppercase`}
                      >
                        {p.payment_status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment pagination */}
      {totalPaymentPages > 1 && (
        <Pagination
          page={paymentPage}
          total={totalPaymentPages}
          prevHref={`/history?bp=${bookingPage}&pp=${paymentPage - 1}`}
          nextHref={`/history?bp=${bookingPage}&pp=${paymentPage + 1}`}
        />
      )}

      {/* ── Access Passes ────────────────────────────────── */}
      <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-8 py-5">
          <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-violet-600" /> Access Passes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {passes.length === 0 ? (
            <p className="text-slate-400 italic text-sm font-medium p-8">
              No access passes issued yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-50">
              {passes.map((pass) => (
                <div
                  key={pass.id}
                  className="flex items-center justify-between px-8 py-5 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-11 w-11 bg-violet-600 rounded-2xl flex items-center justify-center text-white shrink-0">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 capitalize">
                        {pass.pass_type?.replace("_", " ") ?? "Room Booking Pass"}
                      </p>
                      <p className="text-xs text-slate-400 font-bold mt-0.5">
                        Issued {formatDateShort(pass.issued_date)} · Expires{" "}
                        {formatDateShort(pass.expiry_date)}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={`${statusColor(pass.pass_status)} border-none px-3 py-1 rounded-full font-black text-[10px] uppercase`}
                  >
                    {pass.pass_status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Activity Log ─────────────────────────────────── */}
      <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-8 py-5">
          <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" /> Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          {activity.length === 0 ? (
            <p className="text-slate-400 italic text-sm font-medium">
              No activity recorded yet.
            </p>
          ) : (
            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-1.5 before:h-full before:w-0.5 before:bg-slate-100">
              {activity.map((entry) => (
                <div key={entry.id} className="flex gap-6 relative group">
                  <div
                    className={`mt-1.5 h-3 w-3 rounded-full shrink-0 ring-4 ring-white z-10 transition-transform group-hover:scale-125 ${
                      entry.tags === "Approved"
                        ? "bg-emerald-500"
                        : entry.tags === "Rejected"
                          ? "bg-red-400"
                          : "bg-blue-500"
                    }`}
                  />
                  <div className="flex-1 -mt-1">
                    <div className="flex justify-between items-start">
                      <h4 className="text-sm font-bold text-slate-800 group-hover:text-[#E31E24] transition-colors">
                        {entry.entry_type}
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                        {entry.added_date
                          ? formatDateShort(entry.added_date)
                          : entry.entry_date}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                      {entry.entry_description ?? "Update recorded."}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Pagination({
  page,
  total,
  prevHref,
  nextHref,
}: {
  page: number;
  total: number;
  prevHref: string;
  nextHref: string;
}) {
  return (
    <div className="flex items-center justify-between px-2">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        Page {page} of {total}
      </p>
      <div className="flex gap-3">
        <Button
          asChild
          variant="outline"
          disabled={page <= 1}
          className="rounded-2xl border-slate-200 h-10 px-5 font-black text-xs"
        >
          <Link href={prevHref}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Prev
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          disabled={page >= total}
          className="rounded-2xl border-slate-200 h-10 px-5 font-black text-xs"
        >
          <Link href={nextHref}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
