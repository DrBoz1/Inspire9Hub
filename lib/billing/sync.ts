import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTaggedPlan, memberIdFrom, skipNote, toInvoiceRow, toPlanRow, toSubscriptionRow } from "./extract";
import { shouldRetryUnresolved } from "./state";

/**
 * Stripe to the database. Server only: it writes with the service-role client.
 * Every write here is idempotent and ordered, so the webhook can deliver the
 * same event twice, or two events out of order, and the tables still end up
 * matching Stripe.
 *
 * Outcomes rather than exceptions: the webhook turns each into a status code.
 *   ok             -> 200: applied, or harmlessly nothing to do
 *   retry          -> 500: Stripe should try again (a blip, or checkout still finishing)
 *   give up        -> 200 plus a loud log: retrying can't fix it, a person has to
 */
export type SyncOutcome = { ok: true; detail: string } | { ok: false; retry: boolean; detail: string };
type EventStamp = { id: string | null; created: number };
type DbError = { code?: string; message: string } | null;

const ok = (detail: string): SyncOutcome => ({ ok: true, detail });
const retry = (detail: string): SyncOutcome => ({ ok: false, retry: true, detail });
const giveUp = (detail: string): SyncOutcome => ({ ok: false, retry: false, detail });

/** Failures a retry could fix are retried; a constraint or a bad shape never will be. */
function fromDbError(error: NonNullable<DbError>, what: string): SyncOutcome {
  if (error.code === "PGRST205" || error.code === "42P01") return giveUp(`${what}: billing tables missing, run add_membership_billing.sql`);
  // Two memberships being paid at once. Retrying won't change that, and a webhook
  // that keeps failing gets switched off, taking bookings with it.
  if (error.code === "23505") return giveUp(`${what}: DUPLICATE-LIVE-SUB, this member already has a live membership (${error.message})`);
  if (error.code?.startsWith("23")) return giveUp(`${what}: ${error.message}`);
  return retry(`${what}: ${error.message}`);
}

/**
 * Insert-or-update that never lets an older event overwrite a newer one.
 *
 * Step 1 creates the row if it isn't there and otherwise does nothing. Step 2
 * updates it only if the stored event time is no newer than this one. Postgres
 * runs step 2 as a single statement under the row lock, so two events racing
 * each other can't both win: whichever is older finds the condition false and
 * changes nothing. No read-then-write gap, and no database function needed.
 */
async function writeInOrder(
  table: "subscriptions" | "subscription_invoices",
  key: "stripe_subscription_id" | "stripe_invoice_id",
  row: Record<string, unknown> & { last_stripe_event_created: number },
): Promise<{ id: string; applied: boolean } | { error: NonNullable<DbError> }> {
  const db = createAdminClient();
  const created = await db.from(table).upsert(row, { onConflict: key, ignoreDuplicates: true });
  if (created.error) return { error: created.error };

  const { data, error } = await db
    .from(table)
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq(key, row[key] as string)
    .lte("last_stripe_event_created", row.last_stripe_event_created)
    .select("id");
  if (error) return { error };
  if (data?.length) return { id: data[0].id as string, applied: true };

  // Stale: a newer event already landed. Still return the row, for the invoice path.
  const { data: existing, error: readError } = await db.from(table).select("id").eq(key, row[key] as string).maybeSingle();
  if (readError || !existing) return { error: readError ?? { message: "row vanished after insert" } };
  return { id: existing.id as string, applied: false };
}

const exactly = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Which member is this? In order: the id we put in the subscription's metadata
 * at checkout (nearly always there), the customer we've already linked, the id
 * on the Stripe customer, and finally the customer's email. The email step only
 * matters for a subscription someone made by hand in the Stripe Dashboard.
 */
async function resolveMember(sub: Stripe.Subscription, customerId: string): Promise<string | null> {
  const fromMeta = memberIdFrom(sub.metadata);
  if (fromMeta) return fromMeta;

  const db = createAdminClient();
  const { data: linked } = await db.from("members").select("id").eq("stripe_customer_id", customerId).maybeSingle();
  if (linked) return linked.id as string;

  const customer = typeof sub.customer === "object" && sub.customer ? sub.customer : await stripe.customers.retrieve(customerId);
  if ("deleted" in customer && customer.deleted) return null;
  const onCustomer = memberIdFrom((customer as Stripe.Customer).metadata);
  if (onCustomer) return onCustomer;

  const email = (customer as Stripe.Customer).email;
  if (!email) return null;
  const { data: byEmail } = await db.from("members").select("id").ilike("email", exactly(email)).limit(2);
  // Two members with one address: don't guess whose card this is.
  return byEmail?.length === 1 ? (byEmail[0].id as string) : null;
}

