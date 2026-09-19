import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-guard";
import { StaffBoard } from "./StaffBoard";
import { loadCandidates, loadStaff } from "./staff-data";

export const metadata: Metadata = { title: "Staff management | Inspire9 Hub" };

// Who holds admin access is checked against Supabase Auth on every request, never a prerendered snapshot.
export const dynamic = "force-dynamic";

export default async function StaffManagementPage() {
  // Super admins only. The proxy says so too; this holds even if it didn't.
  const guard = await requireAdmin(["super_admin"]);
  if ("error" in guard) redirect("/admin");
  const staff = await loadStaff();
  const candidates = await loadCandidates(staff.map((s) => s.id));

  return (
    <div className="hub-page admin-staff-page">
      <StaffBoard initialStaff={staff} candidates={candidates} currentId={guard.user.id} />
    </div>
  );
}
