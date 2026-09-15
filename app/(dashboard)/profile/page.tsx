import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { BOOKING_STATUS, MEMBER_STATUS } from "@/lib/constants";
import { HUB_TIMEZONE } from "@/lib/datetime";
import { inductionStage } from "@/lib/member-forms";
import ProfileClient from "./ProfileClient";

export const metadata: Metadata = { title: "My profile | Inspire9 Hub" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [{ data: profile }, { count }] = await Promise.all([
    supabase
      .from("members")
      .select("full_name, email, company_name, mobile_number, member_status, induction_status")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("member_id", user.id)
      .in("booking_status", [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED]),
  ]);

  return (
    <ProfileClient
      member={{
        full_name: profile?.full_name ?? "",
        mobile_number: profile?.mobile_number ?? "",
        company_name: profile?.company_name ?? "",
        email: profile?.email ?? user.email ?? "",
        memberStatus: profile?.member_status ?? MEMBER_STATUS.INACTIVE,
        inductionStage: inductionStage(profile?.induction_status),
      }}
      memberSince={new Intl.DateTimeFormat("en-AU", { month: "short", year: "numeric", timeZone: HUB_TIMEZONE }).format(new Date(user.created_at))}
      bookingCount={count ?? 0}
    />
  );
}
