import { createClient } from "@/lib/supabase/server";
import MembersClient from "./MembersClient";

export default async function AllMembersPage() {
  const supabase = await createClient();

  // Fetch all members with their related membership and induction info
  const { data: members, error } = await supabase
    .from("members")
    .select(
      `
      *,
      memberships (
        membership_type,
        start_date,
        end_date,
        payment_status
      ),
      induction_records (
        health_emergency_info,
        completion_date
      )
    `,
    )
    .order("full_name", { ascending: true });

  if (error) console.error("Error fetching members:", error.message);

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

      {/* Pass the data to the Client Component for interactivity */}
      <MembersClient initialMembers={members || []} />
    </div>
  );
}
