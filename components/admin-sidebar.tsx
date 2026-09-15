"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardCheck,
  DoorOpen,
  LayoutDashboard,
  LogOut,
  Megaphone,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "./ui/sidebar";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { adminNav, adminRoleLabel, isActiveAdminPath, type AdminIcon } from "@/lib/admin-nav";
import { initialsOf } from "@/lib/member-forms";

const ICONS: Record<AdminIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  compliance: ClipboardCheck,
  bookings: CalendarDays,
  spaces: DoorOpen,
  members: Users,
  announcements: Megaphone,
  staff: ShieldCheck,
};

type Props = { role: string | null; name: string | null; email: string | null; pendingApprovals: number };

export function AdminSidebar({ role, name, email, pendingApprovals }: Props) {
  const pathname = usePathname();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = !isMobile && state === "collapsed";
  const closeMobile = () => { if (isMobile) setOpenMobile(false); };
  const displayName = name?.trim() || email || "Admin";

  return (
    <Sidebar variant="floating" collapsible="icon" className="hub-sidebar admin-sidebar">
      {!isCollapsed && (
        <SidebarHeader className="hub-sidebar-header">
          <Link href="/admin" onClick={closeMobile} aria-label="Inspire9 admin home" className="hub-brand">
            <Image src="/images/inspire9Logo.png" alt="Inspire9" width={132} height={70} className="h-auto w-[132px]" priority />
            <span className="hub-brand-caption">Admin portal</span>
          </Link>
        </SidebarHeader>
      )}

      <SidebarContent className="hub-sidebar-content">
        {adminNav(role === "super_admin").map((group) => (
          <div key={group.label} className="hub-nav-group">
            {!isCollapsed && <p className="hub-nav-label">{group.label}</p>}
            <SidebarMenu className="gap-1">
              {group.items.map((item) => {
                const Icon = ICONS[item.icon];
                const active = isActiveAdminPath(pathname, item.href);
                const count = item.badge === "approvals" ? pendingApprovals : 0;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild tooltip={count ? `${item.label} · ${count} waiting` : item.label} isActive={active} className="hub-nav-link">
                      <Link href={item.href} onClick={closeMobile} aria-current={active ? "page" : undefined} aria-label={isCollapsed ? item.label : undefined}>
                        <Icon size={18} strokeWidth={1.7} aria-hidden />
                        {!isCollapsed && <span>{item.label}</span>}
                        {count > 0 && <span className="admin-nav-count">{count > 99 ? "99+" : count}<span className="sr-only"> waiting</span></span>}
                        {!isCollapsed && active && count === 0 && <span className="hub-nav-dot" aria-hidden />}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </div>
        ))}

        {!isCollapsed && pendingApprovals > 0 && (
          <Link href="/admin/approvals" onClick={closeMobile} className="hub-location-card admin-queue-card">
            <div className="hub-location-top">
              <span><ClipboardCheck size={13} aria-hidden /> Needs review</span>
              <ArrowUpRight size={16} aria-hidden />
            </div>
            <strong className="admin-queue-count">{pendingApprovals}</strong>
            <div className="hub-location-bottom">
              <div>
                <strong>{pendingApprovals === 1 ? "Induction waiting" : "Inductions waiting"}</strong>
                <span>Review and approve</span>
              </div>
              <span className="hub-round-arrow"><ArrowUpRight size={15} aria-hidden /></span>
            </div>
          </Link>
        )}
      </SidebarContent>

      <SidebarFooter className="hub-sidebar-footer">
        <div className="hub-member">
          <Avatar className="h-9 w-9 rounded-full">
            <AvatarFallback className="hub-avatar">{initialsOf(name?.trim() || email?.split("@")[0] || "Admin")}</AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <span className="hub-member-copy">
              <strong>{displayName}</strong>
              <span><i data-active="true" />{adminRoleLabel(role)}</span>
            </span>
          )}
        </div>
        <form action={logout}>
          <button type="submit" className="hub-logout" aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}
