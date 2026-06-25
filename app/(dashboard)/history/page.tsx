import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  CreditCard,
  KeyRound,
  Activity,
  Clock,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LucideIcon,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { summarizePayments } from "@/lib/member-stats";
import HistoryHero from "./HistoryHero";

const PAGE_SIZE = 10;

type Tab = "bookings" | "payments" | "passes" | "activity";
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "bookings", label: "Bookings", icon: CalendarDays },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "passes", label: "Passes", icon: KeyRound },
  { id: "activity", label: "Activity", icon: Clock },
];

const BOOKING_FILTERS = ["all", "confirmed", "pending", "cancelled"] as const;
const PAYMENT_FILTERS = ["all", "paid", "refunded", "refund_failed"] as const;
const PASS_FILTERS = ["all", "active", "expired"] as const;

function formatDateTime(iso: string) {
  try {
    return format(parseISO(iso), "d MMM yyyy, h:mm a");
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string) {
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return iso;
  }
}

// "expired" isn't a stored DB value — passes are written "active" at issue
// time and never revisited (see app/api/webhooks/stripe/route.ts) — so an
// old pass reads as "active" forever unless we compare its expiry_date
// ourselves at display time.
function passDisplayStatus(pass: { pass_status: string; expiry_date: string }) {
  if (pass.pass_status === "active" && new Date(pass.expiry_date) < new Date()) {
    return "expired";
  }
  return pass.pass_status;
}

function statusColor(status: string) {
  const s = status?.toLowerCase();
  if (s === "confirmed" || s === "paid" || s === "active" || s === "approved")
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
  if (s === "pending") return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
  if (s === "refunded") return "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400";
  if (s === "refund_failed") return "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400";
  if (s === "cancelled" || s === "rejected") return "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
}

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  "Room Booking": CalendarDays,
  Induction: BookOpen,
};

type SearchParams = {
  tab?: string;
  bStatus?: string;
  pStatus?: string;
  passStatus?: string;
  bp?: string;
  pp?: string;
};

// Builds a /history link that preserves every current param except the ones
// being overridden — used by the tab bar, filter pills, and pagination so
// switching one thing never silently resets another.
function historyHref(current: Required<SearchParams>, overrides: Partial<SearchParams>) {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value && value !== "all" && value !== "1") params.set(key, value);
  }
  return `/history${params.size > 0 ? `?${params.toString()}` : ""}`;
}

