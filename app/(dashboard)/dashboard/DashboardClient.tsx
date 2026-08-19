"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Megaphone,
  CalendarDays,
  Wrench,
  AlertTriangle,
  Clock,
  Bell,
  BookOpen,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { getAnnouncementType } from "@/lib/announcement-types";
import { MEMBER_STATUS } from "@/lib/constants";
import BookingSuccessModal from "./BookingSuccessModal";

// ── Types ────────────────────────────────────────────────────────────────────

type AnnouncementRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
};

type HistoryRow = {
  id: string;
  entry_type: string;
  entry_description?: string | null;
  added_date?: string | null;
  entry_date?: string | null;
  tags?: string | null;
};

type NextBookingRow = {
  workspaces: { name: string } | { name: string }[] | null;
  start_date_time: string;
} | null;

export type DashboardClientProps = {
  firstName: string;
  memberStatus: string;
  isInducted: boolean;
  isSubmitted: boolean;
  isAdmin: boolean;
  nextBooking: NextBookingRow;
  announcements: AnnouncementRow[];
  history: HistoryRow[];
};

// ── Lookup tables ─────────────────────────────────────────────────────────────

const ANNOUNCEMENT_ICONS: Record<string, React.ElementType> = {
  general: Megaphone,
  event: CalendarDays,
  maintenance: Wrench,
  alert: AlertTriangle,
  hours: Clock,
  reminder: Bell,
};

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  "Room Booking": CalendarDays,
  Induction: BookOpen,
};

const TONE_STYLES: Record<string, string> = {
  emerald: "bg-emerald-500",
  red: "bg-red-400",
  blue: "bg-blue-500",
};

// ── Animation variants ────────────────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 260,
      damping: 22,
      delay: 0.25 + i * 0.09,
    },
  }),
};

