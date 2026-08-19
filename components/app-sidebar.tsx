"use client";

import { motion, AnimatePresence, type Transition } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  User,
  LogOut,
  History,
  LifeBuoy,
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
    { title: "Support", url: "/support", icon: LifeBuoy },
  ];

  const initials =
    userProfile?.full_name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase() || "??";

  const isProfileActive = pathname === "/profile";

  // ── Shared spring config for layout animations ──────────────────────────
  const spring = { type: "spring" as const, stiffness: 380, damping: 30 };
  const fadeSlide: Transition = { duration: 0.18, ease: "easeOut" };

  return (
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className="border-r border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900"
    >
      {/* ── Header: logo (fades out on collapse, nothing replaces it) ──── */}
      <SidebarHeader className="flex items-center justify-center border-b border-gray-100 dark:border-slate-800 p-4 shrink-0">
        <div className="h-12 flex items-center justify-center overflow-hidden">
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                key="logo"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <Image
                  src="/images/inspire9Logo.png"
                  alt="Inspire9 Hub"
                  width={140}
                  height={48}
                  className="h-12 w-auto"
                  priority
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SidebarHeader>

      {/* ── Nav items ───────────────────────────────────────────────────── */}
      <SidebarContent className="py-4">
        <SidebarMenu className="px-2 gap-0.5">

          {/* "Navigation" section label */}
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.p
                key="nav-section"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={fadeSlide}
                className="px-3 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-slate-600 mb-2 mt-1"
                aria-hidden
              >
                Navigation
              </motion.p>
            )}
          </AnimatePresence>

          {navItems.map((item) => {
            const active = pathname === item.url;
            return (
              <SidebarMenuItem key={item.title}>
                {/* Sliding active background — layoutId creates the
                    shared-element transition between items on navigation */}
                {active && (
                  <motion.div
                    layoutId="nav-active-bg"
                    className="absolute inset-0 rounded-xl bg-red-50 dark:bg-red-950/40"
                    transition={spring}
                    aria-hidden
                  />
                )}

                {/* Left accent bar — only in expanded state */}
                {active && !isCollapsed && (
                  <motion.div
                    layoutId="nav-active-bar"
                    className="absolute left-0 top-2 bottom-2 w-0.75 rounded-full bg-[#E31E24] z-10"
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={spring}
                    aria-hidden
                  />
                )}

                <SidebarMenuButton
                  asChild
                  isActive={false}
                  tooltip={item.title}
                  className={`relative z-10 rounded-xl h-11 overflow-hidden bg-transparent hover:bg-gray-50 dark:hover:bg-slate-800/80 transition-colors ${
                    active
                      ? "text-[#E31E24] dark:text-red-400 font-bold hover:bg-red-50/60! dark:hover:bg-red-950/30!"
                      : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 font-medium"
                  }`}
                >
                  <Link
                    href={item.url}
                    aria-current={active ? "page" : undefined}
                    className="flex items-center gap-3 px-3 h-full w-full"
                  >
                    {/* Icon with spring scale on hover */}
                    <motion.span
                      whileHover={{ scale: 1.18 }}
                      whileTap={{ scale: 0.88 }}
                      transition={{ type: "spring", stiffness: 420, damping: 18 }}
                      className="shrink-0 flex items-center"
                      aria-hidden
                    >
                      <item.icon
                        className={`w-4 h-4 transition-colors ${
                          active
                            ? "text-[#E31E24] dark:text-red-400"
                            : "text-gray-400 dark:text-slate-500"
                        }`}
                      />
                    </motion.span>

                    {/* Label fades & slides when sidebar collapses */}
                    <AnimatePresence initial={false}>
                      {!isCollapsed && (
                        <motion.span
                          key={`label-${item.title}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -8 }}
                          transition={fadeSlide}
                          className="text-sm truncate"
                        >
                          {item.title}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}

          {/* "Account" section label */}
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.p
                key="account-section"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={fadeSlide}
                className="px-3 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-slate-600 mb-2 mt-5"
                aria-hidden
              >
                Account
              </motion.p>
            )}
          </AnimatePresence>

          {/* Profile — same layoutId family as navItems */}
          <SidebarMenuItem>
            {isProfileActive && (
              <motion.div
                layoutId="nav-active-bg"
                className="absolute inset-0 rounded-xl bg-red-50 dark:bg-red-950/40"
                transition={spring}
                aria-hidden
              />
            )}
            {isProfileActive && !isCollapsed && (
              <motion.div
                layoutId="nav-active-bar"
                className="absolute left-0 top-2 bottom-2 w-0.75 rounded-full bg-[#E31E24] z-10"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={spring}
                aria-hidden
              />
            )}
            <SidebarMenuButton
              asChild
              isActive={false}
              tooltip="Profile"
              className={`relative z-10 rounded-xl h-11 overflow-hidden bg-transparent hover:bg-gray-50 dark:hover:bg-slate-800/80 transition-colors ${
                isProfileActive
                  ? "text-[#E31E24] dark:text-red-400 font-bold hover:bg-red-50/60! dark:hover:bg-red-950/30!"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 font-medium"
              }`}
            >
              <Link
                href="/profile"
                aria-current={isProfileActive ? "page" : undefined}
                className="flex items-center gap-3 px-3 h-full w-full"
              >
                <motion.span
                  whileHover={{ scale: 1.18 }}
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 420, damping: 18 }}
                  className="shrink-0 flex items-center"
                  aria-hidden
                >
                  <User
                    className={`w-4 h-4 transition-colors ${
                      isProfileActive
                        ? "text-[#E31E24] dark:text-red-400"
                        : "text-gray-400 dark:text-slate-500"
                    }`}
                  />
                </motion.span>
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.span
                      key="profile-label"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={fadeSlide}
                      className="text-sm truncate"
                    >
                      Profile
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      {/* ── Footer: avatar + name + logout ──────────────────────────────── */}
      <SidebarFooter className="border-t border-gray-100 dark:border-slate-800 p-3">
        <div
          className={`flex items-center gap-3 ${
            isCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          {/* Avatar — subtle hover lift */}
          <div className="flex items-center gap-3 min-w-0">
            <motion.div
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 420, damping: 18 }}
              className="shrink-0"
            >
              <Avatar className="h-8 w-8 rounded-xl border border-gray-100 dark:border-slate-700">
                <AvatarImage src={userProfile?.avatar_url} alt={userProfile?.full_name} />
                <AvatarFallback className="bg-red-50 dark:bg-red-950/40 text-[#E31E24] dark:text-red-400 font-black text-xs rounded-xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </motion.div>

            {/* Name + status — fades in/out on collapse */}
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  key="user-info"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={fadeSlide}
                  className="flex flex-col text-left min-w-0"
                >
                  <span className="text-sm font-bold text-gray-700 dark:text-slate-200 truncate leading-tight">
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Logout — fades in/out, has its own spring hover */}
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                key="logout"
                initial={{ opacity: 0, scale: 0.75 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.75 }}
                transition={{ duration: 0.16 }}
              >
                <form action={logout}>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.12 }}
                    whileTap={{ scale: 0.88 }}
                    transition={{ type: "spring", stiffness: 420, damping: 18 }}
                    aria-label="Log out"
                    title="Log out"
                    className="flex items-center justify-center p-1.5 rounded-lg text-gray-300 dark:text-slate-600 hover:text-[#E31E24] dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
