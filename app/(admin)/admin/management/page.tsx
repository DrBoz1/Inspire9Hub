import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StaffBoard } from "./StaffBoard";
import { loadCandidates, loadStaff } from "./staff-data";

export const metadata: Metadata = { title: "Staff management | Inspire9 Hub" };

// Who holds admin access is checked against Supabase Auth on every request, never a prerendered snapshot.
export const dynamic = "force-dynamic";

export default async function StaffManagementPage() {
  const supabase = await createClient();
  const [{ data: auth }, staff] = await Promise.all([supabase.auth.getUser(), loadStaff()]);
  const candidates = await loadCandidates(staff.map((s) => s.id));

  return (
    <div className="hub-page admin-staff-page">
      <StaffBoard initialStaff={staff} candidates={candidates} currentId={auth.user?.id ?? null} />
    </div>
  );
}
