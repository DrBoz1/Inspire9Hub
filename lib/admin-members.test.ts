import { describe, expect, it } from "vitest";
import { matchesFilter, memberCounts, passStatus, searchMembers, statusTone, toMemberDetails, toMemberRow, type MemberRow } from "./admin-members";

const rows: MemberRow[] = [
  toMemberRow({ id: "1", full_name: "Alex Chen", email: "alex@northwind.com", company_name: "Northwind", member_status: "Active", induction_status: "Complete" }),
  toMemberRow({ id: "2", full_name: "Sam Taylor", email: "sam@taylor.dev", mobile_number: "0412 345 678", member_status: "Inactive", induction_status: "Submitted" }),
  toMemberRow({ id: "3", full_name: " ", member_status: "Suspended", induction_status: null }),
  toMemberRow({ id: "4", full_name: "Priya Nair", company_name: "Studio Nine", member_status: null, induction_status: "Pending" }),
];

describe("member list", () => {
  it("reads rows with sensible defaults", () => {
    expect(rows[2]).toEqual({ id: "3", name: "New member", email: null, company: null, mobile: null, status: "Suspended", induction: "not_started" });
    expect(rows[3].status).toBe("Inactive");
  });

  it("filters and counts", () => {
    expect(memberCounts(rows)).toEqual({ all: 4, active: 1, inactive: 2, suspended: 1, review: 1 });
    expect(rows.filter((r) => matchesFilter(r, "review")).map((r) => r.id)).toEqual(["2"]);
  });

  it("searches name, email, company and mobile", () => {
    expect(searchMembers(rows, "northwind").map((r) => r.id)).toEqual(["1"]);
    expect(searchMembers(rows, "TAYLOR.DEV").map((r) => r.id)).toEqual(["2"]);
    expect(searchMembers(rows, "0412").map((r) => r.id)).toEqual(["2"]);
    expect(searchMembers(rows, "  ")).toHaveLength(4);
  });

  it("colours statuses", () => {
    expect([statusTone("Active"), statusTone("Suspended"), statusTone("Inactive")]).toEqual(["active", "cancelled", "inactive"]);
  });
});

describe("member details", () => {
  const details = toMemberDetails({
    induction: { completion_date: "2026-09-11", acknowledged_terms: true, health_emergency_info: " Alex, 0400 000 000 " },
    bookings: [{ id: "b1", start_date_time: "s", end_date_time: "e", booking_status: "confirmed", workspaces: [{ name: "Dream Room" }] }],
    payments: [{ id: "p1", amount: "24.50", refunded_amount: null, payment_date: "2026-09-10", payment_status: "paid", payment_method: "card" }],
    passes: [{ id: "x1", pass_type: "day_pass", issued_date: "2026-09-01", expiry_date: "2026-09-02", pass_status: "active" }],
  });

  it("reads everything the panel shows", () => {
    expect(details.induction).toEqual({ submittedOn: "2026-09-11", acknowledged: true, emergency: "Alex, 0400 000 000" });
    expect(details.bookings[0]).toMatchObject({ room: "Dream Room", status: "confirmed" });
    expect(details.payments[0]).toMatchObject({ amount: 24.5, refunded: null, method: "card" });
    expect(details.passes[0].type).toBe("day pass");
  });

  it("copes with a member who never submitted an induction", () => {
    expect(toMemberDetails({ induction: null, bookings: [], payments: [], passes: [] }).induction).toBeNull();
  });

  it("shows passes past their expiry as expired", () => {
    expect(passStatus(details.passes[0], "2026-09-15")).toBe("expired");
    expect(passStatus(details.passes[0], "2026-09-02")).toBe("active");
    expect(passStatus({ ...details.passes[0], status: "revoked" }, "2026-09-15")).toBe("revoked");
  });
});

describe("a member's plan in their profile panel", () => {
  const base = { induction: null, bookings: [], payments: [], passes: [] };
  const sub = (status: string, created_at: string, plan: string) => ({
    plan_id: "p", status, created_at, plans: { name: plan }, cancel_at_period_end: false, current_period_end: "2026-10-04T00:00:00Z",
    ended_at: null, unit_amount_cents: 45000, quantity: 1, currency: "aud", billing_interval: "month", interval_count: 1,
  });

  it("shows the plan they're paying for now, not an older cancelled one", () => {
    const details = toMemberDetails({ ...base, subscriptions: [sub("canceled", "2026-09-10T00:00:00Z", "Flexi"), sub("active", "2025-01-01T00:00:00Z", "Resident desk")] });
    expect(details.membership).toMatchObject({ planName: "Resident desk", status: "active", unitAmountCents: 45000 });
  });

  it("has no plan to show before billing is set up, or for someone who never joined", () => {
    expect(toMemberDetails(base).membership).toBeNull();
    expect(toMemberDetails({ ...base, subscriptions: [] }).membership).toBeNull();
  });
});
