import { HUB_TIMEZONE } from "@/lib/datetime";

export type SuccessBooking = {
  id: string;
  booking_status: string;
  start_date_time: string;
  end_date_time: string;
  workspaces: { name: string } | { name: string }[] | null;
  amount: number | string | null;
};

export type SuccessState =
  | { phase: "confirming" }
  | { phase: "confirmed"; booking: SuccessBooking }
  | { phase: "processing" }
  | { phase: "attention" }
  | { phase: "closed" };

/** How many times to look for the webhook's confirmation, and how far apart. */
export const MAX_CHECKS = 8;
export const CHECK_INTERVAL_MS = 1500;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The booking id Stripe's success redirect left in the URL, or null. */
export function successBookingId(search: string): string | null {
  const params = new URLSearchParams(search);
  if (params.get("status") !== "success") return null;
  const id = params.get("bookingId");
  return id && UUID.test(id) ? id : null;
}

/** What one lookup means. `attempt` counts from 0. */
export function afterCheck(
  result: SuccessBooking | null | "error",
  attempt: number,
): { state: SuccessState; retry: boolean } {
  const last = attempt >= MAX_CHECKS - 1;
  const keepWaiting = (): { state: SuccessState; retry: boolean } =>
    last ? { state: { phase: "processing" }, retry: false } : { state: { phase: "confirming" }, retry: true };

  // No such booking, or not this member's: nothing to show.
  if (result === null) return { state: { phase: "closed" }, retry: false };
  if (result === "error") return keepWaiting();
  if (result.booking_status === "confirmed") return { state: { phase: "confirmed", booking: result }, retry: false };
  if (result.booking_status === "cancelled") return { state: { phase: "attention" }, retry: false };
  // Still pending: Stripe's webhook hasn't landed yet.
  return keepWaiting();
}

const inHub = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-AU", { timeZone: HUB_TIMEZONE, ...options });

function clock(d: Date) {
  const parts = inHub({ hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")} ${get("dayPeriod").toLowerCase()}`;
}

/** Everything the dialog shows, in Melbourne time whatever the browser's zone. */
export function describeBooking(b: SuccessBooking) {
  const start = new Date(b.start_date_time);
  const end = new Date(b.end_date_time);
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const whole = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const amount = b.amount === null || b.amount === "" ? NaN : Number(b.amount);

  return {
    room: (Array.isArray(b.workspaces) ? b.workspaces[0] : b.workspaces)?.name ?? "Your space",
    weekday: inHub({ weekday: "long" }).format(start),
    day: inHub({ day: "numeric" }).format(start),
    month: inHub({ month: "short" }).format(start),
    monthLong: inHub({ month: "long" }).format(start),
    timeRange: `${clock(start)} – ${clock(end)}`,
    duration: rest === 0 ? `${whole} hour${whole === 1 ? "" : "s"}` : whole === 0 ? `${rest} min` : `${whole} hr ${rest} min`,
    amount: Number.isFinite(amount) ? `$${amount.toFixed(2)}` : null,
    reference: b.id.slice(0, 8).toUpperCase(),
  };
}
