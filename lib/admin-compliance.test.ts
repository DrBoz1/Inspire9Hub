import { describe, expect, it } from "vitest";
import { complianceHref, isUuid, outcomeFilter, pageWindow, sortReviews, toHistoryRow, toReviewItem, totalPages } from "./admin-compliance";

describe("review items", () => {
  it("reads a submitted induction, whichever shape the join comes back in", () => {
    const base = { id: "m1", full_name: " Sam Taylor ", email: "sam@taylor.dev", mobile_number: "0412 345 678", company_name: "" };
    const record = { health_emergency_info: "Alex, 0400 000 000", completion_date: "2026-09-11", acknowledged_terms: true };
    expect(toReviewItem({ ...base, induction_records: record })).toEqual({
      id: "m1", name: "Sam Taylor", email: "sam@taylor.dev", mobile: "0412 345 678", company: null,
      emergency: "Alex, 0400 000 000", submittedOn: "2026-09-11", acknowledged: true,
    });
    expect(toReviewItem({ ...base, induction_records: [record] }).emergency).toBe("Alex, 0400 000 000");
  });

  it("never claims an acknowledgement that isn't there", () => {
    expect(toReviewItem({ id: "m2", induction_records: null })).toMatchObject({ name: "New member", acknowledged: false, emergency: null });
    expect(toReviewItem({ id: "m3", induction_records: { acknowledged_terms: null } }).acknowledged).toBe(false);
  });

  it("puts the longest wait first", () => {
    const items = [
      toReviewItem({ id: "a", full_name: "B", induction_records: { completion_date: "2026-09-14" } }),
      toReviewItem({ id: "b", full_name: "A", induction_records: null }),
      toReviewItem({ id: "c", full_name: "C", induction_records: { completion_date: "2026-09-10" } }),
    ];
    expect(sortReviews(items).map((i) => i.id)).toEqual(["c", "a", "b"]);
  });
});

describe("history rows", () => {
  it("reads a decision", () => {
    expect(toHistoryRow({ id: "e1", tags: "Rejected", entry_date: "2026-09-02", entry_description: "None provided", members: { full_name: "Jordan", email: "j@x.com", company_name: "Lee & Co" } }))
      .toEqual({ id: "e1", name: "Jordan", email: "j@x.com", company: "Lee & Co", outcome: "Rejected", note: null, date: "2 September 2026" });
  });

  it("copes with a member who has since been deleted", () => {
    expect(toHistoryRow({ id: "e2", tags: "Approved", members: null })).toMatchObject({ name: "Deleted member", outcome: "Approved", date: null });
    expect(toHistoryRow({ id: "e3", tags: "Something else" }).outcome).toBe("Other");
  });
});

describe("filters and pages", () => {
  it("reads the outcome filter", () => {
    expect([outcomeFilter("approved"), outcomeFilter("rejected"), outcomeFilter("nope"), outcomeFilter(undefined)]).toEqual(["Approved", "Rejected", null, null]);
  });

  it("works out the page window, and shrugs off nonsense", () => {
    expect(pageWindow("3")).toEqual({ page: 3, from: 20, to: 29 });
    for (const bad of [undefined, "", "0", "-2", "abc"]) expect(pageWindow(bad)).toEqual({ page: 1, from: 0, to: 9 });
    expect([totalPages(0), totalPages(10), totalPages(11)]).toEqual([1, 1, 2]);
  });

  it("builds links that keep the filter", () => {
    expect(complianceHref("pending")).toBe("/admin/approvals");
    expect(complianceHref("history")).toBe("/admin/approvals?view=history");
    expect(complianceHref("history", { page: 1, outcome: "Rejected" })).toBe("/admin/approvals?view=history&outcome=rejected");
    expect(complianceHref("history", { page: 3, outcome: null })).toBe("/admin/approvals?view=history&page=3");
  });

  it("only accepts real member ids", () => {
    expect(isUuid("8f3c2a91-4b7e-4d2a-9c1e-2b5f7a3d9e10")).toBe(true);
    expect([isUuid("p1"), isUuid(""), isUuid(null), isUuid("8f3c2a91-4b7e-4d2a-9c1e-2b5f7a3d9e10' or 1=1")]).toEqual([false, false, false, false]);
  });
});
