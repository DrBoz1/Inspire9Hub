"use server";

import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { getOrCreateCustomer } from "@/lib/billing/customer";

/**
 * Starting a membership, and managing one. Each returns a Stripe URL for the
 * browser to go to, or a problem as a value: Next hides thrown messages in
 * production, so a throw would reach the member as a blank error.
 */
export type RedirectResult = { url: string } | { error: string };

const base = () => process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || null;
const UNREACHABLE = "Couldn’t reach our payment provider. Please try again.";

export async function startMembership(planSlug: string): Promise<RedirectResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to become a member." };
  if (typeof planSlug !== "string" || !/^[a-z0-9-]{1,60}$/.test(planSlug)) return { error: "Pick a plan." };
  const root = base();
  if (!root) return { error: "Payments aren’t set up on this site yet." };

  const db = createAdminClient();
  const [{ data: plan }, { data: live }] = await Promise.all([
    db.from("plans").select("id, slug, stripe_price_id").eq("slug", planSlug).eq("active", true).maybeSingle(),
    // A quick, friendly check; the database's unique index is the real guard against paying twice.
    db.from("subscriptions").select("id").eq("member_id", user.id).in("status", ["trialing", "active", "past_due"]).limit(1),
  ]);
  if (!plan) return { error: "That plan isn’t on sale any more. Refresh the page to see what is." };
  if (live?.length) return { error: "You already have a membership. Use Manage billing to change it." };

  const customer = await getOrCreateCustomer(user.id);
  if ("error" in customer) return customer;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      // Always our customer, never customer_email: Checkout creating its own
      // customer is how one member ends up with two, and gets billed twice.
      customer: customer.customerId,
      line_items: [{ price: plan.stripe_price_id as string, quantity: 1 }],
      // On the subscription itself, so every later event can find the member
      // without a lookup.
      subscription_data: { metadata: { member_id: user.id, plan_id: plan.id as string, plan_slug: plan.slug as string } },
      metadata: { member_id: user.id, plan_id: plan.id as string },
      client_reference_id: user.id,
      // Unlike a booking, there's no expiry: a membership doesn't hold a room,
      // so there's nothing to release if someone takes their time.
      success_url: `${root}/membership?status=joined`,
      cancel_url: `${root}/membership?status=cancelled`,
    });
    return session.url ? { url: session.url } : { error: UNREACHABLE };
  } catch (err) {
    console.error("[membership] checkout:", err instanceof Error ? err.message : err);
    return { error: UNREACHABLE };
  }
}

/** Stripe's own page for changing card, seeing invoices, and cancelling. */
export async function openBillingPortal(): Promise<RedirectResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to manage your membership." };
  const root = base();
  if (!root) return { error: "Payments aren’t set up on this site yet." };

  const { data: member } = await createAdminClient().from("members").select("stripe_customer_id").eq("id", user.id).maybeSingle();
  const customer = member?.stripe_customer_id as string | null | undefined;
  if (!customer) return { error: "There’s no billing to manage yet." };

  try {
    const session = await stripe.billingPortal.sessions.create({ customer, return_url: `${root}/membership` });
    return { url: session.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[membership] portal:", message);
    // The portal has to be switched on once in the Stripe Dashboard before it works.
    return { error: /configuration/i.test(message) ? "Billing management isn’t switched on yet. Please contact the team." : UNREACHABLE };
  }
}
