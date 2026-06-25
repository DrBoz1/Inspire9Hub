import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  CalendarDays,
  ClipboardCheck,
  TrendingUp,
  Clock,
  Building2,
} from "lucide-react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { getLocalDayBoundsUTC, HUB_TIMEZONE } from "@/lib/datetime";

function statusColor(status: string) {
  switch (status?.toLowerCase()) {
    case "confirmed": return "bg-emerald-50 text-emerald-700";
    case "pending": return "bg-amber-50 text-amber-700";
    case "cancelled": return "bg-red-50 text-red-600";
    default: return "bg-slate-100 text-slate-600";
  }
}

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();

  // Computed in the Hub's actual local timezone, not the server's (UTC) —
  // see lib/datetime.ts for why a plain setHours(0,0,0,0) checks the wrong
  // calendar day for a chunk of every Melbourne day.
  const { startUTC: todayStart, endUTC: todayEnd } = getLocalDayBoundsUTC(HUB_TIMEZONE);
  const now = new Date().toISOString();

  const [
    pendingRes,
    todayBookingsRes,
    activeMembersRes,
    upcomingRes,
    pendingMembersRes,
  ] = await Promise.all([
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("induction_status", "Submitted"),

    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("booking_status", "confirmed")
      .gte("start_date_time", todayStart)
      .lte("start_date_time", todayEnd),

    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("member_status", "Active"),

    supabase
      .from("bookings")
      .select("id, start_date_time, end_date_time, booking_status, workspaces(name, location), members(full_name, email)")
      .in("booking_status", ["confirmed", "pending"])
      .gte("start_date_time", now)
      .order("start_date_time", { ascending: true })
      .limit(8),

    supabase
      .from("members")
      .select("id, full_name, email, company_name, induction_status, member_status")
      .eq("induction_status", "Submitted")
      .limit(5),
  ]);

  const stats = [
    {
      label: "Pending Approvals",
      value: pendingRes.count ?? 0,
      icon: ClipboardCheck,
      color: "text-amber-600 bg-amber-50",
      href: "/admin/approvals",
    },
    {
      label: "Bookings Today",
      value: todayBookingsRes.count ?? 0,
      icon: CalendarDays,
      color: "text-blue-600 bg-blue-50",
      href: "/admin/bookings",
    },
    {
      label: "Active Members",
      value: activeMembersRes.count ?? 0,
      icon: Users,
      color: "text-emerald-600 bg-emerald-50",
      href: "/admin/members",
    },
    {
      label: "Upcoming (7 days)",
      value: upcomingRes.data?.length ?? 0,
      icon: TrendingUp,
      color: "text-violet-600 bg-violet-50",
      href: "/admin/bookings",
    },
  ];

  return (
    <div className="space-y-10 font-poppins pb-10">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">
          Command Centre
        </h1>
        <p className="text-slate-500 font-medium italic mt-2">
          Real-time overview of hub operations.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href}>
            <Card className="rounded-3xl border-slate-100 shadow-sm hover:-translate-y-1 transition-all cursor-pointer">
              <CardContent className="p-6 flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${color} shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {label}
                  </p>
                  <p className="text-3xl font-black text-slate-900">{value}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upcoming bookings */}
        <div className="lg:col-span-2">
          <Card className="rounded-[32px] border-slate-100 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-8 py-5 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-500" /> Upcoming
                Bookings
              </CardTitle>
              <Link
                href="/admin/bookings"
                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#E31E24] transition-colors"
              >
                View All →
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {!upcomingRes.data || upcomingRes.data.length === 0 ? (
                <p className="text-slate-400 italic text-sm font-medium p-8">
                  No upcoming bookings.
                </p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {upcomingRes.data.map((b: any) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between px-8 py-4 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shrink-0">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-sm">
                            {b.workspaces?.name ?? "Room"}
                          </p>
                          <p className="text-[11px] text-slate-400 font-bold">
                            {b.members?.full_name ?? "Member"} ·{" "}
                            {format(parseISO(b.start_date_time), "d MMM, h:mm a")}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={`${statusColor(b.booking_status)} border-none px-3 py-1 rounded-full font-black text-[10px] uppercase`}
                      >
                        {b.booking_status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pending approvals */}
        <div>
          <Card className="rounded-[32px] border-slate-100 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-8 py-5 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-amber-500" /> Pending
              </CardTitle>
              <Link
                href="/admin/approvals"
                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#E31E24] transition-colors"
              >
                Approve →
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {!pendingMembersRes.data || pendingMembersRes.data.length === 0 ? (
                <p className="text-slate-400 italic text-sm font-medium p-8">
                  No pending inductions.
                </p>
              ) : (
                <div className="divide-y divide-slate-50">
                  {pendingMembersRes.data.map((m: any) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 px-6 py-4 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="h-9 w-9 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 text-sm truncate">
                          {m.full_name}
                        </p>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 font-bold">
                          <Building2 className="w-3 h-3" />
                          <span className="truncate">{m.company_name}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
