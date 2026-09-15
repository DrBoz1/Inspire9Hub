import { describe, expect, it } from "vitest";
import {
  formatDateOnly,
  hasErrors,
  inductionProgress,
  inductionStage,
  initialsOf,
  isPhoneNumber,
  readInduction,
  readProfile,
  validateInduction,
  validateProfile,
  type InductionValues,
} from "./member-forms";

const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
};

const ready: InductionValues = {
  full_name: "Hesam Zoveidavian",
  mobile_number: "0412 345 678",
  company_name: "Inspire9",
  health_emergency_info: "Alex Chen (partner), 0400 000 000",
  acknowledged_terms: true,
};

describe("reading the forms", () => {
  it("reads the profile's own column names", () => {
    // The old form posted "company" while the page read `profile.company`, which doesn't exist.
    expect(readProfile(form({ full_name: "  Hesam   Z ", company_name: " Inspire9 ", mobile_number: "0412 345 678" })))
      .toEqual({ full_name: "Hesam Z", company_name: "Inspire9", mobile_number: "0412 345 678" });
  });

  it("keeps line breaks in emergency details, and reads the checkbox", () => {
    const v = readInduction(form({ full_name: "A B", health_emergency_info: " Alex\r\n0400 000 000 ", acknowledged_terms: "on" }));
    expect(v.health_emergency_info).toBe("Alex\n0400 000 000");
    expect(v.acknowledged_terms).toBe(true);
    expect(readInduction(form({})).acknowledged_terms).toBe(false);
  });
});

describe("phone numbers", () => {
  it("accepts the usual Australian formats", () => {
    for (const n of ["0412 345 678", "+61 412 345 678", "(03) 9123 4567", "0412-345-678"]) expect(isPhoneNumber(n), n).toBe(true);
  });
  it("rejects anything else", () => {
    for (const n of ["123", "call me", "0412 345 678 ext 2", "+61 412 345 678 999 999"]) expect(isPhoneNumber(n), n).toBe(false);
  });
});

describe("profile rules", () => {
  it("needs a name, and nothing else", () => {
    expect(validateProfile({ full_name: "Hesam", mobile_number: "", company_name: "" })).toEqual({});
    expect(validateProfile({ full_name: " ", mobile_number: "", company_name: "" })).toHaveProperty("full_name");
  });
  it("checks optional fields only when filled", () => {
    const e = validateProfile({ full_name: "Hesam", mobile_number: "nope", company_name: "x".repeat(101) });
    expect(Object.keys(e).sort()).toEqual(["company_name", "mobile_number"]);
  });
});

describe("induction rules", () => {
  it("passes a complete induction", () => {
    expect(hasErrors(validateInduction(ready))).toBe(false);
  });
  it("needs every field and the acknowledgement", () => {
    const e = validateInduction({ full_name: "", mobile_number: "", company_name: "", health_emergency_info: "Alex", acknowledged_terms: false });
    expect(Object.keys(e).sort()).toEqual(["acknowledged_terms", "company_name", "full_name", "health_emergency_info", "mobile_number"]);
  });
  it("tracks progress step by step", () => {
    expect(inductionProgress({ ...ready, health_emergency_info: "", acknowledged_terms: false }, false))
      .toEqual({ about: true, emergency: false, guide: false, confirm: false });
    expect(inductionProgress(ready, true)).toEqual({ about: true, emergency: true, guide: true, confirm: true });
    // Ticking the acknowledgement means they've read the guide, even on a screen that never scrolled.
    expect(inductionProgress(ready, false).guide).toBe(true);
  });
});

describe("induction stage", () => {
  it("maps the stored status", () => {
    expect(inductionStage("Complete")).toBe("complete");
    expect(inductionStage("Submitted")).toBe("under_review");
    expect(inductionStage("Pending")).toBe("not_started");
    expect(inductionStage(null)).toBe("not_started");
  });
});

describe("small formatting", () => {
  it("makes initials", () => {
    expect(initialsOf("Hesam Zoveidavian")).toBe("HZ");
    expect(initialsOf("hesam")).toBe("H");
    expect(initialsOf("  ")).toBe("I9");
  });
  it("formats a date-only value without shifting it", () => {
    expect(formatDateOnly("2026-09-18")).toBe("18 September 2026");
    expect(formatDateOnly(null)).toBeNull();
  });
});
