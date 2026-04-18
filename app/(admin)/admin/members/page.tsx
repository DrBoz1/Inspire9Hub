import { createClient } from "@/lib/supabase/server";
import MembersClient from "./MembersClient";

export default async function AllMembersPage() {
  const supabase = await createClient();

  const { data: members, error } = await supabase
    .from("members")
    .select(
      `
      *,
      induction_records (
        health_emergency_info,
        completion_date
      )
    `,
    )
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Error fetching members:", error.message);
  }

  return (
    <div className="space-y-8 font-poppins">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
          Community Directory
        </h1>
        <p className="text-slate-500 font-medium text-sm mt-1">
          Manage all active and inactive residents.
        </p>
      </div>

      <MembersClient initialMembers={members || []} />
    </div>
  );
}
