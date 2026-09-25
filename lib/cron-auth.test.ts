import { describe, expect, it } from "vitest";
import { cronAuthorised } from "./cron-auth";

describe("cronAuthorised", () => {
  const secret = "s3cret-value";

  it("lets Vercel Cron through", () => {
    expect(cronAuthorised(`Bearer ${secret}`, secret)).toBe(true);
  });

  it("turns away a wrong secret, a near miss, and a missing header", () => {
    expect(cronAuthorised("Bearer nope", secret)).toBe(false);
    expect(cronAuthorised(`Bearer ${secret} `, secret)).toBe(false);
    expect(cronAuthorised(`Bearer ${secret.slice(0, -1)}`, secret)).toBe(false);
    expect(cronAuthorised(null, secret)).toBe(false);
    expect(cronAuthorised("", secret)).toBe(false);
  });

  it("wants the Bearer prefix, not the bare secret", () => {
    expect(cronAuthorised(secret, secret)).toBe(false);
  });

  it("locks the job when no secret is configured, rather than opening it", () => {
    expect(cronAuthorised("Bearer anything", undefined)).toBe(false);
    expect(cronAuthorised("Bearer ", "")).toBe(false);
    expect(cronAuthorised("Bearer undefined", undefined)).toBe(false);
  });
});
