export type AuthMode = "login" | "signup";

export const AUTH_PATHS: Record<AuthMode, string> = { login: "/login", signup: "/signup" };

const ORDER: Record<AuthMode, number> = { login: 0, signup: 1 };

export function authModeFrom(pathname: string | null): AuthMode {
  return pathname?.replace(/\/+$/, "") === "/signup" ? "signup" : "login";
}

/** 1 when moving towards Join (it sits on the right), -1 when heading back. */
export function slideDirection(from: AuthMode, to: AuthMode): 1 | -1 | 0 {
  return Math.sign(ORDER[to] - ORDER[from]) as 1 | -1 | 0;
}

/** Hints only. The server's rule is still just "8 or more characters". */
export function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    mix: /[a-z]/i.test(password) && /\d/.test(password),
  };
}
