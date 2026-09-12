import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner"; // 1. Import the Toaster
import "./member-hub.css";
import "./member-pages.css";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("members")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <TooltipProvider>
      <SidebarProvider style={{ "--sidebar-width": "15rem", "--sidebar-width-icon": "3.5rem" } as React.CSSProperties}>
        <div className="hub-shell">
          <AppSidebar userProfile={profile} />
          <SidebarInset className="hub-inset">
            <DashboardHeader />
            <main id="main-content" className="hub-main">{children}</main>
          </SidebarInset>
        </div>
      </SidebarProvider>

      <Toaster position="top-right" richColors closeButton />
    </TooltipProvider>
  );
}
