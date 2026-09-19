import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The member's Stripe customer, created the first time they need one. Server only.
 *
 * One customer per member is what stops double billing, so it's guarded three
 * ways: the database won't let two members share one (a unique index), the
 * create call carries an idempotency key so a double click makes one customer
 * not two, and the link is only written if the member has none yet; if two
 * requests race, whichever saved first wins and both use it.
 *
 * Checkout is never allowed to create a customer on its own (no customer_email):
 * a customer the app never hears about is exactly the duplicate this prevents.
 */
export async function getOrCreateCustomer(memberId: string): Promise<{ customerId: string } | { error: string }> {
  const db = createAdminClient();
  const { data: member, error } = await db.from("members").select("full_name, email, stripe_customer_id").eq("id", memberId).maybeSingle();
  if (error) return { error: error.code === "42703" ? "Memberships aren’t set up yet." : "Couldn’t load your account. Please try again." };
  if (!member) return { error: "Couldn’t find your account." };

  if (member.stripe_customer_id) {
    try {
      const existing = await stripe.customers.retrieve(member.stripe_customer_id as string);
      if (!("deleted" in existing && existing.deleted)) return { customerId: existing.id };
      // Deleted in Stripe: forget it and make a fresh one below.
      await db.from("members").update({ stripe_customer_id: null }).eq("id", memberId).eq("stripe_customer_id", member.stripe_customer_id);
    } catch (err) {
      if ((err as { code?: string }).code !== "resource_missing") return { error: "Couldn’t reach our payment provider. Please try again." };
      await db.from("members").update({ stripe_customer_id: null }).eq("id", memberId).eq("stripe_customer_id", member.stripe_customer_id);
    }
  }

  let created: Stripe.Customer;
  try {
    created = await stripe.customers.create(
      { email: (member.email as string | null) ?? undefined, name: (member.full_name as string | null) ?? undefined, metadata: { member_id: memberId } },
      // Same key for the same member today: a double click returns the same customer.
      { idempotencyKey: `member-customer-${memberId}-${new Date().toISOString().slice(0, 10)}` },
    );
  } catch {
    return { error: "Couldn’t reach our payment provider. Please try again." };
  }

  // Saved only if nothing else got there first, then read back: if another
  // request won the race, use its customer. The loser is an unused customer in
  // Stripe tagged with this member id, harmless and easy to spot.
  await db.from("members").update({ stripe_customer_id: created.id }).eq("id", memberId).is("stripe_customer_id", null);
  const { data: winner } = await db.from("members").select("stripe_customer_id").eq("id", memberId).maybeSingle();
  return { customerId: (winner?.stripe_customer_id as string | null) ?? created.id };
}
