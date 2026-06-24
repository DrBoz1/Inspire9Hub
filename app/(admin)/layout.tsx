import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  LayoutDashboard,
  ClipboardCheck,
  CalendarDays,
  Users,
  LogOut,
  ShieldCheck,
  Megaphone,
  DoorOpen,
} from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "sonner"; // 1. Import Toaster

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

  // Get the role to determine sidebar visibility
  const { data: adminRecord } = await supabase
    .from("admins")
    .select("role")
    .eq("id", user.id)
    .single();

  const isSuperAdmin = adminRecord?.role === "super_admin";

  return (
    <div className="flex min-h-screen bg-slate-50/50 font-poppins">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-white flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-b">
          <Image
            src="/images/inspire9Logo.png"
            alt="Logo"
            width={140}
            height={40}
            className="w-35 h-10 object-contain"
          />
          <Badge className="mt-3 bg-amber-50 text-amber-700 border-none font-bold text-[10px] tracking-widest uppercase px-2">
            {isSuperAdmin ? "Super Admin Portal" : "Admin Portal"}
          </Badge>
        </div>

        <nav className="flex-1 p-4 space-y-2 mt-4">
          <AdminNavLink
            href="/admin"
            icon={LayoutDashboard}
            label="Dashboard"
          />
          <AdminNavLink
            href="/admin/approvals"
            icon={ClipboardCheck}
            label="Compliance"
          />
          <AdminNavLink
            href="/admin/bookings"
            icon={CalendarDays}
            label="Booking Schedule"
          />
          <AdminNavLink
            href="/admin/rooms"
            icon={DoorOpen}
            label="Space Management"
          />
          <AdminNavLink
            href="/admin/members"
            icon={Users}
            label="All Members"
          />
          <AdminNavLink
            href="/admin/announcements"
            icon={Megaphone}
            label="Announcements"
          />

          {/* Only show for Super Admins */}
          {isSuperAdmin && (
            <AdminNavLink
              href="/admin/management"
              icon={ShieldCheck}
              label="Staff Management"
            />
          )}
        </nav>

        <div className="p-4 border-t flex items-center gap-2">
          <form action={logout} className="flex-1">
            <button className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all group">
              <LogOut className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              Sign Out
            </button>
          </form>
          <ThemeToggle />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-y-auto">
        <div className="max-w-5xl mx-auto">{children}</div>
      </main>

      {/* 2. Add Toaster here so it's accessible to all admin pages */}
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}

function AdminNavLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: any;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-95"
    >
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  );
}