const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const listItem = {
  hidden: { opacity: 0, x: -14 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 26 },
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function workspaceName(
  w: { name: string } | { name: string }[] | null,
): string {
  const room = Array.isArray(w) ? w[0] : w;
  return room?.name ?? "Meeting Room";
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ActivityItem({
  type,
  desc,
  time,
  tone,
}: {
  type: string;
  desc: string;
  time: string;
  tone: "emerald" | "red" | "blue";
}) {
  const Icon = ACTIVITY_ICONS[type] ?? Bell;
  return (
    <motion.div variants={listItem} className="flex gap-4 relative group">
      <div
        className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-4 ring-white dark:ring-slate-900 transition-transform group-hover:scale-105 ${TONE_STYLES[tone]}`}
      >
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 -mt-0.5 pb-1">
        <div className="flex justify-between items-start gap-3">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-[#E31E24] transition-colors">
            {type}
          </h4>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight shrink-0">
            {time}
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          {desc}
        </p>
      </div>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DashboardClient({
  firstName,
  memberStatus,
  isInducted,
  isSubmitted,
  isAdmin,
  nextBooking,
  announcements,
  history,
}: DashboardClientProps) {
  const greeting = getGreeting();
  const isActive = memberStatus === MEMBER_STATUS.ACTIVE;

  return (
    <div className="w-full space-y-8 font-poppins pb-10">
      <BookingSuccessModal />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative overflow-hidden rounded-[40px] bg-slate-950 px-8 py-10 md:px-12 md:py-12 text-white shadow-2xl shadow-slate-900/30"
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-linear-to-r from-transparent via-[#E31E24]/80 to-transparent" />

        {/* Animated red orb */}
        <motion.div
          animate={{ opacity: [0.15, 0.35, 0.15], scale: [1, 1.08, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-[#E31E24] blur-3xl pointer-events-none"
        />

        {/* Secondary dim orb bottom-left */}
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />

        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
          {/* Left: greeting */}
          <div className="space-y-3 max-w-xl">
            {/* Member status pill */}
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/70"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full animate-pulse ${isActive ? "bg-emerald-400" : "bg-amber-400"}`}
              />
              <Sparkles className="w-2.5 h-2.5 text-[#E31E24]" />
              {memberStatus} Member
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.45, ease: "easeOut" }}
              className="text-4xl md:text-5xl font-black tracking-tight leading-[0.95]"
            >
              {greeting},{" "}
              <span
                style={{
                  background:
                    "linear-gradient(90deg, #E31E24 0%, #ff6b6b 40%, #E31E24 100%)",
                  backgroundSize: "200% auto",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  animation: "shimmer-wave 3s linear infinite",
                }}
              >
                {firstName}.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="text-slate-400 font-medium"
            >
              Welcome back to Inspire9 Hub.
            </motion.p>
          </div>

          {/* Right: actions */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap gap-3 shrink-0"
          >
            {isAdmin && (
              <Button
                asChild
                variant="outline"
                className="rounded-xl border-amber-400/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border font-bold transition-all"
              >
                <Link href="/admin/approvals">
                  <ShieldCheck className="w-4 h-4 mr-2" /> Admin Portal
                </Link>
              </Button>
            )}
            <Button
              asChild
              variant="outline"
              className="rounded-xl border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white font-semibold transition-all"
            >
              <Link href="/support">Support</Link>
            </Button>
            <Button
              asChild
              className="bg-[#E31E24] hover:bg-red-700 text-white rounded-xl px-6 font-bold shadow-lg shadow-red-900/30 transition-all active:scale-95 overflow-hidden relative group"
            >
              <Link href="/bookings">
                {/* shimmer sweep on hover */}
                <span
                  className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
                    backgroundSize: "200% auto",
                    animation: "shimmer-wave 1.8s linear infinite",
                  }}
                />
                <span className="relative z-10 flex items-center gap-2">
                  + Book a Space
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* ── Induction banner ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {!isInducted && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className={`flex flex-col md:flex-row items-center justify-between p-6 bg-white dark:bg-slate-900 border-l-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-all ${
              isSubmitted ? "border-l-amber-500" : "border-l-[#E31E24]"
            }`}
          >
            <div className="flex gap-4 items-start">
              <div
                className={`p-3 rounded-2xl ${isSubmitted ? "bg-amber-50" : "bg-red-50"}`}
              >
                <AlertCircle
                  className={`w-6 h-6 ${isSubmitted ? "text-amber-500" : "text-[#E31E24]"}`}
                />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                  {isSubmitted
                    ? "Induction Under Review"
                    : "Action Required: Complete Induction"}
                </h3>
                <p className="text-sm text-slate-500 max-w-lg leading-relaxed">
                  {isSubmitted
                    ? "Final review by Hub management in progress."
                    : "Complete the briefing to unlock 24/7 access."}
                </p>
              </div>
            </div>
            {!isSubmitted && (
              <Button
                asChild
                className="mt-4 md:mt-0 bg-[#E31E24] hover:bg-red-700 text-white rounded-xl px-8 py-7 font-bold text-md shadow-md shadow-red-100 transition-all"
              >
                <Link href="/induction">
                  Start Induction <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Announcements ─────────────────────────────────────────────────── */}
      {announcements.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Megaphone className="w-3.5 h-3.5" /> Hub Announcements
          </p>
          <motion.div
            variants={listContainer}
            initial="hidden"
            animate="show"
            className="space-y-3"
          >
            {announcements.map((a) => {
              const t = getAnnouncementType(a.type);
              const Icon = ANNOUNCEMENT_ICONS[a.type] ?? Megaphone;
              return (
                <motion.div
                  key={a.id}
                  variants={listItem}
                  className={`flex items-start gap-4 p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm border-l-4 ${t.border}`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${t.badge}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-slate-900 dark:text-white text-sm">
                        {a.title}
                      </p>
                      <Badge
                        className={`${t.badge} border-none font-black text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full`}
                      >
                        {t.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 font-medium mt-0.5 leading-relaxed">
                      {a.message}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight shrink-0">
                    {format(parseISO(a.created_at), "d MMM")}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Account Status */}
        <motion.div
          custom={0}
          variants={cardVariants}
          initial="hidden"
          animate="show"
          whileHover={{ y: -5, transition: { type: "spring", stiffness: 380, damping: 24 } }}
          className="h-full"
        >
          <Card className="h-full rounded-3xl border-slate-100 dark:border-slate-800 shadow-sm group hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                Account Status
              </p>
              <Badge
                className={`${
                  isActive
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-amber-50 text-amber-600"
                } border-none px-3 py-1 rounded-full font-bold capitalize`}
              >
                {memberStatus}
              </Badge>
            </CardHeader>
            <CardContent className="pt-2">
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 group-hover:text-[#E31E24] transition-colors duration-300">
                Standard Resident
              </h2>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-4 italic">
                Membership Managed via Stripe
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Compliance Progress */}
        <motion.div
          custom={1}
          variants={cardVariants}
          initial="hidden"
          animate="show"
          whileHover={{ y: -5, transition: { type: "spring", stiffness: 380, damping: 24 } }}
          className="h-full"
        >
          <Card className="h-full rounded-3xl border-slate-100 dark:border-slate-800 shadow-sm group hover:shadow-md transition-shadow">
            <CardHeader>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">
                Compliance Progress
              </p>
            </CardHeader>
            <CardContent className="pt-2">
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 group-hover:text-[#E31E24] transition-colors duration-300">
                {isInducted
                  ? "Verified ✓"
                  : isSubmitted
                    ? "Reviewing…"
                    : "Pending"}
              </h2>
              <Progress
                value={isInducted ? 100 : isSubmitted ? 75 : 25}
                className={`h-2.5 mt-4 bg-slate-100 rounded-full ${
                  isInducted
                    ? "[&>div]:bg-emerald-500"
                    : isSubmitted
                      ? "[&>div]:bg-amber-500"
                      : "[&>div]:bg-[#E31E24]"
                }`}
              />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-3">
                {isInducted
                  ? "Full hub access unlocked"
                  : isSubmitted
                    ? "Awaiting admin review"
                    : "Action needed — start induction"}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Next Booking */}
        <motion.div
          custom={2}
          variants={cardVariants}
          initial="hidden"
          animate="show"
          whileHover={{ y: -5, transition: { type: "spring", stiffness: 380, damping: 24 } }}
          className="h-full"
        >
          <Card className="h-full rounded-3xl border-slate-100 dark:border-slate-800 shadow-sm group hover:shadow-md transition-shadow overflow-hidden relative">
            {/* Subtle background pattern when booked */}
            {nextBooking && (
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #E31E24 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
            )}
            <CardHeader>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" /> Next Booking
              </p>
            </CardHeader>
            <CardContent className="pt-2 relative">
              {nextBooking ? (
                <>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 group-hover:text-[#E31E24] transition-colors duration-300">
                    {workspaceName(nextBooking.workspaces)}
                  </h2>
                  <p className="text-[11px] text-slate-500 font-bold mt-2 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {format(
                      parseISO(nextBooking.start_date_time),
                      "EEE d MMM, h:mm a",
                    )}
                  </p>
                  <Link
                    href="/bookings"
                    className="text-[11px] text-[#E31E24] font-black mt-4 inline-flex items-center gap-1 uppercase tracking-wider hover:underline decoration-2 underline-offset-4"
                  >
                    View Schedule <ArrowRight className="w-3 h-3" />
                  </Link>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">
                    No Bookings
                  </h2>
                  <p className="text-[11px] text-slate-400 font-bold mt-2">
                    You have no upcoming reservations.
                  </p>
                  <Link
                    href="/bookings"
                    className="text-[11px] text-[#E31E24] font-black mt-4 inline-flex items-center gap-1 uppercase tracking-wider hover:underline decoration-2 underline-offset-4"
                  >
                    Explore Spaces <ArrowRight className="w-3 h-3" />
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Recent Activity ────────────────────────────────────────────────── */}
      <Card className="rounded-3xl border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-50 dark:border-slate-800 px-8 py-6">
          <CardTitle className="text-xl font-black text-slate-800 dark:text-slate-100">
            Recent Activity
          </CardTitle>
          <Button
            asChild
            variant="ghost"
            className="text-[10px] text-slate-400 uppercase font-black tracking-widest hover:text-[#E31E24]"
          >
            <Link href="/history">View History →</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-8">
          <div className="space-y-7 relative before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
            {history.length > 0 ? (
              <motion.div
                variants={listContainer}
                initial="hidden"
                animate="show"
                className="space-y-7"
              >
                {history.map((entry) => (
                  <ActivityItem
                    key={entry.id}
                    type={entry.entry_type}
                    desc={entry.entry_description ?? "Update log recorded."}
                    time={
                      entry.added_date
                        ? format(parseISO(entry.added_date), "d MMM")
                        : (entry.entry_date ?? "—")
                    }
                    tone={
                      entry.tags === "Approved"
                        ? "emerald"
                        : entry.tags === "Rejected"
                          ? "red"
                          : "blue"
                    }
                  />
                ))}
              </motion.div>
            ) : (
              <p className="text-slate-400 font-medium italic text-sm">
                No activity recorded in the hub yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
