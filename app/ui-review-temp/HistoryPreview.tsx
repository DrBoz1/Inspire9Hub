import { createClient, getCurrentUser } from "./mock-server";
import {
  CalendarDays,
  CreditCard,
  KeyRound,
  Clock,
  ChevronLeft,
  ChevronRight,
  LucideIcon,
} from "lucide-react";
import { HUB_TIMEZONE } from "@/lib/datetime";
import { ActivityMark } from "@/components/activity-mark";
import Link from "next/link";
import { summarizePayments } from "@/lib/member-stats";
import HistoryHero from "@/app/(dashboard)/history/HistoryHero";

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
    return new Date(iso).toLocaleString("en-AU", { timeZone: HUB_TIMEZONE, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-AU", { timeZone: HUB_TIMEZONE, day: "numeric", month: "short", year: "numeric" });
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
  return `/ui-review-temp?page=history&${params.size > 0 ? `${params.toString()}` : ""}`;
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
  const bookingPage = Math.max(1, Math.min(100000, parseInt(sp.bp ?? "1") || 1));
  const paymentPage = Math.max(1, Math.min(100000, parseInt(sp.pp ?? "1") || 1));

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


  const filters = tab === "bookings" ? BOOKING_FILTERS : tab === "payments" ? PAYMENT_FILTERS : tab === "passes" ? PASS_FILTERS : [];
  const activeFilter = tab === "bookings" ? bStatus : tab === "payments" ? pStatus : passStatus;
  const counts: Record<string, number> = tab === "bookings" ? bookingCounts : tab === "payments" ? paymentCounts : passCounts;
  const filterLink = (value: string) => historyHref(current, tab === "bookings" ? { bStatus: value, bp: "1" } : tab === "payments" ? { pStatus: value, pp: "1" } : { passStatus: value });
  const dataError = tab === "bookings" ? bookingsRes.error : tab === "payments" ? paymentsRes.error : tab === "passes" ? passesRes.error : activityRes.error;

  return <div className="hub-page hub-history">
    <HistoryHero />
    <div className="hub-journal-stats hub-surface">
      {[{ label: "Bookings made", value: totalBookings, kind: "booking" }, { label: "Payments", value: totalPayments, kind: "payment" }, { label: "Access passes", value: allPasses.length, kind: "pass" }, { label: "Net spend · AUD", value: `$${netSpend.toFixed(2)}`, kind: "spend" }].map(stat =>
        <div key={stat.label}><ActivityMark kind={stat.kind} /><div><span className="hub-eyebrow">{stat.label}</span><strong>{stat.value}</strong></div></div>)}
    </div>
    <nav className="hub-tabs" aria-label="Account records">{TABS.map(({ id, label, icon: Icon }) => <Link key={id} href={historyHref(current, { tab: id })} scroll={false} aria-current={tab === id ? "page" : undefined} data-active={tab === id}><Icon size={16} />{label}</Link>)}</nav>
    <section className="hub-record-panel hub-surface">
      <div className="hub-record-heading"><div><p className="hub-eyebrow">Your records</p><h2>{tab === "activity" ? "Around your hub" : tab === "passes" ? "Your access passes" : tab === "payments" ? "Payments & refunds" : "Every reservation"}</h2></div><span className="hub-record-note">{tab === "activity" ? "Latest 30 updates" : tab === "passes" ? "Latest 50 passes" : "Times shown in Melbourne time"}</span></div>
      {filters.length > 0 && <nav className="hub-filters" aria-label="Filter records">{filters.map(value => <Link key={value} href={filterLink(value)} scroll={false} aria-current={activeFilter === value ? "true" : undefined} data-active={activeFilter === value}>{value.replaceAll("_", " ")}<span>{counts[value]}</span></Link>)}</nav>}
      {dataError ? <EmptyState text="Your records couldn't load. Please refresh to try again." /> : <>
      {tab === "bookings" && (bookings.length ? bookings.map(b => <div key={b.id} className="hub-record-row">
        <ActivityMark kind="booking" /><div className="hub-record-copy"><h3>{b.workspaces?.name ?? "Meeting room"}</h3><p>{formatDateTime(b.start_date_time)} – {new Date(b.end_date_time).toLocaleTimeString("en-AU", { timeZone: HUB_TIMEZONE, hour: "numeric", minute: "2-digit" })}</p>{b.workspaces?.location && <span>{b.workspaces.location}</span>}</div><StatusBadge status={b.booking_status} />
      </div>) : <EmptyState text={bStatus === "all" ? "Your next great meeting starts with a booking." : `No ${bStatus} bookings to show.`} />)}
      {tab === "payments" && (payments.length ? payments.map(p => {
        const refunded = p.payment_status === "refunded";
        const amount = Number(p.amount ?? 0);
        const refund = Number(p.refunded_amount ?? amount);
        return <div key={p.id} className="hub-record-row">
          <ActivityMark kind="payment" tone={refunded ? "neutral" : "green"} /><div className="hub-record-copy"><h3>{p.bookings?.workspaces?.name ?? "Room booking"}</h3><p>{formatDateShort(p.payment_date)} · {p.payment_method}</p>{refunded && <span>${refund.toFixed(2)} refunded · ${(amount - refund).toFixed(2)} retained</span>}</div>
          <div className="hub-record-amount"><strong className={refunded ? "hub-refunded" : undefined}>${amount.toFixed(2)} <small>AUD</small></strong><StatusBadge status={p.payment_status} /></div>
        </div>;
      }) : <EmptyState text="No payments match this filter." />)}
      {tab === "passes" && (passes.length ? passes.map(pass => <div key={pass.id} className="hub-record-row">
        <ActivityMark kind="pass" /><div className="hub-record-copy"><h3 className="capitalize">{pass.pass_type?.replaceAll("_", " ") ?? "Room booking pass"}</h3><p>Issued {formatDateShort(pass.issued_date)}</p><span>Expires {formatDateShort(pass.expiry_date)}</span></div><StatusBadge status={passDisplayStatus(pass)} />
      </div>) : <EmptyState text="No access passes match this filter." />)}
      {tab === "activity" && (activity.length ? activity.map(entry => <div key={entry.id} className="hub-record-row">
        <ActivityMark kind={entry.entry_type} tone={entry.tags === "Approved" ? "green" : entry.tags === "Rejected" ? "red" : "neutral"} /><div className="hub-record-copy"><h3>{entry.entry_type}</h3><p>{entry.entry_description ?? "Update recorded."}</p></div><time className="hub-record-note">{entry.added_date ? formatDateShort(entry.added_date) : entry.entry_date}</time>
      </div>) : <EmptyState text="Your bookings and hub updates will find a home here." />)}
      </>}
      {tab === "bookings" && totalBookingPages > 1 && <Pagination page={bookingPage} total={totalBookingPages} prevHref={historyHref(current, { bp: String(bookingPage - 1) })} nextHref={historyHref(current, { bp: String(bookingPage + 1) })} />}
      {tab === "payments" && totalPaymentPages > 1 && <Pagination page={paymentPage} total={totalPaymentPages} prevHref={historyHref(current, { pp: String(paymentPage - 1) })} nextHref={historyHref(current, { pp: String(paymentPage + 1) })} />}
    </section>
  </div>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className="hub-status-badge" data-status={status?.toLowerCase()}>{status?.replaceAll("_", " ")}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="hub-empty-state"><ActivityMark kind="activity" /><h3>{text}</h3><Link href="/bookings" className="hub-text-link">Explore spaces <ChevronRight size={14} /></Link></div>;
}

function Pagination({ page, total, prevHref, nextHref }: { page: number; total: number; prevHref: string; nextHref: string }) {
  return <nav className="hub-pagination" aria-label="Record pages"><span>Page {page} of {total}</span><div>
    {page > 1 ? <Link href={prevHref} scroll={false} className="hub-button hub-button-outline"><ChevronLeft size={14} />Previous</Link> : <button className="hub-button hub-button-outline" disabled><ChevronLeft size={14} />Previous</button>}
    {page < total ? <Link href={nextHref} scroll={false} className="hub-button hub-button-outline">Next<ChevronRight size={14} /></Link> : <button className="hub-button hub-button-outline" disabled>Next<ChevronRight size={14} /></button>}
  </div></nav>;
}
