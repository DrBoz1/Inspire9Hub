/**
 * Where emails point and who gets staff emails. Read when called, not at import,
 * so a changed environment variable is picked up without a code change.
 */

/** The team's shared inbox: staff alerts go here, and replies to member emails come here. */
export const teamInbox = () => process.env.SUPPORT_INBOX || "hello@inspire9.com";

/** An absolute link into the hub, for buttons in emails. */
export const siteUrl = (path: string) => `${(process.env.NEXT_PUBLIC_BASE_URL ?? "").replace(/\/$/, "")}${path}`;
