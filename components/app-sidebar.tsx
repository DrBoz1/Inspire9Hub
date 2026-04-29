"use client";

import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  User,
  LogOut,
  History,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { logout } from "@/app/(auth)/actions";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "./ui/sidebar";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { INDUCTION_STATUS } from "@/lib/constants";

export function AppSidebar({ userProfile }: { userProfile: any }) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const status = userProfile?.induction_status;
  const hideInduction =
    status === INDUCTION_STATUS.COMPLETE ||
    status === INDUCTION_STATUS.SUBMITTED;

  const navItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    ...(!hideInduction
      ? [{ title: "Induction", url: "/induction", icon: BookOpen }]
      : []),
    { title: "Bookings", url: "/bookings", icon: CalendarDays },
    { title: "History", url: "/history", icon: History },
  ];

  const initials =
    userProfile?.full_name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase() || "??";

  return (
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className="border-r border-gray-100 bg-white"
    >
      {/* ── Header: logo / icon ─────────────────────────────── */}
      <SidebarHeader className="flex items-center justify-center overflow-hidden border-b border-gray-100 h-18 shrink-0">
        {/* Full logo — visible when expanded */}
        <div
          className={
            isCollapsed
              ? "hidden"
              : "flex items-center justify-center w-full px-4"
          }
        >
          <Image
            src="/images/inspire9Logo.png"
            alt="Inspire9 Logo"
            width={140}
            height={48}
            className="object-contain"
            priority
          />
        </div>

        {/* Compact icon — visible when collapsed */}
        <div
          className={
            isCollapsed
              ? "flex items-center justify-center"
              : "hidden"
          }
        >
          <div className="h-9 w-9 bg-[#E31E24] rounded-xl flex items-center justify-center text-white font-black text-lg italic shadow-sm select-none">
            9
          </div>
        </div>
      </SidebarHeader>

      {/* ── Nav items ───────────────────────────────────────── */}
      <SidebarContent className="py-4">
        <SidebarMenu className="px-2 gap-0.5">
          {!isCollapsed && (
            <p className="px-3 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 mt-1">
              Navigation
            </p>
          )}

          {navItems.map((item) => {
            const active = pathname === item.url;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.title}
                  className={`rounded-xl transition-all h-11 ${
                    active
                      ? "bg-red-50 text-[#E31E24] font-bold"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-800 font-medium"
                  }`}
                >
                  <Link href={item.url} className="flex items-center gap-3 px-3">
                    <item.icon
                      className={`w-4 h-4 shrink-0 ${active ? "text-[#E31E24]" : "text-gray-400"}`}
                    />
                    <span className="text-sm truncate">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}

          {!isCollapsed && (
            <p className="px-3 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 mt-5">
              Account
            </p>
          )}

          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/profile"}
              tooltip="Profile"
              className={`rounded-xl transition-all h-11 ${
                pathname === "/profile"
                  ? "bg-red-50 text-[#E31E24] font-bold"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800 font-medium"
              }`}
            >
              <Link href="/profile" className="flex items-center gap-3 px-3">
                <User
                  className={`w-4 h-4 shrink-0 ${pathname === "/profile" ? "text-[#E31E24]" : "text-gray-400"}`}
                />
                <span className="text-sm">Profile</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      {/* ── Footer: user info + logout ──────────────────────── */}
      <SidebarFooter className="border-t border-gray-100 p-3">
        <div
          className={`flex items-center gap-3 ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-8 w-8 shrink-0 rounded-xl border border-gray-100">
              <AvatarImage src={userProfile?.avatar_url} />
              <AvatarFallback className="bg-red-50 text-[#E31E24] font-black text-xs rounded-xl">
                {initials}
              </AvatarFallback>
            </Avatar>

            {!isCollapsed && (
              <div className="flex flex-col text-left min-w-0">
                <span className="text-sm font-bold text-gray-700 truncate leading-tight">
                  {userProfile?.full_name || "New User"}
                </span>
                <span
                  className={`text-xs font-semibold capitalize leading-tight ${
                    userProfile?.member_status === "Active"
                      ? "text-emerald-500"
                      : "text-amber-500"
                  }`}
                >
                  {userProfile?.member_status || "Inactive"}
                </span>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <form action={logout}>
              <button
                type="submit"
                className="text-gray-300 hover:text-[#E31E24] transition-colors p-1.5 rounded-lg hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
