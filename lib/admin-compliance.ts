import { formatDateOnly } from "@/lib/member-forms";

type Maybe<T> = T | T[] | null | undefined;
function one<T>(value: Maybe<T>): T | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}
const clean = (value: string | null | undefined) => value?.trim() || null;

export type ReviewItem = {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  company: string | null;
  emergency: string | null;
  submittedOn: string | null;
  acknowledged: boolean;
};
export type RawReview = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  mobile_number?: string | null;
  company_name?: string | null;
  induction_records?: Maybe<{ health_emergency_info?: string | null; completion_date?: string | null; acknowledged_terms?: boolean | null }>;
};

export function toReviewItem(row: RawReview): ReviewItem {
  const record = one(row.induction_records);
  return {
    id: row.id,
    name: clean(row.full_name) ?? "New member",
    email: clean(row.email),
    mobile: clean(row.mobile_number),
    company: clean(row.company_name),
    emergency: clean(record?.health_emergency_info),
    submittedOn: record?.completion_date ?? null,
    acknowledged: record?.acknowledged_terms === true,
  };
}

/** Longest wait first. */
export function sortReviews(items: ReviewItem[]) {
  return [...items].sort((a, b) => (a.submittedOn ?? "9999").localeCompare(b.submittedOn ?? "9999") || a.name.localeCompare(b.name));
}

export type Outcome = "Approved" | "Rejected";
export type HistoryRow = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  outcome: Outcome | "Other";
  note: string | null;
  date: string | null;
};
export type RawHistory = {
  id: string;
  tags?: string | null;
  entry_date?: string | null;
  entry_description?: string | null;
  members?: Maybe<{ full_name?: string | null; email?: string | null; company_name?: string | null }>;
};

export function toHistoryRow(row: RawHistory): HistoryRow {
  const member = one(row.members);
  const note = clean(row.entry_description);
  return {
    id: row.id,
    name: clean(member?.full_name) ?? "Deleted member",
    email: clean(member?.email),
    company: clean(member?.company_name),
    outcome: row.tags === "Approved" || row.tags === "Rejected" ? row.tags : "Other",
    // The decision actions write "None provided" when there was nothing to copy.
    note: note === "None provided" ? null : note,
    date: formatDateOnly(row.entry_date),
  };
}

export function outcomeFilter(param: string | undefined): Outcome | null {
  if (param === "approved") return "Approved";
  if (param === "rejected") return "Rejected";
  return null;
}

export const HISTORY_PAGE_SIZE = 10;

export function pageWindow(raw: string | undefined, size = HISTORY_PAGE_SIZE) {
  const parsed = Number.parseInt(raw ?? "", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  return { page, from: (page - 1) * size, to: page * size - 1 };
}

export function totalPages(count: number, size = HISTORY_PAGE_SIZE) {
  return Math.max(1, Math.ceil(count / size));
}

export function complianceHref(view: "pending" | "history", options: { page?: number; outcome?: Outcome | null } = {}) {
  const params = new URLSearchParams();
  if (view === "history") params.set("view", "history");
  if (view === "history" && options.outcome) params.set("outcome", options.outcome.toLowerCase());
  if (view === "history" && options.page && options.page > 1) params.set("page", String(options.page));
  const query = params.toString();
  return `/admin/approvals${query ? `?${query}` : ""}`;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export type ComplianceData = {
  view: "pending" | "history";
  todayKey: string;
  pending: ReviewItem[];
  history: HistoryRow[];
  historyCount: number;
  page: number;
  totalPages: number;
  outcome: Outcome | null;
};
