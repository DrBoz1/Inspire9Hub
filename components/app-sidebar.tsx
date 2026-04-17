"use client";

import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  User,
  LogOut,
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

  // FIX: Hide if status is COMPLETE or SUBMITTED (Issue #2)
  const status = userProfile?.induction_status;
  const hideInduction =
    status === INDUCTION_STATUS.COMPLETE ||
    status === INDUCTION_STATUS.SUBMITTED;

  const navItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    // Show induction ONLY if it's not hidden
    ...(!hideInduction
      ? [{ title: "Induction", url: "/induction", icon: BookOpen }]
      : []),
    { title: "Bookings", url: "/bookings", icon: CalendarDays },
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
      className="border-r border-gray-200"
    >
      <SidebarHeader className="p-4 flex items-center justify-center">
        {!isCollapsed ? (
          <Image
            src="/images/inspire9Logo.png"
            alt="Inspire9 Logo"
            width={180}
            height={60}
            className="object-contain"
          />
        ) : (
          <div className="h-8 w-8 bg-[#E31E24] rounded-lg flex items-center justify-center text-white font-bold italic">
            9
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu className="px-2 gap-1">
          {!isCollapsed && (
            <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 mt-4">
              Overview
            </p>
          )}
          {navItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.url}
                tooltip={item.title}
                className="hover:bg-red-50 hover:text-red-600 transition-colors py-6"
              >
                <Link href={item.url}>
                  <item.icon className="w-5 h-5 shrink-0" />
                  {!isCollapsed && (
                    <span className="font-medium ml-2">{item.title}</span>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}

          {!isCollapsed && (
            <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-6 mb-2">
              Account
            </p>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/profile"}
              tooltip="Profile"
              className="py-6"
            >
              <Link href="/profile">
                <User className="w-5 h-5 shrink-0" />
                {!isCollapsed && (
                  <span className="font-medium ml-2">Profile</span>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-2 border-t overflow-hidden">
        <div
          className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"} w-full p-2`}
        >
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 shrink-0 rounded-lg">
              <AvatarImage src={userProfile?.avatar_url} />
              <AvatarFallback className="bg-red-100 text-red-600 font-bold text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex flex-col text-left text-sm whitespace-nowrap">
                <span className="font-bold text-gray-700 truncate">
                  {userProfile?.full_name || "New User"}
                </span>
                <span
                  className={`text-xs capitalize font-medium ${userProfile?.member_status === "Active" ? "text-emerald-500" : "text-amber-500"}`}
                >
                  {userProfile?.member_status || "Inactive"}
                </span>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <form action={logout}>
              <button className="text-gray-400 hover:text-red-600 transition-colors p-1">
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
