"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
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

const spring = { type: "spring" as const, stiffness: 380, damping: 30 };

const navItems = [
  { href: "/admin",             icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/approvals",   icon: ClipboardCheck,  label: "Compliance" },
  { href: "/admin/bookings",    icon: CalendarDays,    label: "Booking Schedule" },
  { href: "/admin/rooms",       icon: DoorOpen,        label: "Space Management" },
  { href: "/admin/members",     icon: Users,           label: "All Members" },
  { href: "/admin/announcements", icon: Megaphone,     label: "Announcements" },
];

const superAdminItem = {
  href: "/admin/management",
  icon: ShieldCheck,
  label: "Staff Management",
};

function NavItem({ href, icon: Icon, label, exact = false }: {
  href: string;
  icon: React.ElementType;
  label: string;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors group"
    >
      {/* Active background pill */}
      {active && (
        <motion.div
          layoutId="admin-nav-active-bg"
          className="absolute inset-0 rounded-xl bg-red-50 dark:bg-red-950/40"
          transition={spring}
        />
      )}
      {/* Active left bar */}
      {active && (
        <motion.div
          layoutId="admin-nav-active-bar"
          className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-[#E31E24]"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={spring}
        />
      )}

      {/* Icon */}
      <motion.span
        whileHover={{ scale: 1.18 }}
        whileTap={{ scale: 0.88 }}
        transition={{ type: "spring", stiffness: 420, damping: 18 }}
        className={`relative z-10 flex shrink-0 ${
          active
            ? "text-[#E31E24]"
            : "text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300"
        }`}
      >
        <Icon className="w-4 h-4" />
      </motion.span>

      {/* Label */}
      <span
        className={`relative z-10 ${
          active
            ? "text-[#E31E24]"
            : "text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}

export function AdminSidebar({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  return (
    <aside className="w-64 border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sticky top-0 h-screen shrink-0">

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#E31E24]/80 via-[#E31E24]/30 to-transparent rounded-t-sm" />

      {/* Logo + badge */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800">
        <Image
          src="/images/inspire9Logo.png"
          alt="Inspire9 Hub"
          width={140}
          height={40}
          className="h-9 w-auto"
        />
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">
            {isSuperAdmin ? "Super Admin" : "Admin Portal"}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto mt-2" aria-label="Admin navigation">
        {navItems.map((item) => (
          <NavItem key={item.href} {...item} exact={item.href === "/admin"} />
        ))}
        {isSuperAdmin && (
          <NavItem {...superAdminItem} />
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800">
        <form action={logout}>
          <button
            type="submit"
            aria-label="Log out"
            title="Log out"
            className="flex w-full items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-[#E31E24] hover:bg-red-50 dark:hover:bg-red-950/30 transition-all group"
          >
            <motion.span
              whileHover={{ rotate: 180 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="flex shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </motion.span>
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
