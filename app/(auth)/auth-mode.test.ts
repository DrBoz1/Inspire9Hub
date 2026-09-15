import { describe, expect, it } from "vitest";
import { authModeFrom, passwordChecks, slideDirection } from "./auth-mode";

describe("sign in / join mode", () => {
  it("reads the mode from the path", () => {
    expect(authModeFrom("/signup")).toBe("signup");
    expect(authModeFrom("/signup/")).toBe("signup");
    expect(authModeFrom("/login")).toBe("login");
    expect(authModeFrom("/forgot-password")).toBe("login");
    expect(authModeFrom(null)).toBe("login");
  });

  it("slides towards Join, and back again", () => {
    expect(slideDirection("login", "signup")).toBe(1);
    expect(slideDirection("signup", "login")).toBe(-1);
    expect(slideDirection("login", "login")).toBe(0);
  });
});

describe("password hints", () => {
  it("wants 8 characters with letters and numbers", () => {
    expect(passwordChecks("")).toEqual({ length: false, mix: false });
    expect(passwordChecks("abcdefgh")).toEqual({ length: true, mix: false });
    expect(passwordChecks("abc123")).toEqual({ length: false, mix: true });
    expect(passwordChecks("hub2026rooms")).toEqual({ length: true, mix: true });
  });
});
