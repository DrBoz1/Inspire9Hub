"use server";

import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dayPassWindow, SLOT_GONE, SLOT_TAKEN, staleHoldCutoff } from "@/lib/booking-rules";
import { dayPrice, desksOnly, freeDesks } from "@/lib/spaces";
import { memberTotal } from "@/lib/billing/discount";
import { memberDiscountPercent } from "@/lib/billing/member-discount";
import { hubTime } from "@/lib/email/format";
import { firstBookableDay } from "./booking-time";
import { createCheckoutSession } from "./actions";

/**
 * Day passes: a hot desk for the day. Each desk is a workspace, so a pass is an
 * ordinary booking of one desk for the day's opening hours, and the overlap rule
 * that stops double bookings also stops a desk being sold twice. The number of
 * passes a day can sell is simply the number of desks.
 */

export type DayPassOffer =
  | { ok: true; day: string; free: number; total: number; price: number; memberPrice: number; discountPercent: number; from: string; to: string }
  | { ok: false; error: string };

type DeskRow = { id: string; name: string | null; code: string | null; kind: string | null; space_group: string | null; price_per_day: number | string | null; active: boolean | null; bookable: boolean | null };

/** The desks on sale and the ones taken on a day, from one read of each. */
async function desksFor(day: string, memberId: string) {
  const window = dayPassWindow(day, new Date());
  if (!window.ok) return { error: window.error } as const;

  const admin = createAdminClient();
  const { data, error } = await admin.from("workspaces").select("id, name, code, kind, space_group, price_per_day, active, bookable");
  if (error) {
    // price_per_day arrives with add_desks_and_day_passes.sql.
    if (error.code === "42703") return { error: "Day passes aren’t on sale yet." } as const;
    console.error("[day pass] desks:", error.message);
    return { error: "Couldn’t load the desks. Please try again." } as const;
  }
  const desks = desksOnly((data ?? []) as DeskRow[]).filter((d) => d.active !== false && d.bookable !== false && dayPrice(d.price_per_day) !== null);
  if (!desks.length) return { error: "Day passes aren’t on sale yet." } as const;

  const { startISO, endISO } = window.value;
  // Taken: a confirmed pass, or someone else's checkout still in progress. Your own
  // unfinished checkout doesn't count; starting again releases it.
  const { data: busy, error: busyError } = await admin
    .from("bookings")
    .select("workspace_id")
    .in("workspace_id", desks.map((d) => d.id))
    .in("booking_status", ["confirmed", "pending"])
    .or(`booking_status.eq.confirmed,and(created_at.gte.${staleHoldCutoff(new Date())},member_id.neq.${memberId})`)
    .lt("start_date_time", endISO)
    .gt("end_date_time", startISO);
  if (busyError) {
    console.error("[day pass] busy desks:", busyError.message);
    return { error: "Couldn’t check the desks. Please try again." } as const;
  }
  const taken = new Set((busy ?? []).map((b) => b.workspace_id as string));
  return { desks, free: freeDesks(desks, taken), window: window.value } as const;
}

/**
 * How many desks are free on a day, and what a pass costs this member. With no
 * day it answers for the first one still bookable, which is what the page wants.
 */
export async function getDayPassOffer(dayWanted?: string): Promise<DayPassOffer> {
  const day = dayWanted ?? firstBookableDay(Date.now());
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to see day passes." };

  const found = await desksFor(day, user.id);
  if ("error" in found) return { ok: false, error: found.error ?? "Day passes aren’t on sale yet." };
  // One price for every desk in practice; the lowest, if staff ever set them apart.
  const price = Math.min(...found.desks.map((d) => dayPrice(d.price_per_day)!));
  const discountPercent = await memberDiscountPercent(user.id);
  return {
    ok: true,
    day,
    free: found.free.length,
    total: found.desks.length,
    price,
    memberPrice: discountPercent > 0 ? memberTotal(price, 1, discountPercent) : price,
    discountPercent,
    from: hubTime(found.window.startISO),
    to: hubTime(found.window.endISO),
  };
}

/**
 * Buys a pass for any free desk: takes the first free one and goes to checkout.
 * If another member takes that desk in the same instant, the overlap rule turns
 * this one away and it moves on to the next, so a rush never shows "sold out"
 * while desks are still free. On success it redirects to Stripe and never returns.
 */
export async function startDayPass(day: string): Promise<{ error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to book a day pass." };

  const found = await desksFor(day, user.id);
  if ("error" in found) return { error: found.error ?? "Day passes aren’t on sale yet." };
  if (!found.free.length) return { error: "Every desk is taken that day. Try another day." };

  const { startISO, endISO } = found.window;
  for (const desk of found.free.slice(0, 5)) {
    try {
      await createCheckoutSession({
        workspaceId: desk.id,
        roomName: desk.name ?? "Hot desk",
        amount: 0, // display only; checkout works out the charge
        date: day,
        startTime: hubTime(startISO),
        endTime: hubTime(endISO),
        startISO,
        endISO,
        day,
      });
    } catch (err) {
      unstable_rethrow(err); // the redirect to Stripe
      const message = err instanceof Error ? err.message : "";
      if (message === SLOT_TAKEN || message === SLOT_GONE) continue; // someone got this desk first: try the next
      return { error: message || "Couldn’t start checkout. Please try again." };
    }
  }
  return { error: "The desks are going fast. Please try again." };
}
