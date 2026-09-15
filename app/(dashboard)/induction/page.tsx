import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { MEMBER_STATUS } from "@/lib/constants";
import { formatDateOnly, inductionStage } from "@/lib/member-forms";
import InductionClient from "./InductionClient";

export const metadata: Metadata = { title: "Induction | Inspire9 Hub" };

export default async function InductionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [{ data: member }, { data: record }] = await Promise.all([
    supabase
      .from("members")
      .select("full_name, company_name, mobile_number, member_status, induction_status")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("induction_records").select("completion_date").eq("member_id", user.id).maybeSingle(),
  ]);

  const fullName = member?.full_name?.trim() ?? "";
  return (
    <InductionClient
      stage={inductionStage(member?.induction_status)}
      memberStatus={member?.member_status ?? MEMBER_STATUS.INACTIVE}
      firstName={fullName.split(" ")[0] ?? ""}
      member={{ full_name: fullName, mobile_number: member?.mobile_number ?? "", company_name: member?.company_name ?? "" }}
      submittedOn={formatDateOnly(record?.completion_date)}
    />
  );
}
