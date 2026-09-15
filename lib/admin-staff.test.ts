import { describe, expect, it } from "vitest";
import {
  removeBlocker,
  roleChangeBlocker,
  searchCandidates,
  searchStaff,
  sortStaff,
  staffCounts,
  toCandidate,
  toStaffMember,
  type StaffMember,
} from "./admin-staff";

const person = (o: Partial<StaffMember> = {}): StaffMember => ({ id: "a1", name: "Jordan Lee", email: "jordan@inspire9.com", role: "admin", hasLogin: true, ...o });

describe("reading staff", () => {
  it("prefers the login's email and fills gaps", () => {
    expect(toStaffMember({ id: "a1", full_name: " ", email: "old@x.com", role: "super_admin" }, { exists: true, email: "new@x.com" }))
      .toEqual({ id: "a1", name: "Unnamed", email: "new@x.com", role: "super_admin", hasLogin: true });
    expect(toStaffMember({ id: "a2", full_name: "Sam", email: "sam@x.com", role: "weird" }, { exists: false }))
      .toEqual({ id: "a2", name: "Sam", email: "sam@x.com", role: "admin", hasLogin: false });
  });

  it("lists super admins first, then by name", () => {
    const list = [person({ id: "1", name: "Zoe" }), person({ id: "2", name: "Mia", role: "super_admin" }), person({ id: "3", name: "Alex" })];
    expect(sortStaff(list).map((s) => s.name)).toEqual(["Mia", "Alex", "Zoe"]);
  });

  it("counts and searches", () => {
    const list = [person(), person({ id: "2", name: "Mia Wong", email: "mia@wong.studio", role: "super_admin" })];
    expect(staffCounts(list)).toEqual({ all: 2, super_admin: 1, admin: 1 });
    expect(searchStaff(list, "WONG").map((s) => s.id)).toEqual(["2"]);
    expect(searchStaff(list, " ")).toHaveLength(2);
  });
});

describe("guard rails", () => {
  const me = person({ id: "me", role: "super_admin" });
  const other = person({ id: "b", role: "super_admin" });
  const stale = person({ id: "c", role: "super_admin", hasLogin: false });

  it("never lets you remove or change yourself", () => {
    expect(removeBlocker(me, [me, other], "me")).toBe("You can’t remove your own access.");
    expect(roleChangeBlocker(me, "admin", [me, other], "me")).toBe("Ask another super admin to change your access.");
  });

  it("keeps at least one super admin who can sign in", () => {
    const only = "They’re the only super admin. Make someone else a super admin first.";
    expect(removeBlocker(other, [other, stale, person()], "me")).toBe(only);
    expect(roleChangeBlocker(other, "admin", [other, stale], "me")).toBe(only);
    expect(removeBlocker(other, [other, me], "me")).toBeNull();
    expect(roleChangeBlocker(other, "admin", [other, me], "me")).toBeNull();
  });

  it("allows promotions and says when nothing would change", () => {
    expect(roleChangeBlocker(person(), "super_admin", [me, person()], "me")).toBeNull();
    expect(roleChangeBlocker(person(), "admin", [me, person()], "me")).toBe("They’re already an admin.");
    expect(removeBlocker(person(), [me, person()], "me")).toBeNull();
  });
});

describe("people who can be added", () => {
  it("reads and searches members", () => {
    const list = [
      toCandidate({ id: "m1", full_name: "Priya Nair", email: "priya@studio9.au", company_name: "Studio Nine" }),
      toCandidate({ id: "m2", full_name: null, email: null, company_name: null }),
    ];
    expect(list[1]).toEqual({ id: "m2", name: "New member", email: null, company: null });
    expect(searchCandidates(list, "studio").map((c) => c.id)).toEqual(["m1"]);
    expect(searchCandidates(list, "  ")).toHaveLength(2);
  });
});
