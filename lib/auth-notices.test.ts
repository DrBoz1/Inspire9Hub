import { describe, expect, it } from "vitest";
import { friendlyAccountError, friendlyLoginError, friendlySignupError, NOTICES, safeNotice } from "./auth-notices";

describe("what the sign-in pages will say", () => {
  it("shows our own messages as they are", () => {
    expect(safeNotice(NOTICES.created)).toBe(NOTICES.created);
    expect(safeNotice(NOTICES.wrongPassword)).toBe(NOTICES.wrongPassword);
  });

  it("won't repeat whatever a link says", () => {
    expect(safeNotice("Your account is locked. Call 1800 000 000 to unlock it.")).toBe(NOTICES.generic);
    expect(safeNotice("<b>hi</b>")).toBe(NOTICES.generic);
    expect(safeNotice(undefined)).toBeUndefined();
    expect(safeNotice("")).toBeUndefined();
  });

  it("turns every Supabase error into one of ours", () => {
    for (const raw of ["Invalid login credentials", "Email not confirmed", "Email rate limit exceeded", "some new error nobody has seen"]) {
      expect(safeNotice(friendlyLoginError(raw))).toBe(friendlyLoginError(raw));
    }
    for (const raw of ["User already registered", "Password should be at least 6 characters.", "Unable to validate email address: invalid format", "Signups not allowed for this instance"]) {
      expect(safeNotice(friendlySignupError(raw))).toBe(friendlySignupError(raw));
    }
    for (const raw of ["New password should be different from the old password.", "Email link is invalid or has expired", "Auth session missing!"]) {
      expect(safeNotice(friendlyAccountError(raw))).toBe(friendlyAccountError(raw));
    }
  });

  it("says the useful thing for the common failures", () => {
    expect(friendlyLoginError("Invalid login credentials")).toBe(NOTICES.wrongPassword);
    expect(friendlySignupError("User already registered")).toBe(NOTICES.alreadyRegistered);
    expect(friendlyAccountError("New password should be different from the old password.")).toBe(NOTICES.samePassword);
    expect(friendlyAccountError("Email link is invalid or has expired")).toBe(NOTICES.linkExpired);
  });
});
