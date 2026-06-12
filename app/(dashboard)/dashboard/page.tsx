// app/(dashboard)/dashboard/page.tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Megaphone,
  CalendarDays,
  Wrench,
  AlertTriangle,
  Clock,
  Bell,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { INDUCTION_STATUS, MEMBER_STATUS } from "@/lib/constants";
import { getAnnouncementType } from "@/lib/announcement-types";
import DashboardToast from "./DashboardToast";
import { format, parseISO } from "date-fns";

const ANNOUNCEMENT_ICONS: Record<string, React.ElementType> = {
  general: Megaphone,
  event: CalendarDays,
  maintenance: Wrench,
  alert: AlertTriangle,
  hours: Clock,
  reminder: Bell,
};

export default async function MemberDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("members")
    .select("*")
    .eq("id", user?.id)
    .single();

  const { data: adminRecord } = await supabase
    .from("admins")
    .select("role")
    .eq("id", user?.id)
    .single();

  const { data: history } = await supabase
    .from("community_entries")
    .select("*")
    .eq("member_id", user?.id)
    .order("added_date", { ascending: false })
    .limit(3);

  const { data: nextBooking } = await supabase
    .from("bookings")
    .select("*, workspaces(name)")
    .eq("member_id", user?.id)
    .in("booking_status", ["confirmed", "pending"])
    .gte("start_date_time", new Date().toISOString())
    .order("start_date_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, message, type, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(5);

  const firstName = profile?.full_name?.split(" ")[0] || "User";
  const status = profile?.induction_status;
  const isInducted = status === INDUCTION_STATUS.COMPLETE;
  const isSubmitted = status === INDUCTION_STATUS.SUBMITTED;
  const memberStatus = profile?.member_status || MEMBER_STATUS.INACTIVE;

  return (
    <div className="w-full space-y-8 font-poppins pb-10">
      <DashboardToast />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-slate-500 mt-1 font-medium">
            Welcome back, {firstName}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {adminRecord && (
            <Button
              asChild
              variant="outline"
              className="rounded-xl border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 border-2 font-bold transition-all"
            >
              <Link href="/admin/approvals">
                <ShieldCheck className="w-4 h-4 mr-2" /> Admin Portal
              </Link>
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            className="rounded-xl border-slate-200 font-semibold"
          >
            <Link href="/support">Support</Link>
          </Button>

          <Button
            asChild
            className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-6 font-bold shadow-lg transition-all active:scale-95"
          >
            <Link href="/bookings">+ Book a Space</Link>
          </Button>
        </div>
      </div>

      {!isInducted && (
        <div
          className={`flex flex-col md:flex-row items-center justify-between p-6 bg-white dark:bg-slate-900 border-l-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-all ${isSubmitted ? "border-l-amber-500" : "border-l-[#E31E24]"}`}
        >
          <div className="flex gap-4 items-start">
            <div
              className={`p-3 rounded-2xl ${isSubmitted ? "bg-amber-50" : "bg-red-50"}`}
            >
              <AlertCircle
                className={`w-6 h-6 ${isSubmitted ? "text-amber-500" : "text-[#E31E24]"}`}
              />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                {isSubmitted
                  ? "Induction Under Review"
                  : "Action Required: Complete Induction"}
              </h3>
              <p className="text-sm text-slate-500 max-w-lg leading-relaxed">
                {isSubmitted
                  ? "Final review by Hub management in progress."
                  : "Complete the briefing to unlock 24/7 access."}
              </p>
            </div>
          </div>
          {!isSubmitted && (
            <Button
              asChild
              className="mt-4 md:mt-0 bg-[#E31E24] hover:bg-red-700 text-white rounded-xl px-8 py-7 font-bold text-md shadow-md shadow-red-100 transition-all"
            >
              <Link href="/induction">
                Start Induction <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
          )}
        </div>
      )}

      {/* Hub Announcements — only rendered when there are active ones */}
      {announcements && announcements.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Megaphone className="w-3.5 h-3.5" /> Hub Announcements
          </p>
          {announcements.map((a) => {
            const t = getAnnouncementType(a.type);
            const Icon = ANNOUNCEMENT_ICONS[a.type] ?? Megaphone;
            return (
              <div
                key={a.id}
                className={`flex items-start gap-4 p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm border-l-4 ${t.border}`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${t.badge}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black text-slate-900 dark:text-white text-sm">{a.title}</p>
                    <Badge
                      className={`${t.badge} border-none font-black text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full`}
                    >
                      {t.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500 font-medium mt-0.5 leading-relaxed">
                    {a.message}
                  </p>
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight shrink-0">
                  {format(parseISO(a.created_at), "d MMM")}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-3xl border-slate-100 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
              Account Status
            </p>
            <Badge
              className={`${memberStatus === MEMBER_STATUS.ACTIVE ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"} border-none px-3 py-1 rounded-full font-bold capitalize`}
            >
              {memberStatus}
            </Badge>
          </CardHeader>
          <CardContent className="pt-2">
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">
              Standard Resident
            </h2>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-4 italic">
              Membership Managed via Stripe
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-100 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
              Compliance Progress
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {isInducted ? "Verified" : isSubmitted ? "Reviewing" : "Pending"}
            </h2>
            <Progress
              value={isInducted ? 100 : isSubmitted ? 75 : 25}
              className={`h-2.5 mt-4 bg-slate-100 rounded-full ${isInducted ? "[&>div]:bg-emerald-500" : isSubmitted ? "[&>div]:bg-amber-500" : "[&>div]:bg-[#E31E24]"}`}
            />
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-100 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
              Next Booking
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            {nextBooking ? (
              <>
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">
                  {nextBooking.workspaces?.name ?? "Meeting Room"}
                </h2>
                <p className="text-[11px] text-slate-500 font-bold mt-1">
                  {format(parseISO(nextBooking.start_date_time), "EEE d MMM, h:mm a")}
                </p>
                <Link
                  href="/bookings"
                  className="text-[11px] text-[#E31E24] font-black mt-3 inline-block uppercase tracking-wider hover:underline decoration-2 underline-offset-4"
                >
                  View Schedule →
                </Link>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">No Bookings</h2>
                <Link
                  href="/bookings"
                  className="text-[11px] text-[#E31E24] font-black mt-4 inline-block uppercase tracking-wider hover:underline decoration-2 underline-offset-4"
                >
                  Explore Spaces →
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-50 dark:border-slate-800 px-8 py-6">
          <CardTitle className="text-xl font-black text-slate-800 dark:text-slate-100">
            Recent Activity
          </CardTitle>
          <Button
            asChild
            variant="ghost"
            className="text-[10px] text-slate-400 uppercase font-black tracking-widest"
          >
            <Link href="/history">View History →</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-8">
          <div className="space-y-10 relative before:absolute before:inset-0 before:ml-1.5 before:h-full before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
            {history && history.length > 0 ? (
              history.map((entry) => (
                <ActivityItem
                  key={entry.id}
                  title={entry.entry_type}
                  desc={entry.entry_description || "Update log recorded."}
                  time={entry.entry_date}
                  dotColor={
                    entry.tags === "Approved" ? "bg-emerald-500" : "bg-blue-500"
                  }
                />
              ))
            ) : (
              <p className="text-slate-400 font-medium italic text-sm">
                No activity recorded in the hub yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityItem({
  title,
  desc,
  time,
  dotColor,
}: {
  title: string;
  desc: string;
  time: string;
  dotColor: string;
}) {
  return (
    <div className="flex gap-6 relative group">
      <div
        className={`mt-1.5 h-3 w-3 rounded-full ${dotColor} shrink-0 ring-4 ring-white dark:ring-slate-900 z-10 transition-transform group-hover:scale-125`}
      />
      <div className="flex-1 -mt-1">
        <div className="flex justify-between items-start">
          <h4 className="text-md font-bold text-slate-800 dark:text-slate-200 group-hover:text-[#E31E24] transition-colors">
            {title}
          </h4>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
            {time}
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
