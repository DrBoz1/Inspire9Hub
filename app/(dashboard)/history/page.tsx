import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  CreditCard,
  KeyRound,
  Activity,
  Clock,
} from "lucide-react";
import { format, parseISO } from "date-fns";

function formatDate(iso: string) {
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string) {
  try {
    return format(parseISO(iso), "d MMM yyyy, h:mm a");
  } catch {
    return iso;
  }
}

function statusColor(status: string) {
  const s = status?.toLowerCase();
  if (s === "confirmed" || s === "paid" || s === "active" || s === "approved")
    return "bg-emerald-50 text-emerald-700";
  if (s === "pending") return "bg-amber-50 text-amber-700";
  if (s === "cancelled" || s === "rejected")
    return "bg-red-50 text-red-600";
  return "bg-slate-100 text-slate-600";
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [bookingsRes, paymentsRes, passesRes, activityRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("*, workspaces(name, capacity, location)")
      .eq("member_id", user?.id)
      .order("start_date_time", { ascending: false }),

    supabase
      .from("payments")
      .select("*, bookings(start_date_time, workspaces(name))")
      .eq("member_id", user?.id)
      .order("payment_date", { ascending: false }),

    supabase
      .from("access_passes")
      .select("*")
      .eq("member_id", user?.id)
      .order("issued_date", { ascending: false }),

    supabase
      .from("community_entries")
      .select("*")
      .eq("member_id", user?.id)
      .order("entry_date", { ascending: false }),
  ]);

  const bookings = bookingsRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const passes = passesRes.data ?? [];
  const activity = activityRes.data ?? [];

  const totalSpend = payments
    .filter((p) => p.payment_status === "paid")
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);

  return (
    <div className="max-w-5xl space-y-10 font-poppins pb-16">
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
          { label: "Total Bookings", value: bookings.length, icon: CalendarDays, color: "text-blue-600 bg-blue-50" },
          { label: "Payments Made", value: payments.length, icon: CreditCard, color: "text-emerald-600 bg-emerald-50" },
          { label: "Access Passes", value: passes.length, icon: KeyRound, color: "text-violet-600 bg-violet-50" },
          { label: "Total Spend", value: `$${totalSpend.toFixed(2)}`, icon: Activity, color: "text-[#E31E24] bg-red-50" },
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

      {/* Booking History */}
      <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-8 py-5">
          <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#E31E24]" /> Booking History
          </CardTitle>
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

      {/* Payment History */}
      <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-8 py-5">
          <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" /> Payment History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <p className="text-slate-400 italic text-sm font-medium p-8">
              No payments found.
            </p>
          ) : (
            <div className="divide-y divide-slate-50">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-8 py-5 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-11 w-11 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shrink-0">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-black text-slate-900">
                        {p.bookings?.workspaces?.name ?? "Room Booking"}
                      </p>
                      <p className="text-xs text-slate-400 font-bold mt-0.5 capitalize">
                        {formatDate(p.payment_date)} · {p.payment_method}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-slate-900">
                      ${Number(p.amount).toFixed(2)} AUD
                    </span>
                    <Badge
                      className={`${statusColor(p.payment_status)} border-none px-3 py-1 rounded-full font-black text-[10px] uppercase`}
                    >
                      {p.payment_status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Access Passes */}
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
                        Issued {formatDate(pass.issued_date)} · Expires{" "}
                        {formatDate(pass.expiry_date)}
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

      {/* Activity Log */}
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
                        {entry.entry_date}
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
