/**
 * The messages the sign-in pages show, and the guard on them.
 *
 * They travel in the address (?error=, ?message=), and anyone can write an
 * address. Before this, a link could make the real login page say anything:
 * "Your account is locked, call 1800…". Now a page shows only messages this
 * file wrote; anything else becomes a plain "something went wrong".
 */

export const NOTICES = {
  wrongPassword: "Incorrect email or password. Double-check your details or reset your password below.",
  unconfirmed: "Your email isn't verified yet. Check your inbox for a confirmation link.",
  tooMany: "Too many attempts. Please wait a few minutes and try again.",
  noAccount: "No account found with that email. Did you mean to sign up?",
  offline: "Connection issue. Check your internet and try again.",
  signInFailed: "Sign in failed. Please try again or contact support.",
  alreadyRegistered: "An account with this email already exists. Try signing in instead.",
  weakPassword: "Password is too weak. Use at least 8 characters with a mix of letters and numbers.",
  badEmail: "Please enter a valid email address.",
  signUpFailed: "We couldn’t create your account. Please try again.",
  badName: "Please enter your name (up to 100 characters).",
  created: "Account created! Check your email to confirm before signing in.",
  noEmail: "Please enter your email address.",
  shortPassword: "Password must be at least 8 characters.",
  mismatch: "Passwords do not match.",
  samePassword: "Your new password must be different from the old one.",
  passwordUpdated: "Password updated successfully. Please sign in.",
  linkExpired: "Invalid or expired link. Please request a new one.",
  generic: "Something went wrong. Please try again.",
} as const;

const KNOWN = new Set<string>(Object.values(NOTICES));

/** A message fit to show: one of ours, or the generic one. Nothing a link made up. */
export function safeNotice(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return KNOWN.has(raw) ? raw : NOTICES.generic;
}

const has = (message: string, ...words: string[]) => words.some((w) => message.toLowerCase().includes(w));

export function friendlyLoginError(message: string): string {
  if (has(message, "invalid login credentials", "invalid credentials")) return NOTICES.wrongPassword;
  if (has(message, "email not confirmed")) return NOTICES.unconfirmed;
  if (has(message, "rate limit", "too many")) return NOTICES.tooMany;
  if (has(message, "user not found", "no user found")) return NOTICES.noAccount;
  if (has(message, "network", "fetch")) return NOTICES.offline;
  return NOTICES.signInFailed;
}

export function friendlySignupError(message: string): string {
  if (has(message, "already registered", "already exists", "user already")) return NOTICES.alreadyRegistered;
  if (has(message, "password") && has(message, "weak", "short", "at least")) return NOTICES.weakPassword;
  if (has(message, "invalid email") || (has(message, "email") && has(message, "invalid", "format"))) return NOTICES.badEmail;
  if (has(message, "rate limit", "too many")) return NOTICES.tooMany;
  if (has(message, "network", "fetch")) return NOTICES.offline;
  return NOTICES.signUpFailed;
}

/** For a failed email link or password change, where Supabase's own words used to be shown as they came. */
export function friendlyAccountError(message: string): string {
  if (has(message, "should be different", "same as")) return NOTICES.samePassword;
  if (has(message, "password") && has(message, "weak", "short", "at least")) return NOTICES.weakPassword;
  if (has(message, "expired", "invalid", "not found")) return NOTICES.linkExpired;
  if (has(message, "rate limit", "too many")) return NOTICES.tooMany;
  return NOTICES.generic;
}
