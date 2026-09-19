"use client";

import { useEffect, useId, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowUpRight, ArrowRight, CalendarDays, ChevronDown, Check, Loader2, LockKeyhole } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { checkRoomAvailability, createCheckoutSession, getBookedSlotsForDate } from "./actions";
import { formatHour, padTime } from "@/lib/datetime";
import { HUB_TIMEZONE } from "@/lib/datetime";
import { addDaysToKey, dayBoundsUtc, todayIn } from "@/features/booking-map/zoned-time";
import { closingHour, wholeHourStarts } from "@/features/booking-map/booking/time";
import { useHubClock } from "@/components/use-hub-clock";
import { bookingInstant, firstBookableDay, rangeUnavailable, type BookedSlot } from "./booking-time";
import type { BookingRoom } from "./RoomCard";

type Availability = { date: string; slots: BookedSlot[]; error?: string };

export default function BookingModal({ room }: { room: BookingRoom }) {
  const dateFieldId = useId();
  const [open, setOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [date, setDate] = useState(() => firstBookableDay(Date.now()));
  const [range, setRange] = useState<[number, number] | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const checkoutLock = useRef(false);
  const clock = useHubClock();
  const today = clock ? todayIn(HUB_TIMEZONE, clock.getTime()) : date;
  const now = clock?.getTime() ?? 0;
  const loading = availability?.date !== date;
  const slots = availability?.date === date ? availability.slots : [];
  const blocked = !!range && rangeUnavailable(date, range[0], range[1], slots, now);
  const duration = range ? range[1] - range[0] : 0;
  const total = duration * Number(room.price_per_hour);
  const availabilityError = availability?.date === date ? availability.error : undefined;
  // Opening hours come from the floor plan's OPENING table, so this form and the
  // map always agree about when the hub is open.
  const hours = wholeHourStarts(date);
  const closes = closingHour(date);
  const closed = hours.length === 0;
  const noTimes = !loading && !availabilityError && !closed && hours.every(hour => rangeUnavailable(date, hour, hour + 1, slots, now));
  const ready = !!range && !closed && !blocked && !loading && !availabilityError && total > 0 && !checking;

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    const bounds = dayBoundsUtc(date, HUB_TIMEZONE);
    getBookedSlotsForDate(room.id, new Date(bounds.start).toISOString(), new Date(bounds.end - 1).toISOString())
      .then(result => { if (!ignore) setAvailability({ date, slots: result }); })
      .catch(() => { if (!ignore) setAvailability({ date, slots: [], error: "We couldn't load the day's schedule." }); });
    return () => { ignore = true; };
  }, [open, date, room.id, refresh]);

  function updateRange(next: [number, number]) { setRange(next); setError(""); }
  function refreshSlots() { setAvailability(null); setRefresh(n => n + 1); }

  async function handlePay() {
    if (!ready || !range || checkoutLock.current) return;
    checkoutLock.current = true; setChecking(true); setError("");
    try {
      const startISO = bookingInstant(date, range[0]);
      const endISO = bookingInstant(date, range[1]);
      if (Date.parse(startISO) <= Date.now()) throw new Error("That start time has passed. Choose a later time.");
      const result = await checkRoomAvailability(room.id, startISO, endISO);
      if (result.error) throw new Error("Availability couldn't be verified. Please try again.");
      if (!result.available) { refreshSlots(); throw new Error("This time is unavailable. Your selection is saved so you can adjust it."); }
      await createCheckoutSession({ workspaceId: room.id, roomName: room.name, amount: total, date, startTime: padTime(range[0]), endTime: padTime(range[1]), startISO, endISO });
    } catch (err) {
      if (err && typeof err === "object" && "digest" in err && String(err.digest).startsWith("NEXT_REDIRECT")) throw err;
      setError(err instanceof Error ? err.message : "Checkout couldn't start. Please try again.");
      setChecking(false); checkoutLock.current = false;
    }
  }

  return <Dialog open={open} onOpenChange={value => {
    if (checkoutLock.current) return;
    setOpen(value);
    if (!value) setDatePickerOpen(false);
    if (value) { const first = firstBookableDay(Date.now()); if (date < first) { setDate(first); setRange(null); } refreshSlots(); setError(""); }
  }}>
    <DialogTrigger asChild><button className="hub-button hub-room-book">Find a time<ArrowUpRight size={16} /></button></DialogTrigger>
    <DialogContent className="hub-dialog hub-booking-dialog" overlayClassName="hub-booking-overlay">
      <DialogHeader className="hub-booking-dialog-header">
        <p className="hub-eyebrow">Reserve a space</p>
        <DialogTitle>{room.name}</DialogTitle>
        <DialogDescription>{room.location || "Inspire9"} · Up to {room.capacity} people</DialogDescription>
      </DialogHeader>
      <div className="hub-reservation-detail">
        <div className="hub-booking-date-field">
          <span className="hub-booking-field-label" id={dateFieldId + "-label"}>Date</span>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button className="hub-date-choice" disabled={checking} aria-labelledby={dateFieldId + "-label " + dateFieldId + "-value"}>
                <CalendarDays size={17} strokeWidth={1.5} /><span id={dateFieldId + "-value"}>{format(parseISO(date), "EEE, d MMMM yyyy")}</span><ChevronDown size={15} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="hub-dialog hub-booking-date-popover" align="start" sideOffset={8} collisionPadding={16}>
              <Calendar mode="single" required autoFocus selected={parseISO(date)} defaultMonth={parseISO(date)}
                onSelect={d => {
                  if (!checking && d) {
                    setDate(format(d, "yyyy-MM-dd")); setRange(null); setError(""); setDatePickerOpen(false);
                  }
                }}
                disabled={d => checking || format(d, "yyyy-MM-dd") < today || format(d, "yyyy-MM-dd") > addDaysToKey(today, 180)}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="hub-time-selects">
          <label>Start time<select aria-label="Start time" disabled={closed || loading || checking || !!availabilityError || noTimes} value={range?.[0] ?? ""} onChange={e => {
            const h = Number(e.target.value);
            const end = range && range[1] > h && !rangeUnavailable(date, h, range[1], slots, now) ? range[1] : h + 1;
            updateRange([h, end]);
          }}>
            <option value="" disabled>Select start</option>
            {hours.map(h => {
              const unavailable = rangeUnavailable(date, h, h + 1, slots, now);
              return <option key={h} value={h} disabled={unavailable}>{formatHour(h)}{unavailable ? " · unavailable" : ""}</option>;
            })}
          </select></label>
          <span className="hub-time-separator" aria-hidden="true">–</span>
          <label>End time<select aria-label="End time" disabled={closed || loading || checking || !!availabilityError || !range || noTimes} value={range?.[1] ?? ""} onChange={e => {
            if (range) updateRange([range[0], Number(e.target.value)]);
          }}>
            <option value="" disabled>Select end</option>
            {hours.map(h => h + 1).filter(h => !range || h > range[0]).map(h => <option key={h} value={h} disabled={!!range && rangeUnavailable(date, range[0], h, slots, now)}>{formatHour(h)}</option>)}
          </select></label>
        </div>
        <p className="hub-booking-hours">
          {closed ? "Melbourne time · closed on this date" : `Melbourne time · ${formatHour(hours[0])}–${formatHour(closes ?? 0)} · 1-hour minimum`}
        </p>
        <div className="hub-booking-availability" role="status" aria-live="polite" data-available={ready}>
          {closed ? "Inspire9 is closed on this date. Pick another day."
            : loading ? <><Loader2 size={13} className="animate-spin" />Checking available times…</>
            : availabilityError ? <span>{availabilityError} <button onClick={refreshSlots}>Try again</button></span>
            : noTimes ? "No times left on this date. Try another day."
            : blocked ? "That time is no longer available. Choose another start time."
            : range ? <><Check size={14} />Your selected time is available.</>
            : "Choose a start time. Unavailable times are disabled."}
        </div>
        <div className="hub-reservation-total" aria-live="polite" aria-atomic="true">
          <div><span className="hub-booking-field-label">Total</span><p>{duration ? `${duration} hour${duration === 1 ? "" : "s"} × $${Number(room.price_per_hour).toFixed(2)}` : `$${Number(room.price_per_hour).toFixed(2)} per hour`}</p></div>
          <strong>{duration ? `$${total.toFixed(2)}` : "—"}<small>AUD</small></strong>
        </div>
        {error && <p className="hub-inline-error" role="alert">{error}</p>}
        <button className="hub-button hub-button-primary hub-checkout-button" disabled={!ready} onClick={handlePay}>{checking ? <><Loader2 size={16} className="animate-spin" />Opening checkout…</> : <>Continue to payment<ArrowRight size={16} /></>}</button>
        <p className="hub-checkout-note"><LockKeyhole size={12} />Secure checkout · Confirm before you pay</p>
      </div>
    </DialogContent>
  </Dialog>;
}
