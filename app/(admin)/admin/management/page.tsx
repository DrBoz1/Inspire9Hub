import { createClient } from "@/lib/supabase/server";
import ManagementClient from "./ManagementClient";

export default async function ManagementPage() {
  const supabase = await createClient();

  // Fetch all admins from database
  const { data: staff } = await supabase
    .from("admins")
    .select("*")
    .order("role", { ascending: false });

  return (
    <div className="space-y-8 font-poppins">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
          Staff Management
        </h1>
        <p className="text-slate-500 font-medium text-sm mt-1">
          Manage platform administrators and permissions.
        </p>
      </div>

      <ManagementClient initialStaff={staff || []} />
    </div>
  );
}
