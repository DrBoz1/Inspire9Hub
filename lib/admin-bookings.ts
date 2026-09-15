import { calcRefundCents, getRefundPolicy } from "@/lib/refund-policy";
import { formatLongDay, hubDateKey } from "@/lib/admin-dashboard";
import { addDaysToKey } from "@/features/booking-map/zoned-time";

export type ScheduleFilter = "upcoming" | "today" | "past" | "cancelled" | "all";

export const SCHEDULE_FILTERS: { value: ScheduleFilter; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "today", label: "Today" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

export const SCHEDULE_PAGE_SIZE = 25;

export function scheduleFilter(param: string | undefined): ScheduleFilter {
  return SCHEDULE_FILTERS.some((f) => f.value === param) ? (param as ScheduleFilter) : "upcoming";
}

export type FilterCondition = { op: "gte" | "gt" | "lt" | "eq" | "neq"; column: string; value: string };

/** The query conditions behind each filter, as data so they can be tested and reused for the counts. */
export function filterConditions(filter: ScheduleFilter, b: { now: string; dayStart: string; dayEnd: string }): FilterCondition[] {
  switch (filter) {
    case "upcoming":
      return [{ op: "gte", column: "start_date_time", value: b.now }, { op: "neq", column: "booking_status", value: "cancelled" }];
    // Anything that overlaps today, including a booking still running from last night.
    case "today":
      return [{ op: "lt", column: "start_date_time", value: b.dayEnd }, { op: "gt", column: "end_date_time", value: b.dayStart }];
    case "past":
      return [{ op: "lt", column: "start_date_time", value: b.now }];
    case "cancelled":
      return [{ op: "eq", column: "booking_status", value: "cancelled" }];
    default:
      return [];
  }
}

/** Search text safe to drop into a PostgREST `or` filter: its separators and wildcards are stripped. */
export function sanitizeSearch(raw: string | undefined) {
  return (raw ?? "").replace(/[,()%*\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

export function scheduleHref({ filter = "upcoming", q = "", page = 1 }: { filter?: ScheduleFilter; q?: string; page?: number }) {
  const params = new URLSearchParams();
  if (filter !== "upcoming") params.set("filter", filter);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/admin/bookings${query ? `?${query}` : ""}`;
}

// ─── Rows ────────────────────────────────────────────────────────────────────

type Maybe<T> = T | T[] | null | undefined;
const list = <T,>(value: Maybe<T>): T[] => (Array.isArray(value) ? value : value ? [value] : []);
const money = (value: number | string | null | undefined) => {
  const n = value === null || value === undefined || value === "" ? NaN : Number(value);
  return Number.isFinite(n) ? n : null;
};

type RawPayment = { amount?: number | string | null; payment_status?: string | null; refunded_amount?: number | string | null; stripe_payment_intent_id?: string | null };
export type RawScheduleBooking = {
  id: string;
  start_date_time: string;
  end_date_time: string;
  booking_status: string;
  workspaces?: Maybe<{ name?: string | null; location?: string | null }>;
  members?: Maybe<{ full_name?: string | null; email?: string | null }>;
  payments?: Maybe<RawPayment>;
};

export type PaymentSummary = {
  /** refund_failed: a member's automatic refund didn't go through, so the money is still owed. */
  state: "paid" | "refund_failed" | "refunded" | "unpaid";
  amount: number | null;
  refunded: number | null;
  /** Paid through Stripe, so a refund can go back automatically. The payment id itself never leaves the server. */
  canRefundOnline: boolean;
};

export type ScheduleRow = {
  id: string;
  start: string;
  end: string;
  status: string;
  room: string;
  location: string | null;
  member: string;
  email: string | null;
  payment: PaymentSummary;
};

export function summarisePayments(payments: Maybe<RawPayment>): PaymentSummary {
  const all = list(payments);
  const paid = all.find((p) => p.payment_status === "paid");
  if (paid) return { state: "paid", amount: money(paid.amount), refunded: null, canRefundOnline: Boolean(paid.stripe_payment_intent_id) };
  const failed = all.find((p) => p.payment_status === "refund_failed");
  if (failed) return { state: "refund_failed", amount: money(failed.amount), refunded: null, canRefundOnline: Boolean(failed.stripe_payment_intent_id) };
  const refunded = all.find((p) => p.payment_status === "refunded");
  if (refunded) return { state: "refunded", amount: money(refunded.amount), refunded: money(refunded.refunded_amount), canRefundOnline: false };
  return { state: "unpaid", amount: null, refunded: null, canRefundOnline: false };
}

export function toScheduleRow(row: RawScheduleBooking): ScheduleRow {
  const room = list(row.workspaces)[0];
  const member = list(row.members)[0];
  return {
    id: row.id,
    start: row.start_date_time,
    end: row.end_date_time,
    status: row.booking_status,
    room: room?.name?.trim() || "Room",
    location: room?.location?.trim() || null,
    member: member?.full_name?.trim() || "Member",
    email: member?.email?.trim() || null,
    payment: summarisePayments(row.payments),
  };
}

/** What an admin can do to a booking right now. Mirrors the checks the server actions make. */
export function scheduleActions(row: ScheduleRow, now: Date) {
  const cancellable = row.status !== "cancelled" && new Date(row.start) > now;
  const owed = row.payment.state === "paid" || row.payment.state === "refund_failed";
  const paidAndCancelled = row.status === "cancelled" && owed;
  return {
    cancel: cancellable,
    cancelAndRefund: cancellable && row.payment.state === "paid",
    refund: paidAndCancelled && row.payment.canRefundOnline,
    refundOffline: paidAndCancelled && !row.payment.canRefundOnline,
  };
}

/** The refund a cancelled booking is due under the policy, as of now. */
export function refundQuote(row: ScheduleRow) {
  const policy = getRefundPolicy(row.start);
  const cents = row.payment.amount === null ? 0 : calcRefundCents(row.payment.amount, policy.percent);
  return { percent: policy.percent, label: policy.label, description: policy.description, cents };
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export const formatMoney = (amount: number | null) => (amount === null ? "—" : `$${amount.toFixed(2)}`);

export function durationLabel(start: string, end: string) {
  const minutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  pending: "Awaiting payment",
  cancelled: "Cancelled",
  completed: "Completed",
};

/** Rows keep their order; each Melbourne day becomes a group with a friendly name. */
export function groupByDay(rows: ScheduleRow[], now: Date) {
  const today = hubDateKey(now);
  const names: Record<string, string> = { [today]: "Today", [addDaysToKey(today, 1)]: "Tomorrow", [addDaysToKey(today, -1)]: "Yesterday" };
  const groups: { key: string; label: string; date: string; rows: ScheduleRow[] }[] = [];
  for (const row of rows) {
    const start = new Date(row.start);
    const key = hubDateKey(start);
    let group = groups.find((g) => g.key === key);
    if (!group) {
      const year = key.slice(0, 4) === today.slice(0, 4) ? "" : ` ${key.slice(0, 4)}`;
      const date = `${formatLongDay(start)}${year}`;
      group = { key, label: names[key] ?? date, date: names[key] ? date : "", rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

export type ScheduleData = {
  now: string;
  filter: ScheduleFilter;
  q: string;
  page: number;
  total: number;
  totalPages: number;
  counts: Record<ScheduleFilter, number> | null;
  rows: ScheduleRow[];
};
