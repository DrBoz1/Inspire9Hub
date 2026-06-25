import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner"; // 1. Import the Toaster

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
      <SidebarProvider>
        <div className="flex h-screen w-full bg-[#F8F9FA] dark:bg-slate-950 font-poppins transition-colors">
          <AppSidebar userProfile={profile} />
          <SidebarInset className="flex flex-col w-full">
            <DashboardHeader />
            <main className="flex-1 overflow-y-auto p-8">{children}</main>
          </SidebarInset>
        </div>
      </SidebarProvider>

      <Toaster position="top-right" richColors closeButton />
    </TooltipProvider>
  );
}
