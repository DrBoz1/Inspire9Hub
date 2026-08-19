// app/(dashboard)/dashboard/page.tsx
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { INDUCTION_STATUS, MEMBER_STATUS } from "@/lib/constants";
import DashboardClient from "./DashboardClient";

export default async function MemberDashboard() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  // 5 independent queries fired in parallel — waits only for the slowest one
  // rather than the sum of all, cutting dashboard load time roughly 5×.
  const [
    { data: profile },
    { data: adminRecord },
    { data: history },
    { data: nextBooking },
    { data: announcements },
  ] = await Promise.all([
    supabase.from("members").select("*").eq("id", user?.id).single(),
    supabase.from("admins").select("role").eq("id", user?.id).single(),
    supabase
      .from("community_entries")
      .select("*")
      .eq("member_id", user?.id)
      .order("added_date", { ascending: false })
      .limit(3),
    supabase
      .from("bookings")
      .select("*, workspaces(name)")
      .eq("member_id", user?.id)
      .in("booking_status", ["confirmed", "pending"])
      .gte("start_date_time", new Date().toISOString())
      .order("start_date_time", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("announcements")
      .select("id, title, message, type, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "Member";
  const inductionStatus = profile?.induction_status;
  const isInducted = inductionStatus === INDUCTION_STATUS.COMPLETE;
  const isSubmitted = inductionStatus === INDUCTION_STATUS.SUBMITTED;
  const memberStatus = profile?.member_status ?? MEMBER_STATUS.INACTIVE;

  return (
    <DashboardClient
      firstName={firstName}
      memberStatus={memberStatus}
      isInducted={isInducted}
      isSubmitted={isSubmitted}
      isAdmin={!!adminRecord}
      nextBooking={nextBooking ?? null}
      announcements={announcements ?? []}
      history={history ?? []}
    />
  );
}
