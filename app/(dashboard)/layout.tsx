import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { TooltipProvider } from "@/components/ui/tooltip";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("members")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="flex h-screen w-full bg-[#F8F9FA]">
          <AppSidebar userProfile={profile} />
          <SidebarInset className="flex flex-col w-full">
            <header className="flex h-14 items-center gap-4 border-b bg-white px-6">
              <SidebarTrigger />
              <div className="flex-1 font-semibold text-gray-500">
                Inspire9 Hub
              </div>
            </header>

            <main className="flex-1 overflow-y-auto p-8">{children}</main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
