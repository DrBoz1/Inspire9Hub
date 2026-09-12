"use client";

import { LayoutDashboard, BookOpen, CalendarDays, User, LogOut, History, LifeBuoy, Map, ArrowUpRight, MapPin } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { logout } from "@/app/(auth)/actions";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "./ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { INDUCTION_STATUS } from "@/lib/constants";
import { FloorplanPreview } from "./floorplan-preview";

type MemberProfile = {
  full_name?: string | null;
  avatar_url?: string | null;
  induction_status?: string | null;
  member_status?: string | null;
};

export function AppSidebar({ userProfile }: { userProfile: MemberProfile | null }) {
  const pathname = usePathname();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = !isMobile && state === "collapsed";
  const status = userProfile?.induction_status;
  const hideInduction = status === INDUCTION_STATUS.COMPLETE || status === INDUCTION_STATUS.SUBMITTED;
  const closeMobile = () => { if (isMobile) setOpenMobile(false); };
  const initials = userProfile?.full_name?.split(" ").filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase() || "I9";
  const groups = [
    { label: "Your workspace", items: [
      { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
      { title: "Spaces", url: "/spaces", icon: Map },
      { title: "Bookings", url: "/bookings", icon: CalendarDays },
      { title: "Activity", url: "/history", icon: History },
    ] },
    { label: "Membership", items: [
      ...(!hideInduction ? [{ title: "Induction", url: "/induction", icon: BookOpen }] : []),
      { title: "My profile", url: "/profile", icon: User },
      { title: "Help & support", url: "/support", icon: LifeBuoy },
    ] },
  ];

  return (
    <Sidebar variant="floating" collapsible="icon" className="hub-sidebar">
      <SidebarHeader className="hub-sidebar-header">
        <Link href="/dashboard" onClick={closeMobile} aria-label="Inspire9 Hub home" className="hub-brand">
          {isCollapsed ? <span className="hub-monogram">i<span>9</span></span> : <>
            <Image src="/images/inspire9Logo.png" alt="Inspire9" width={132} height={46} className="h-auto w-[132px]" priority />
            <span className="hub-brand-caption">The member hub</span>
          </>}
        </Link>
      </SidebarHeader>
      <SidebarContent className="hub-sidebar-content">
        {groups.map(group => <div key={group.label} className="hub-nav-group">
          {!isCollapsed && <p className="hub-nav-label">{group.label}</p>}
          <SidebarMenu className="gap-1">
            {group.items.map(item => {
              const active = pathname === item.url || pathname.startsWith(`${item.url}/`);
              return <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild tooltip={item.title} isActive={active} className="hub-nav-link">
                  <Link href={item.url} onClick={closeMobile} aria-current={active ? "page" : undefined} aria-label={isCollapsed ? item.title : undefined}>
                    <item.icon size={18} strokeWidth={1.7} aria-hidden />
                    {!isCollapsed && <><span>{item.title}</span>{active && <span className="hub-nav-dot" aria-hidden />}</>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>;
            })}
          </SidebarMenu>
        </div>)}
        {!isCollapsed && <Link href="/spaces" onClick={closeMobile} className="hub-location-card">
          <div className="hub-location-top"><span><MapPin size={13} /> Your place to connect</span><ArrowUpRight size={16} /></div>
          <FloorplanPreview />
          <div className="hub-location-bottom"><div><strong>Find your space</strong><span>Explore Level 1</span></div><span className="hub-round-arrow"><ArrowUpRight size={15} /></span></div>
        </Link>}
      </SidebarContent>
      <SidebarFooter className="hub-sidebar-footer">
        <Link href="/profile" onClick={closeMobile} className="hub-member" aria-label="View your profile">
          <Avatar className="h-9 w-9 rounded-full">
            <AvatarImage src={userProfile?.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="hub-avatar">{initials}</AvatarFallback>
          </Avatar>
          {!isCollapsed && <span className="hub-member-copy"><strong>{userProfile?.full_name || "New member"}</strong><span><i data-active={userProfile?.member_status === "Active"} />{userProfile?.member_status || "Inactive"} member</span></span>}
        </Link>
        <form action={logout}><button type="submit" className="hub-logout" aria-label="Log out" title="Log out"><LogOut size={16} /></button></form>
      </SidebarFooter>
    </Sidebar>
  );
}
