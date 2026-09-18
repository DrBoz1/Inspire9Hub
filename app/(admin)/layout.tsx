import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminSidebar } from "@/components/admin-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { INDUCTION_STATUS } from "@/lib/constants";
// The admin frame is the member hub's frame; admin.css adds the admin-only pieces.
import "../(dashboard)/member-hub.css";
import "../(dashboard)/member-pages.css";
import "../(dashboard)/member-account.css";
import "./admin.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: admin }, { count: pendingApprovals }, { count: newLeads }] = await Promise.all([
    supabase.from("admins").select("role, full_name, email").eq("id", user.id).single(),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("induction_status", INDUCTION_STATUS.SUBMITTED),
    // The service-role client: leads are closed to signed-in sessions, so this one would always count 0.
    // A missing table (before add_leads.sql) comes back as an error with no count, which reads as 0.
    createAdminClient().from("leads").select("id", { count: "exact", head: true }).eq("stage", "new"),
  ]);

  return (
    <TooltipProvider>
      <SidebarProvider style={{ "--sidebar-width": "15rem", "--sidebar-width-icon": "3.5rem" } as React.CSSProperties}>
        <div className="hub-shell admin-shell">
          <AdminSidebar
            role={admin?.role ?? null}
            name={admin?.full_name ?? null}
            email={admin?.email ?? user.email ?? null}
            pendingApprovals={pendingApprovals ?? 0}
            newLeads={newLeads ?? 0}
          />
          <SidebarInset className="hub-inset">
            <DashboardHeader area="admin" />
            <main id="main-content" className="hub-main">
              <div className="admin-content">{children}</div>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
      <Toaster position="top-right" richColors closeButton />
    </TooltipProvider>
  );
}
