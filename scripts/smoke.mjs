#!/usr/bin/env node
/**
 * Is the deployed site actually working?
 *
 * The test suite proves the code is right; this proves the thing members visit
 * is up, signed-out visitors are still turned away, and the two public endpoints
 * that take money or run jobs still refuse a stranger. It talks to a running
 * site over HTTP and writes nothing, so it is safe to point at production.
 *
 *   npm run smoke                       -- the live site
 *   npm run smoke -- http://localhost:3000
 */

const BASE = (process.argv[2] ?? process.env.SMOKE_URL ?? "https://inspire9-hub.vercel.app").replace(/\/$/, "");
const TIMEOUT_MS = 20_000;

let failures = 0;
const record = (ok, name, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

async function visit(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...options,
  });
  return { status: res.status, location: res.headers.get("location") ?? "", body: await res.text() };
}

/** One expectation, with the failure saying what it wanted and what it got. */
async function check(name, path, want, options) {
  try {
    const res = await visit(path, options);
    const problem = want(res);
    record(!problem, name, problem ?? `${res.status}`);
  } catch (err) {
    record(false, name, err instanceof Error ? err.message : String(err));
  }
}

const status = (expected) => (res) => (res.status === expected ? null : `got ${res.status}, wanted ${expected}`);
const redirectTo = (path) => (res) =>
  res.status >= 300 && res.status < 400 && res.location.includes(path) ? null : `got ${res.status} ${res.location || "(no location)"}, wanted a redirect to ${path}`;

console.log(`Smoke test against ${BASE}\n`);

// The site is up, and so is what's behind it.
await check("health says everything is reachable", "/api/health", (res) => {
  if (res.status !== 200) return `got ${res.status}`;
  try {
    const body = JSON.parse(res.body);
    if (!body.ok) return `not ok: ${JSON.stringify(body.checks)}`;
    return null;
  } catch {
    return "health didn't answer with JSON";
  }
});

// The pages a stranger is allowed to see.
await check("the login page loads", "/login", (res) =>
  res.status === 200 && res.body.includes("Sign in") ? null : `${res.status}, and the page didn't mention signing in`);
await check("the enquiry page loads", "/enquire", status(200));
await check("the front door sends you to sign in", "/", redirectTo("/login"));

// The pages a stranger is not.
for (const path of ["/bookings", "/dashboard", "/membership", "/admin"]) {
  await check(`${path} turns away a signed-out visitor`, path, redirectTo("/login"));
}

// The endpoints that would matter most if they were left open.
await check("the Stripe webhook refuses an unsigned payload", "/api/webhooks/stripe", status(400), {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: "{}",
});
await check("the nightly job refuses a request with no secret", "/api/cron/janitor", status(401));
await check("the review reminder refuses a request with no secret", "/api/cron/review-reminder", status(401));

// A dead link is a designed page, not a crash.
await check("an unknown page answers 404", "/this-page-does-not-exist", status(404));

console.log(failures ? `\n${failures} FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
