import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
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
            <header className="flex h-14 items-center gap-4 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 transition-colors">
              <SidebarTrigger />
              <div className="flex-1 font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-xs">
                Inspire9 Hub
              </div>
              <ThemeToggle />
            </header>
            <main className="flex-1 overflow-y-auto p-8">{children}</main>
          </SidebarInset>
        </div>
      </SidebarProvider>

      <Toaster position="top-right" richColors closeButton />
    </TooltipProvider>
  );
}
