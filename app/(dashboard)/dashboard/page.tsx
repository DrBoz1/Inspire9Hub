import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, ShieldCheck, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { INDUCTION_STATUS, MEMBER_STATUS } from "@/lib/constants";

export default async function MemberDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Fetch Member Profile
  const { data: profile } = await supabase
    .from("members")
    .select("*")
    .eq("id", user?.id)
    .single();

  // 2. Check if this user is also an Admin (The "Promotion" Check)
  const { data: adminRecord } = await supabase
    .from("admins")
    .select("role")
    .eq("id", user?.id)
    .single();

  const firstName = profile?.full_name?.split(" ")[0] || "User";
  const status = profile?.induction_status;

  const isInducted = status === INDUCTION_STATUS.COMPLETE;
  const isSubmitted = status === INDUCTION_STATUS.SUBMITTED;
  const memberStatus = profile?.member_status || MEMBER_STATUS.INACTIVE;

  return (
    <div className="max-w-6xl space-y-8 font-poppins pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-slate-500 mt-1 font-medium">
            Welcome back, {firstName}. Here's the latest for your workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {/* Admin Portal Button: Only visible if the user is promoted */}
          {adminRecord && (
            <Button
              asChild
              variant="outline"
              className="rounded-xl border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 border-2 font-bold transition-all"
            >
              <Link href="/admin/approvals">
                <ShieldCheck className="w-4 h-4 mr-2" />
                Admin Portal
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            className="rounded-xl border-slate-200 font-semibold"
          >
            Support
          </Button>
          <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-6 font-bold shadow-lg shadow-slate-200 transition-all active:scale-95">
            + Book a Space
          </Button>
        </div>
      </div>

      {/* Dynamic Compliance Banner */}
      {!isInducted && (
        <div
          className={`flex flex-col md:flex-row items-center justify-between p-6 bg-white border-l-4 rounded-2xl shadow-sm border border-slate-100 transition-all ${isSubmitted ? "border-l-amber-500" : "border-l-[#E31E24]"}`}
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
              <h3 className="font-bold text-slate-900 text-lg">
                {isSubmitted
                  ? "Induction Under Review"
                  : "Action Required: Complete Induction"}
              </h3>
              <p className="text-sm text-slate-500 max-w-lg leading-relaxed">
                {isSubmitted
                  ? "We've received your safety briefing! An admin will review your health information and approve your 24/7 access pass shortly."
                  : "To unlock your 24/7 access pass and building entry, you must complete the digital safety and etiquette briefing."}
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-3xl border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
              Account Status
            </p>
            <Badge
              className={`${
                memberStatus === MEMBER_STATUS.ACTIVE
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-amber-50 text-amber-600"
              } border-none px-3 py-1 rounded-full font-bold capitalize`}
            >
              {memberStatus}
            </Badge>
          </CardHeader>
          <CardContent className="pt-2">
            <h2 className="text-2xl font-black text-slate-800">
              Hot Desk Unlimited
            </h2>
            <div className="flex items-center gap-2 mt-4">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                Active until Feb 2027
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
              Compliance Progress
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <h2 className="text-2xl font-black text-slate-800">
              {isInducted ? "Verified" : isSubmitted ? "Reviewing" : "Pending"}
            </h2>
            <Progress
              value={isInducted ? 100 : isSubmitted ? 75 : 25}
              className={`h-2.5 mt-4 bg-slate-100 rounded-full ${isInducted ? "[&>div]:bg-emerald-500" : isSubmitted ? "[&>div]:bg-amber-500" : "[&>div]:bg-[#E31E24]"}`}
            />
            <p className="text-[11px] font-bold text-slate-400 mt-3 uppercase tracking-wider">
              {isInducted
                ? "All Access Granted"
                : isSubmitted
                  ? "Final Admin Review"
                  : "1 Task Remaining"}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
              Next Booking
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <h2 className="text-2xl font-black text-slate-800">No Bookings</h2>
            <Link
              href="/bookings"
              className="text-[11px] text-[#E31E24] font-black mt-4 inline-block uppercase tracking-wider hover:underline decoration-2 underline-offset-4"
            >
              Explore Spaces →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Activity Section */}
      <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50 border-b border-slate-50 px-8 py-6">
          <CardTitle className="text-xl font-black text-slate-800">
            Recent Activity
          </CardTitle>
          <Button
            variant="ghost"
            className="text-[10px] text-slate-400 uppercase font-black tracking-widest hover:bg-transparent hover:text-slate-600"
          >
            View History
          </Button>
        </CardHeader>
        <CardContent className="p-8">
          <div className="space-y-10 relative before:absolute before:inset-0 before:ml-1.5 before:h-full before:w-0.5 before:bg-slate-100">
            <ActivityItem
              title="Membership Sync"
              desc={`Status confirmed as ${memberStatus.toLowerCase()}.`}
              time="Just now"
              dotColor={
                memberStatus === MEMBER_STATUS.ACTIVE
                  ? "bg-emerald-500"
                  : "bg-amber-500"
              }
            />
            <ActivityItem
              title="Compliance Record Updated"
              desc={
                isSubmitted
                  ? "Health & Safety briefing submitted for review."
                  : "Induction status checked."
              }
              time="Today"
              dotColor="bg-blue-500"
            />
            <ActivityItem
              title="Welcome to Inspire9"
              desc="Account registration successfully finalized."
              time="Yesterday"
              dotColor="bg-slate-300"
            />
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
        className={`mt-1.5 h-3 w-3 rounded-full ${dotColor} shrink-0 ring-4 ring-white z-10 transition-transform group-hover:scale-125`}
      />
      <div className="flex-1 -mt-1">
        <div className="flex justify-between items-start">
          <h4 className="text-md font-bold text-slate-800 group-hover:text-[#E31E24] transition-colors">
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
