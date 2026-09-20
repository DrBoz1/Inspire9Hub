"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { ArrowRight, CalendarDays, ChevronDown, Loader2, Sun } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { addDaysToKey } from "@/features/booking-map/zoned-time";
import { getDayPassOffer, startDayPass, type DayPassOffer } from "./day-passes";

/**
 * A hot desk for the day. Shown only when desks are on sale, so before the day
 * pass migration and price this card isn't there at all.
 *
 * The desk itself is picked by the server: whichever is free. Members who want a
 * particular desk choose it on the floor plan instead.
 */
export function DayPassCard({ offer: initial, today }: { offer: Extract<DayPassOffer, { ok: true }>; today: string }) {
  const [offer, setOffer] = useState(initial);
  const [day, setDay] = useState(initial.day);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, startLoading] = useTransition();
  const [paying, startPaying] = useTransition();
  const busy = loading || paying;

  const choose = (next: string) => {
    setDay(next);
    setError("");
    setPickerOpen(false);
    startLoading(async () => {
      const fresh = await getDayPassOffer(next);
      if (fresh.ok) setOffer(fresh);
      else setError(fresh.error);
    });
  };

  const pay = () =>
    startPaying(async () => {
      setError("");
      const result = await startDayPass(day);
      // Success redirects to Stripe and never returns.
      if (result?.error) setError(result.error);
    });

  const soldOut = offer.free === 0 && !loading;
  const price = offer.memberPrice;

  return (
    <section className="hub-surface hub-day-pass" aria-labelledby="day-pass-title">
      <div className="hub-day-pass-copy">
        <p className="hub-eyebrow"><Sun size={13} aria-hidden /> Hot desk</p>
        <h2 id="day-pass-title">A desk for the day<span className="hub-red">.</span></h2>
        <p>Any free desk in the south banks, from opening to closing. We&apos;ll pick one for you, or choose your own on the floor plan.</p>
      </div>

      <div className="hub-day-pass-pick">
        <span className="hub-booking-field-label" id="day-pass-date-label">Day</span>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button className="hub-date-choice" disabled={busy} aria-labelledby="day-pass-date-label day-pass-date-value">
              <CalendarDays size={17} strokeWidth={1.5} aria-hidden />
              <span id="day-pass-date-value">{format(parseISO(day), "EEE, d MMMM yyyy")}</span>
              <ChevronDown size={15} aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent className="hub-dialog hub-booking-date-popover" align="start" sideOffset={8} collisionPadding={16}>
            <Calendar
              mode="single"
              required
              autoFocus
              selected={parseISO(day)}
              defaultMonth={parseISO(day)}
              onSelect={(d) => d && !busy && choose(format(d, "yyyy-MM-dd"))}
              disabled={(d) => busy || format(d, "yyyy-MM-dd") < today || format(d, "yyyy-MM-dd") > addDaysToKey(today, 180)}
            />
          </PopoverContent>
        </Popover>

        <p className="hub-day-pass-status" role="status" aria-live="polite">
          {loading ? <><Loader2 size={13} className="animate-spin" aria-hidden />Checking desks…</>
            : soldOut ? "Every desk is taken that day. Try another."
            : `${offer.free} of ${offer.total} desks free · ${offer.from} – ${offer.to}`}
        </p>
      </div>

      <div className="hub-day-pass-buy">
        <div className="hub-reservation-total">
          <div>
            <span className="hub-booking-field-label">Day pass</span>
            <p>{offer.discountPercent > 0 ? `Member rate, ${offer.discountPercent}% off` : "One day, any free desk"}</p>
          </div>
          <strong>
            {offer.discountPercent > 0 && <del>${offer.price.toFixed(2)}</del>}${price.toFixed(2)}<small>AUD</small>
          </strong>
        </div>
        {error && <p className="hub-inline-error" role="alert">{error}</p>}
        <button className="hub-button hub-button-primary hub-checkout-button" onClick={pay} disabled={busy || soldOut}>
          {paying ? <><Loader2 size={16} className="animate-spin" aria-hidden />Opening checkout…</> : <>Book a day pass<ArrowRight size={16} aria-hidden /></>}
        </button>
      </div>
    </section>
  );
}
