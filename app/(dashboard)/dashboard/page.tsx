import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, ChevronRight } from "lucide-react";

export default function MemberDashboard() {
  return (
    <div className="max-w-6xl space-y-8 font-poppins">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Welcome back, Yianni. Here's what's happening today.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl border-slate-200">
            Need Help?
          </Button>
          <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-6">
            + Book a Space
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between p-6 bg-white border-l-4 border-l-red-500 border border-slate-100 rounded-xl shadow-sm">
        <div className="flex gap-4 items-start">
          <div className="p-2 bg-red-50 rounded-full">
            <AlertCircle className="text-red-500 w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">
              Outstanding Task: Complete Induction
            </h3>
            <p className="text-sm text-slate-500 max-w-lg mt-1">
              Your membership is active, but your door access pass is currently
              locked. Please complete the digital safety briefing to unlock 24/7
              access.
            </p>
          </div>
        </div>
        <Button className="bg-[#E31E24] hover:bg-red-700 text-white rounded-xl px-6 py-6 font-semibold">
          Start Induction →
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-slate-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Current Plan
            </p>
            <Badge className="bg-emerald-50 text-emerald-600 border-none px-3">
              Active
            </Badge>
          </CardHeader>
          <CardContent>
            <h2 className="text-xl font-bold text-slate-800">
              Hot Desk Unlimited
            </h2>
            <p className="text-xs text-slate-400 mt-4 italic">
              Renews on Feb 1, 2026
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-100 shadow-sm">
          <CardHeader>
            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Induction Progress
            </p>
          </CardHeader>
          <CardContent>
            <h2 className="text-xl font-bold text-slate-800">Pending</h2>
            <Progress value={25} className="h-2 mt-4 bg-slate-100" />
            <p className="text-xs text-slate-400 mt-2">Step 1 of 4 completed</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-100 shadow-sm">
          <CardHeader>
            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Next Booking
            </p>
          </CardHeader>
          <CardContent>
            <h2 className="text-xl font-bold text-slate-800">
              No upcoming bookings
            </h2>
            <p className="text-xs text-red-500 font-bold mt-4 cursor-pointer hover:underline">
              View Calendar
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-slate-100 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50">
          <CardTitle className="text-lg font-bold">Recent Activity</CardTitle>
          <Button
            variant="ghost"
            className="text-xs text-slate-400 uppercase font-bold"
          >
            View All
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-8">
            <ActivityItem
              title="Payment Successful"
              desc="Invoice #INV-2026-001 for Hot Desk Membership."
              time="2 hours ago"
              dotColor="bg-emerald-500"
            />
            <ActivityItem
              title="Membership Activated"
              desc="Your account has been verified. Welcome to Inspire9!"
              time="2 hours ago"
              dotColor="bg-blue-500"
            />
            <ActivityItem
              title="Sign Up Completed"
              desc="Account profile created."
              time="3 hours ago"
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
    <div className="flex gap-4 relative">
      <div className={`mt-1.5 h-2.5 w-2.5 rounded-full ${dotColor} shrink-0`} />
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <h4 className="text-sm font-bold text-slate-800">{title}</h4>
          <span className="text-xs text-slate-400">{time}</span>
        </div>
        <p className="text-sm text-slate-500 mt-1">{desc}</p>
      </div>
    </div>
  );
}