/** Re-reads the subscription from Stripe and mirrors it. Never trusts the event's copy: a late event carries old data. */
export async function syncSubscription(subscriptionId: string, event: EventStamp, now = new Date()): Promise<SyncOutcome> {
  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "resource_missing") return ok(`subscription ${subscriptionId} doesn't exist in Stripe; nothing to mirror`);
    return retry(`couldn't read subscription ${subscriptionId} from Stripe: ${err instanceof Error ? err.message : String(err)}`);
  }

  const extracted = toSubscriptionRow(sub, event);
  if ("skip" in extracted) return giveUp(`[billing][UNSUPPORTED] ${extracted.skip}`);
  for (const warning of extracted.warnings) console.warn("[billing]", warning);
  const row = extracted.row;

  let memberId: string | null;
  try {
    memberId = await resolveMember(sub, row.stripe_customer_id);
  } catch (err) {
    return retry(`couldn't look up the member for ${sub.id}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!memberId) {
    // Usually checkout is still finishing, so let Stripe retry for a while; after
    // that a person has to link it, and retrying would only fill the logs.
    return shouldRetryUnresolved(event.created, now)
      ? retry(`no member yet for ${sub.id} (customer ${row.stripe_customer_id})`)
      : giveUp(`[billing][UNLINKED] no member for ${sub.id} (customer ${row.stripe_customer_id}); link it by hand`);
  }

  const db = createAdminClient();
  const { data: plan } = await db.from("plans").select("id").eq("stripe_price_id", row.stripe_price_id).maybeSingle();
  const written = await writeInOrder("subscriptions", "stripe_subscription_id", { ...row, member_id: memberId, plan_id: plan?.id ?? null });
  if ("error" in written) return fromDbError(written.error, `subscription ${sub.id}`);

  // Remember the customer on the member, the first time only: a member who
  // already has one keeps it, and the unique index stops two sharing one.
  const { error: linkError } = await db.from("members").update({ stripe_customer_id: row.stripe_customer_id }).eq("id", memberId).is("stripe_customer_id", null);
  if (linkError && linkError.code !== "23505") console.error("[billing] customer link:", linkError.message);

  return ok(written.applied ? `subscription ${sub.id} is ${row.status}` : `subscription ${sub.id}: older event ignored`);
}

/**
 * Records an invoice. Trusts the event's copy (every field kept is fixed once
 * the invoice is paid or failed). If the subscription isn't mirrored yet, which
 * happens because Stripe sends the first invoice alongside the subscription, it
 * mirrors that first.
 */
export async function recordInvoice(invoice: Stripe.Invoice, event: EventStamp, now = new Date()): Promise<SyncOutcome> {
  const extracted = toInvoiceRow(invoice, event);
  if ("skip" in extracted) return ok(extracted.skip);
  for (const warning of extracted.warnings) console.warn("[billing]", warning);
  const { stripe_subscription_id, ...row } = extracted.row;

  const db = createAdminClient();
  const find = () => db.from("subscriptions").select("id").eq("stripe_subscription_id", stripe_subscription_id).maybeSingle();
  let { data: owner, error } = await find();
  if (error) return fromDbError(error, `invoice ${row.stripe_invoice_id}`);
  if (!owner) {
    const synced = await syncSubscription(stripe_subscription_id, event, now);
    if (!synced.ok) return synced;
    ({ data: owner, error } = await find());
    if (error) return fromDbError(error, `invoice ${row.stripe_invoice_id}`);
    if (!owner) return retry(`subscription ${stripe_subscription_id} still missing for invoice ${row.stripe_invoice_id}`);
  }

  const written = await writeInOrder("subscription_invoices", "stripe_invoice_id", { ...row, subscription_id: owner.id });
  if ("error" in written) return fromDbError(written.error, `invoice ${row.stripe_invoice_id}`);
  return ok(written.applied ? `invoice ${row.stripe_invoice_id} is ${row.status}` : `invoice ${row.stripe_invoice_id}: older event ignored`);
}

export type PlanSync = { error: string } | { saved: number; switchedOff: number; skipped: string[] };

/**
 * Copies the Prices tagged with metadata.hub_plan_slug (on the price or its
 * product) into plans. Untagged prices are none of the site's business and are
 * passed over without comment; tagged ones that can't be sold say why. Prices are
 * written only in Stripe; this makes the site match. A plan whose price has been
 * archived is switched off first, so its replacement can take over the slug.
 */
export async function syncPlans(): Promise<PlanSync> {
  const rows = [];
  const skips: { price: Stripe.Price; reason: string }[] = [];
  try {
    for await (const price of stripe.prices.list({ limit: 100, expand: ["data.product"] })) {
      if (!isTaggedPlan(price)) continue;
      const extracted = toPlanRow(price);
      if ("skip" in extracted) skips.push({ price, reason: extracted.skip });
      else rows.push(extracted.row);
    }
  } catch (err) {
    return { error: `Couldn’t read prices from Stripe: ${err instanceof Error ? err.message : String(err)}` };
  }

  const onSale = rows.filter((r) => r.active);
  const skipped = skips.map((s) => skipNote(s.price, s.reason, onSale)).filter((note): note is string => note !== null);
  const slugs = onSale.map((r) => r.slug);
  const doubled = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  if (doubled.length) return { error: `More than one active price is tagged “${doubled[0]}”, on the prices or their product. Archive the old one in Stripe, or give each price its own hub_plan_slug, then sync again.` };

  const db = createAdminClient();
  const now = new Date().toISOString();
  const keep = new Set(onSale.map((r) => r.stripe_price_id));

  // Switch off anything no longer on sale first, freeing its slug.
  const { data: current, error: readError } = await db.from("plans").select("id, stripe_price_id").eq("active", true);
  if (readError) return { error: readError.code === "PGRST205" ? "The plans table isn’t set up yet. Run add_membership_billing.sql in Supabase." : readError.message };
  const retire = (current ?? []).filter((p) => !keep.has(p.stripe_price_id as string)).map((p) => p.id as string);
  if (retire.length) {
    const { error } = await db.from("plans").update({ active: false, updated_at: now }).in("id", retire);
    if (error) return { error: error.message };
  }

  if (rows.length) {
    const { error } = await db.from("plans").upsert(rows.map((r) => ({ ...r, updated_at: now })), { onConflict: "stripe_price_id" });
    if (error) return { error: error.message };
  }
  return { saved: rows.length, switchedOff: retire.length, skipped };
}
