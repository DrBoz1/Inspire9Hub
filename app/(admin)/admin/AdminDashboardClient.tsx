"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import {
  Users,
  CalendarDays,
  ClipboardCheck,
  TrendingUp,
  Clock,
  Building2,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

// Icons can't cross the server/client boundary — map string names here instead
const iconMap: Record<string, LucideIcon> = {
  ClipboardCheck,
  CalendarDays,
  Users,
  TrendingUp,
};

// ── Animation variants ────────────────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 260, damping: 22, delay: 0.1 + i * 0.08 },
  }),
};

const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.25 } },
};

const listItem = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 300, damping: 26 } },
};

// ── Types ─────────────────────────────────────────────────────────────────────

type StatCard = {
  label: string;
  value: number;
  iconName: string;
  colorClasses: string;
  href: string;
};

type Booking = {
  id: string;
  start_date_time: string;
  booking_status: string;
  workspaces: { name: string } | null;
  members: { full_name: string } | null;
};

type PendingMember = {
  id: string;
  full_name: string;
  company_name: string | null;
};

type Props = {
  stats: StatCard[];
  upcomingBookings: Booking[];
  pendingMembers: PendingMember[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusConfig(status: string) {
  switch (status?.toLowerCase()) {
    case "confirmed":
      return { label: "Confirmed", classes: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" };
    case "pending":
      return { label: "Pending",   classes: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" };
    case "cancelled":
      return { label: "Cancelled", classes: "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400" };
    default:
      return { label: status,      classes: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" };
  }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminDashboardClient({ stats, upcomingBookings, pendingMembers }: Props) {
  return (
    <div className="space-y-8 pb-10 font-poppins">

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[32px] bg-slate-950 px-10 py-10 text-white"
      >
        {/* Dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        {/* Red orb */}
        <motion.div
          animate={{ opacity: [0.18, 0.32, 0.18] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -top-16 -right-16 h-72 w-72 rounded-full bg-[#E31E24]/40 blur-3xl"
        />
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-[#E31E24] via-[#E31E24]/40 to-transparent rounded-t-[32px]" />

        <div className="relative z-10">
          <div className="mb-2 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[#E31E24]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
              Admin Portal
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tight uppercase">
            {getGreeting()},
            <br />
            <span
              style={{
                background: "linear-gradient(90deg, #fff 0%, rgba(255,255,255,0.55) 60%, #fff 100%)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "shimmer-wave 3s linear infinite",
              }}
            >
              Command Centre.
            </span>
          </h1>
          <p className="mt-3 text-sm text-white/50 font-medium max-w-sm">
            Real-time overview of hub operations — bookings, members, and compliance.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/admin/approvals"
              className="group inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-white/80 transition-all"
            >
              Approvals
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/admin/bookings"
              className="group inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-white/80 transition-all"
            >
              Bookings
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, iconName, colorClasses, href }, i) => {
          const Icon = iconMap[iconName] ?? ClipboardCheck;
          return (
            <motion.div
              key={label}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="show"
              whileHover={{ y: -5, transition: { type: "spring", stiffness: 400, damping: 25 } }}
            >
              <Link href={href}>
                <div className="group relative overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm cursor-pointer transition-shadow hover:shadow-md dark:shadow-none">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-[#E31E24]/0 via-[#E31E24]/40 to-[#E31E24]/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${colorClasses} shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 truncate">
                        {label}
                      </p>
                      <p className="text-3xl font-black text-slate-900 dark:text-white leading-none mt-0.5">
                        {value}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* ── Body grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Upcoming bookings */}
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-[28px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-7 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30">
                  <CalendarDays className="h-4 w-4 text-blue-500" />
                </div>
                <span className="text-sm font-black text-slate-800 dark:text-white">Upcoming Bookings</span>
              </div>
              <Link
                href="/admin/bookings"
                className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-[#E31E24] transition-colors"
              >
                View All →
              </Link>
            </div>

            {upcomingBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <CheckCircle2 className="h-8 w-8 text-slate-200 dark:text-slate-700" />
                <p className="text-sm font-medium text-slate-400 dark:text-slate-500">No upcoming bookings</p>
              </div>
            ) : (
              <motion.div
                variants={listContainer}
                initial="hidden"
                animate="show"
                className="divide-y divide-slate-50 dark:divide-slate-800/60"
              >
                {upcomingBookings.map((b) => {
                  const { label: statusLabel, classes: statusClasses } = statusConfig(b.booking_status);
                  return (
                    <motion.div
                      key={b.id}
                      variants={listItem}
                      className="flex items-center justify-between px-7 py-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-slate-900 dark:bg-slate-700 rounded-xl flex items-center justify-center shrink-0">
                          <Clock className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <p className="font-black text-sm text-slate-900 dark:text-white">
                            {b.workspaces?.name ?? "Room"}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold">
                            {b.members?.full_name ?? "Member"} ·{" "}
                            {format(parseISO(b.start_date_time), "d MMM, h:mm a")}
                          </p>
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusClasses}`}>
                        {statusLabel}
                      </span>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </div>
        </div>

        {/* Pending approvals */}
        <div>
          <div className="overflow-hidden rounded-[28px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm h-full">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/30">
                  <ClipboardCheck className="h-4 w-4 text-amber-500" />
                </div>
                <span className="text-sm font-black text-slate-800 dark:text-white">Pending</span>
                {pendingMembers.length > 0 && (
                  <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#E31E24] text-[9px] font-black text-white">
                    {pendingMembers.length}
                  </span>
                )}
              </div>
              <Link
                href="/admin/approvals"
                className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-[#E31E24] transition-colors"
              >
                Review →
              </Link>
            </div>

            {pendingMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center px-6">
                <CheckCircle2 className="h-8 w-8 text-emerald-300 dark:text-emerald-700" />
                <p className="text-sm font-bold text-slate-400 dark:text-slate-500">All clear!</p>
                <p className="text-xs text-slate-400 dark:text-slate-600">No pending inductions.</p>
              </div>
            ) : (
              <motion.div
                variants={listContainer}
                initial="hidden"
                animate="show"
                className="divide-y divide-slate-50 dark:divide-slate-800/60"
              >
                {pendingMembers.map((m) => (
                  <motion.div
                    key={m.id}
                    variants={listItem}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <span className="text-[13px] font-black text-amber-600 dark:text-amber-400">
                        {m.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-sm text-slate-900 dark:text-white truncate">{m.full_name}</p>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 font-bold">
                        <Building2 className="w-3 h-3 shrink-0" />
                        <span className="truncate">{m.company_name ?? "—"}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
