import { currentSubscription, type SubscriptionSnapshot } from "@/lib/billing/state";
import { toPlanSubscription, type RawSubscription } from "@/lib/admin-plans";
import { inductionStage, type InductionStage } from "@/lib/member-forms";

type Maybe<T> = T | T[] | null | undefined;
const one = <T,>(value: Maybe<T>): T | null => (Array.isArray(value) ? value[0] : value) ?? null;
const clean = (value: string | null | undefined) => value?.trim() || null;
const num = (value: number | string | null | undefined) => {
  const n = value === null || value === undefined || value === "" ? NaN : Number(value);
  return Number.isFinite(n) ? n : null;
};

// ─── List ────────────────────────────────────────────────────────────────────

export type MemberRow = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  mobile: string | null;
  status: string;
  induction: InductionStage;
};

export type RawMember = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  company_name?: string | null;
  mobile_number?: string | null;
  member_status?: string | null;
  induction_status?: string | null;
};

export function toMemberRow(row: RawMember): MemberRow {
  return {
    id: row.id,
    name: clean(row.full_name) ?? "New member",
    email: clean(row.email),
    company: clean(row.company_name),
    mobile: clean(row.mobile_number),
    status: clean(row.member_status) ?? "Inactive",
    induction: inductionStage(row.induction_status),
  };
}

export type MemberFilter = "all" | "active" | "inactive" | "suspended" | "review";

export const MEMBER_FILTERS: { value: MemberFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
  { value: "review", label: "Awaiting review" },
];

export function matchesFilter(row: MemberRow, filter: MemberFilter) {
  switch (filter) {
    case "active": return row.status === "Active";
    case "inactive": return row.status === "Inactive";
    case "suspended": return row.status === "Suspended";
    case "review": return row.induction === "under_review";
    default: return true;
  }
}

export function memberCounts(rows: MemberRow[]) {
  return Object.fromEntries(MEMBER_FILTERS.map((f) => [f.value, rows.filter((r) => matchesFilter(r, f.value)).length])) as Record<MemberFilter, number>;
}

export function searchMembers(rows: MemberRow[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => [r.name, r.email, r.company, r.mobile].some((v) => v?.toLowerCase().includes(q)));
}

/** Maps onto the shared status badge colours. */
export function statusTone(status: string) {
  if (status === "Active") return "active";
  if (status === "Suspended") return "cancelled";
  return "inactive";
}

export const INDUCTION_LABELS: Record<InductionStage, string> = {
  complete: "Inducted",
  under_review: "Awaiting review",
  not_started: "Not inducted",
};
export const INDUCTION_TONES: Record<InductionStage, string> = {
  complete: "approved",
  under_review: "pending",
  not_started: "none",
};

// ─── Details ─────────────────────────────────────────────────────────────────

export type MemberDetails = {
  induction: { submittedOn: string | null; acknowledged: boolean; emergency: string | null } | null;
  bookings: { id: string; start: string; end: string; status: string; room: string }[];
  payments: { id: string; amount: number | null; refunded: number | null; date: string | null; status: string; method: string | null }[];
  passes: { id: string; type: string; issued: string | null; expires: string | null; status: string }[];
  /** Their current (or most recent) membership, so nobody suspends someone who is still paying. */
  membership: MemberPlan | null;
};

export type MemberPlan = SubscriptionSnapshot & { planName: string | null };

export type RawMemberDetails = {
  induction: { completion_date?: string | null; acknowledged_terms?: boolean | null; health_emergency_info?: string | null } | null;
  bookings: { id: string; start_date_time: string; end_date_time: string; booking_status: string; workspaces?: Maybe<{ name?: string | null }> }[];
  payments: { id: string; amount?: number | string | null; refunded_amount?: number | string | null; payment_date?: string | null; payment_status?: string | null; payment_method?: string | null }[];
  passes: { id: string; pass_type?: string | null; issued_date?: string | null; expiry_date?: string | null; pass_status?: string | null }[];
  /** Absent until billing is set up. */
  subscriptions?: (RawSubscription & { created_at: string; plans?: Maybe<{ name?: string | null }> })[];
};

function memberPlan(subs: NonNullable<RawMemberDetails["subscriptions"]>): MemberPlan | null {
  const current = currentSubscription(subs.map((s) => ({ ...toPlanSubscription(s), planName: clean(one(s.plans)?.name), createdAt: s.created_at })));
  if (!current) return null;
  return {
    status: current.status,
    cancelAtPeriodEnd: current.cancelAtPeriodEnd,
    currentPeriodEnd: current.currentPeriodEnd,
    endedAt: current.endedAt,
    unitAmountCents: current.unitAmountCents,
    quantity: current.quantity,
    currency: current.currency,
    billingInterval: current.billingInterval,
    intervalCount: current.intervalCount,
    planName: current.planName,
  };
}

export function toMemberDetails(raw: RawMemberDetails): MemberDetails {
  return {
    induction: raw.induction
      ? { submittedOn: raw.induction.completion_date ?? null, acknowledged: raw.induction.acknowledged_terms === true, emergency: clean(raw.induction.health_emergency_info) }
      : null,
    bookings: raw.bookings.map((b) => ({ id: b.id, start: b.start_date_time, end: b.end_date_time, status: b.booking_status, room: clean(one(b.workspaces)?.name) ?? "Room" })),
    payments: raw.payments.map((p) => ({ id: p.id, amount: num(p.amount), refunded: num(p.refunded_amount), date: p.payment_date ?? null, status: clean(p.payment_status) ?? "unknown", method: clean(p.payment_method) })),
    passes: raw.passes.map((p) => ({ id: p.id, type: clean(p.pass_type)?.replace(/_/g, " ") ?? "Access pass", issued: p.issued_date ?? null, expires: p.expiry_date ?? null, status: clean(p.pass_status) ?? "unknown" })),
    membership: memberPlan(raw.subscriptions ?? []),
  };
}

/** Passes are stored "active" when issued and never flipped, so past their expiry they read as expired. */
export function passStatus(pass: MemberDetails["passes"][number], todayKey: string) {
  if (pass.status === "active" && pass.expires && pass.expires.slice(0, 10) < todayKey) return "expired";
  return pass.status;
}
