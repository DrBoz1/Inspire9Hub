import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminSidebar } from "@/components/admin-sidebar";
import { Toaster } from "sonner";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: adminRecord } = await supabase
    .from("admins")
    .select("role")
    .eq("id", user.id)
    .single();

  const isSuperAdmin = adminRecord?.role === "super_admin";

  return (
    <div className="flex min-h-screen bg-slate-50/50 dark:bg-slate-950 font-poppins">
      <AdminSidebar isSuperAdmin={isSuperAdmin} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-10 py-4 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#E31E24] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Inspire9 Hub
            </span>
          </div>
          <ThemeToggle />
        </div>

        <main className="flex-1 p-10 overflow-y-auto">
          <div className="max-w-5xl mx-auto">{children}</div>
        </main>
      </div>

      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