function pickValid<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return value !== undefined && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export default async function HistoryPage(props: { searchParams: Promise<SearchParams> }) {
  const sp = await props.searchParams;
  const tab: Tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as Tab) : "bookings";
  const bStatus = pickValid(sp.bStatus, BOOKING_FILTERS, "all");
  const pStatus = pickValid(sp.pStatus, PAYMENT_FILTERS, "all");
  const passStatus = pickValid(sp.passStatus, PASS_FILTERS, "all");
  const bookingPage = Math.max(1, parseInt(sp.bp ?? "1"));
  const paymentPage = Math.max(1, parseInt(sp.pp ?? "1"));

  const current: Required<SearchParams> = {
    tab,
    bStatus,
    pStatus,
    passStatus,
    bp: String(bookingPage),
    pp: String(paymentPage),
  };

  const supabase = await createClient();
  const user = await getCurrentUser();

  const bFrom = (bookingPage - 1) * PAGE_SIZE;
  const pFrom = (paymentPage - 1) * PAGE_SIZE;

  let bookingsQuery = supabase
    .from("bookings")
    .select("*, workspaces(name, location)", { count: "exact" })
    .eq("member_id", user?.id)
    .order("start_date_time", { ascending: false });
  if (bStatus !== "all") bookingsQuery = bookingsQuery.eq("booking_status", bStatus);

  let paymentsQuery = supabase
    .from("payments")
    .select("*, bookings(start_date_time, workspaces(name))", { count: "exact" })
    .eq("member_id", user?.id)
    .order("payment_date", { ascending: false });
  if (pStatus !== "all") paymentsQuery = paymentsQuery.eq("payment_status", pStatus);

  const [
    bookingsRes,
    paymentsRes,
    passesRes,
    activityRes,
    allPaymentsRes,
    allBookingStatusRes,
    allPaymentStatusRes,
  ] = await Promise.all([
    bookingsQuery.range(bFrom, bFrom + PAGE_SIZE - 1),
    paymentsQuery.range(pFrom, pFrom + PAGE_SIZE - 1),

    supabase
      .from("access_passes")
      .select("*")
      .eq("member_id", user?.id)
      .order("issued_date", { ascending: false })
      .limit(50),

    // Use added_date (timestamptz) for precise ordering — entry_date is just a date
    supabase
      .from("community_entries")
      .select("*")
      .eq("member_id", user?.id)
      .order("added_date", { ascending: false })
      .limit(30),

    // Net spend uses the shared formula in lib/member-stats so the history
    // page and the Hub Assistant can never disagree about the numbers.
    supabase
      .from("payments")
      .select("amount, refunded_amount, payment_status")
      .eq("member_id", user?.id),

    // Lightweight, unfiltered status columns — drive both the always-true
    // stat cards and the per-filter counts on the pill row, independent of
    // whatever filter is currently applied to the paginated list above.
    supabase.from("bookings").select("booking_status").eq("member_id", user?.id),
    supabase.from("payments").select("payment_status").eq("member_id", user?.id),
  ]);

  const bookings = bookingsRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const passes = (passesRes.data ?? []).filter((pass) => {
    if (passStatus === "all") return true;
    return passDisplayStatus(pass) === passStatus;
  });
  const activity = activityRes.data ?? [];

  const allBookingStatuses = allBookingStatusRes.data ?? [];
  const allPaymentStatuses = allPaymentStatusRes.data ?? [];
  const allPasses = passesRes.data ?? [];

  const totalBookings = allBookingStatuses.length;
  const totalPayments = allPaymentStatuses.length;
  const filteredBookingCount = bookingsRes.count ?? 0;
  const filteredPaymentCount = paymentsRes.count ?? 0;
  const totalBookingPages = Math.ceil(filteredBookingCount / PAGE_SIZE);
  const totalPaymentPages = Math.ceil(filteredPaymentCount / PAGE_SIZE);

  const bookingCounts = {
    all: totalBookings,
    confirmed: allBookingStatuses.filter((b) => b.booking_status === "confirmed").length,
    pending: allBookingStatuses.filter((b) => b.booking_status === "pending").length,
    cancelled: allBookingStatuses.filter((b) => b.booking_status === "cancelled").length,
  };
  const paymentCounts = {
    all: totalPayments,
    paid: allPaymentStatuses.filter((p) => p.payment_status === "paid").length,
    refunded: allPaymentStatuses.filter((p) => p.payment_status === "refunded").length,
    refund_failed: allPaymentStatuses.filter((p) => p.payment_status === "refund_failed").length,
  };
  const passCounts = {
    all: allPasses.length,
    active: allPasses.filter((p) => passDisplayStatus(p) === "active").length,
    expired: allPasses.filter((p) => passDisplayStatus(p) === "expired").length,
  };

  const { netSpend } = summarizePayments(allPaymentsRes.data ?? []);

  return (
    <div className="w-full space-y-8 font-poppins pb-16">
      <HistoryHero totalBookings={totalBookings} netSpend={netSpend} />

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Bookings", value: totalBookings, icon: CalendarDays, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40" },
          { label: "Payments Made", value: totalPayments, icon: CreditCard, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
          { label: "Access Passes", value: allPasses.length, icon: KeyRound, color: "text-violet-600 bg-violet-50 dark:bg-violet-950/40" },
          { label: "Net Spend", value: `$${netSpend.toFixed(2)}`, icon: Activity, color: "text-[#E31E24] bg-red-50 dark:bg-red-950/40" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card
            key={label}
            className="rounded-3xl border-slate-100 dark:border-slate-800 shadow-sm hover:-translate-y-1 transition-all"
          >
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {label}
                </p>
                <p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tab bar ──────────────────────────────────────── */}
      <div className="inline-flex items-center gap-1 rounded-2xl bg-slate-100 dark:bg-slate-800 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={historyHref(current, { tab: id })}
            scroll={false}
            className={`flex items-center gap-2 rounded-xl px-5 h-11 font-bold text-sm transition-all ${
              tab === id
                ? "bg-white dark:bg-slate-900 text-[#E31E24] shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </Link>
        ))}
      </div>

      {/* ── Bookings tab ─────────────────────────────────── */}
      {tab === "bookings" && (
        <Card className="rounded-3xl border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 px-8 py-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-black text-slate-800 dark:text-slate-100">
              <CalendarDays className="w-5 h-5 text-[#E31E24]" /> Booking History
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["confirmed", "Confirmed"],
                  ["pending", "Pending"],
                  ["cancelled", "Cancelled"],
                ] as const
              ).map(([value, label]) => (
                <FilterPill
                  key={value}
                  href={historyHref(current, { bStatus: value, bp: "1" })}
                  active={bStatus === value}
                  label={label}
                  count={bookingCounts[value]}
                />
              ))}
            </div>
          </div>
          <CardContent className="p-0">
            {bookings.length === 0 ? (
              <EmptyState text={bStatus === "all" ? "No bookings found." : `No ${bStatus} bookings.`} />
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {bookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between px-8 py-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-11 w-11 bg-slate-900 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-white shrink-0">
                        <CalendarDays className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-white">
                          {b.workspaces?.name ?? "Meeting Room"}
                        </p>
                        <p className="text-xs text-slate-400 font-bold mt-0.5">
                          {formatDateTime(b.start_date_time)} →{" "}
                          {format(parseISO(b.end_date_time), "h:mm a")}
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={`${statusColor(b.booking_status)} border-none px-4 py-1 rounded-full font-black text-[10px] uppercase`}
                    >
                      {b.booking_status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          {totalBookingPages > 1 && (
            <Pagination
              page={bookingPage}
              total={totalBookingPages}
              prevHref={historyHref(current, { bp: String(bookingPage - 1) })}
              nextHref={historyHref(current, { bp: String(bookingPage + 1) })}
            />
          )}
        </Card>
      )}

      {/* ── Payments tab ─────────────────────────────────── */}
      {tab === "payments" && (
        <Card className="rounded-3xl border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 px-8 py-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-black text-slate-800 dark:text-slate-100">
              <CreditCard className="w-5 h-5 text-emerald-600" /> Payment History
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["paid", "Paid"],
                  ["refunded", "Refunded"],
                  ["refund_failed", "Refund Failed"],
                ] as const
              ).map(([value, label]) => (
                <FilterPill
                  key={value}
                  href={historyHref(current, { pStatus: value, pp: "1" })}
                  active={pStatus === value}
                  label={label}
                  count={paymentCounts[value]}
                />
              ))}
            </div>
          </div>
          <CardContent className="p-0">
            {payments.length === 0 ? (
              <EmptyState text={pStatus === "all" ? "No payments found." : `No payments with status "${pStatus}".`} />
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {payments.map((p) => {
                  const isRefunded = p.payment_status === "refunded";
                  const refundedAmt = p.refunded_amount ?? p.amount;
                  const netAmt = isRefunded ? (p.amount ?? 0) - (refundedAmt ?? 0) : p.amount;

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-8 py-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`h-11 w-11 rounded-2xl flex items-center justify-center text-white shrink-0 ${
                            isRefunded ? "bg-violet-600" : "bg-emerald-600"
                          }`}
                        >
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900 dark:text-white">
                            {p.bookings?.workspaces?.name ?? "Room Booking"}
                          </p>
                          <p className="text-xs text-slate-400 font-bold mt-0.5 capitalize">
                            {formatDateShort(p.payment_date)} · {p.payment_method}
                          </p>
                          {isRefunded && (
                            <p className="text-xs text-violet-600 dark:text-violet-400 font-bold mt-0.5">
                              ${refundedAmt?.toFixed(2)} refunded · ${netAmt?.toFixed(2)} retained
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <p
                            className={`font-black ${isRefunded ? "text-slate-400 line-through text-sm" : "text-slate-900 dark:text-white"}`}
                          >
                            ${Number(p.amount).toFixed(2)} AUD
                          </p>
                          {isRefunded && netAmt !== null && (
                            <p className="text-xs font-black text-slate-900 dark:text-slate-300">
                              ${netAmt.toFixed(2)} AUD net
                            </p>
                          )}
                        </div>
                        <Badge
                          className={`${statusColor(p.payment_status)} border-none px-3 py-1 rounded-full font-black text-[10px] uppercase`}
                        >
                          {p.payment_status.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
          {totalPaymentPages > 1 && (
            <Pagination
              page={paymentPage}
              total={totalPaymentPages}
              prevHref={historyHref(current, { pp: String(paymentPage - 1) })}
              nextHref={historyHref(current, { pp: String(paymentPage + 1) })}
            />
          )}
        </Card>
      )}

      {/* ── Passes tab ───────────────────────────────────── */}
      {tab === "passes" && (
        <Card className="rounded-3xl border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 px-8 py-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-black text-slate-800 dark:text-slate-100">
              <KeyRound className="w-5 h-5 text-violet-600" /> Access Passes
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["active", "Active"],
                  ["expired", "Expired"],
                ] as const
              ).map(([value, label]) => (
                <FilterPill
                  key={value}
                  href={historyHref(current, { passStatus: value })}
                  active={passStatus === value}
                  label={label}
                  count={passCounts[value]}
                />
              ))}
            </div>
          </div>
          <CardContent className="p-0">
            {passes.length === 0 ? (
              <EmptyState text={passStatus === "all" ? "No access passes issued yet." : `No ${passStatus} passes.`} />
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {passes.map((pass) => {
                  const displayStatus = passDisplayStatus(pass);
                  return (
                    <div
                      key={pass.id}
                      className="flex items-center justify-between px-8 py-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-11 w-11 bg-violet-600 rounded-2xl flex items-center justify-center text-white shrink-0">
                          <KeyRound className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900 dark:text-white capitalize">
                            {pass.pass_type?.replace("_", " ") ?? "Room Booking Pass"}
                          </p>
                          <p className="text-xs text-slate-400 font-bold mt-0.5">
                            Issued {formatDateShort(pass.issued_date)} · Expires{" "}
                            {formatDateShort(pass.expiry_date)}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={`${statusColor(displayStatus)} border-none px-3 py-1 rounded-full font-black text-[10px] uppercase`}
                      >
                        {displayStatus}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Activity tab ─────────────────────────────────── */}
      {tab === "activity" && (
        <Card className="rounded-3xl border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 px-8 py-5">
            <div className="flex items-center gap-2 font-black text-slate-800 dark:text-slate-100">
              <Clock className="w-5 h-5 text-blue-600" /> Activity Log
            </div>
          </div>
          <CardContent className="p-8">
            {activity.length === 0 ? (
              <EmptyState text="No activity recorded yet." />
            ) : (
              <div className="space-y-8 relative before:absolute before:inset-0 before:ml-1.5 before:h-full before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
                {activity.map((entry) => {
                  const EntryIcon = ACTIVITY_ICONS[entry.entry_type] ?? Activity;
                  return (
                    <div key={entry.id} className="flex gap-6 relative group">
                      <div
                        className={`mt-1.5 h-3 w-3 rounded-full shrink-0 ring-4 ring-white dark:ring-slate-900 z-10 transition-transform group-hover:scale-125 ${
                          entry.tags === "Approved"
                            ? "bg-emerald-500"
                            : entry.tags === "Rejected"
                              ? "bg-red-400"
                              : "bg-blue-500"
                        }`}
                      />
                      <div className="flex-1 -mt-1">
                        <div className="flex justify-between items-start gap-3">
                          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 group-hover:text-[#E31E24] transition-colors">
                            <EntryIcon className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-[#E31E24]" />
                            {entry.entry_type}
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight shrink-0">
                            {entry.added_date ? formatDateShort(entry.added_date) : entry.entry_date}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {entry.entry_description ?? "Update recorded."}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FilterPill({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-wider transition-all ${
        active
          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
          : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
      }`}
    >
      {label}
      <span className={active ? "text-white/60 dark:text-slate-900/50" : "text-slate-400"}>
        {count}
      </span>
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-slate-400 italic text-sm font-medium p-8">{text}</p>;
}

function Pagination({
  page,
  total,
  prevHref,
  nextHref,
}: {
  page: number;
  total: number;
  prevHref: string;
  nextHref: string;
}) {
  return (
    <div className="flex items-center justify-between px-8 py-5 border-t border-slate-100 dark:border-slate-800">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        Page {page} of {total}
      </p>
      <div className="flex gap-3">
        <Button
          asChild
          variant="outline"
          disabled={page <= 1}
          className="rounded-2xl border-slate-200 dark:border-slate-700 h-10 px-5 font-black text-xs"
        >
          <Link href={prevHref} scroll={false}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Prev
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          disabled={page >= total}
          className="rounded-2xl border-slate-200 dark:border-slate-700 h-10 px-5 font-black text-xs"
        >
          <Link href={nextHref} scroll={false}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
