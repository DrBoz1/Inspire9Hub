"use client";

import { useEffect, useRef, useState } from "react";
import { Slider } from "radix-ui";
import { format, parseISO } from "date-fns";
import { ArrowUpRight, ArrowRight, Clock, Loader2, ShieldCheck, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { checkRoomAvailability, createCheckoutSession, getBookedSlotsForDate } from "./mocks";
import { formatHour, padTime } from "@/lib/datetime";
import { HUB_TIMEZONE } from "@/lib/datetime";
import { addDaysToKey, dayBoundsUtc, todayIn } from "@/features/booking-map/zoned-time";
import { useHubClock } from "@/components/use-hub-clock";
import { bookingInstant, rangeUnavailable, type BookedSlot } from "@/app/(dashboard)/bookings/booking-time";
import type { BookingRoom } from "./RoomCard";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8);
type Availability = { date: string; slots: BookedSlot[]; error?: string };

export default function BookingModal({ room }: { room: BookingRoom }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => todayIn(HUB_TIMEZONE));
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
  const ready = !!range && !blocked && !loading && !availability?.error && total > 0 && !checking;

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
    if (value) { if (date < todayIn(HUB_TIMEZONE)) { setDate(todayIn(HUB_TIMEZONE)); setRange(null); } refreshSlots(); setError(""); }
  }}>
    <DialogTrigger asChild><button className="hub-button hub-room-book">Find a time<ArrowUpRight size={16} /></button></DialogTrigger>
    <DialogContent className="hub-dialog hub-booking-dialog">
      <DialogHeader className="hub-booking-dialog-header"><p className="hub-eyebrow">A space for your next idea</p><DialogTitle>{room.name}</DialogTitle><DialogDescription>{room.location || "Inspire9"} · Up to {room.capacity} people · Times in Melbourne</DialogDescription></DialogHeader>
      <div className="hub-reservation-layout">
        <div className="hub-reservation-calendar"><p className="hub-eyebrow">01 · Choose your day</p><Calendar mode="single" required selected={parseISO(date)} onSelect={d => { if (!checking && d) { setDate(format(d, "yyyy-MM-dd")); setRange(null); setError(""); } }} disabled={d => checking || format(d, "yyyy-MM-dd") < today || format(d, "yyyy-MM-dd") > addDaysToKey(today, 180)} />
          <p className="hub-calendar-note"><Clock size={14} />Book between 8 am and 8 pm.<br />One-hour minimum.</p>
        </div>
        <div className="hub-reservation-detail"><div className="hub-section-top"><p className="hub-eyebrow">02 · Make it your time</p><button className="hub-text-link" onClick={() => { setRange(null); setError(""); }} disabled={checking || !range}><RotateCcw size={12} />Reset</button></div>
          <h3>{format(parseISO(date), "EEEE, d MMMM")}</h3>
          {availability?.error ? <div className="hub-inline-error" role="alert">{availability.error}<button onClick={refreshSlots}>Try again</button></div> : <>
            <p className="hub-time-help" role="status">{loading ? "Loading the day's schedule…" : "Choose an hour below, then adjust how long you'll stay."}</p>
            <div className="hub-day-timeline" aria-label="Hourly availability">{HOURS.map(hour => {
              const unavailable = rangeUnavailable(date, hour, hour + 1, slots, now);
              return <button key={hour} title={`${formatHour(hour)}–${formatHour(hour + 1)}${unavailable ? " · unavailable" : ""}`} aria-label={`${formatHour(hour)} to ${formatHour(hour + 1)}, ${unavailable ? "unavailable" : "select time"}`} disabled={loading || checking || unavailable} data-selected={!!range && hour >= range[0] && hour < range[1]} onClick={() => updateRange([hour, hour + 1])}><span>{hour > 12 ? hour - 12 : hour}</span></button>;
            })}</div>
            <div className="hub-time-legend"><span><i />Available</span><span><i data-state="booked" />Unavailable</span><span><i data-state="selected" />Your time</span></div>
            <div className="hub-range-wrap">
              <Slider.Root className="hub-time-range" min={8} max={20} step={1} minStepsBetweenThumbs={1} value={range ?? [9, 10]} disabled={loading || checking} onValueChange={values => updateRange([values[0], values[1]])}>
                <Slider.Track className="hub-time-range-track"><Slider.Range className="hub-time-range-fill" /></Slider.Track>
                <Slider.Thumb className="hub-time-range-thumb" aria-label="Booking start time" aria-valuetext={formatHour(range?.[0] ?? 9)} />
                <Slider.Thumb className="hub-time-range-thumb" aria-label="Booking end time" aria-valuetext={formatHour(range?.[1] ?? 10)} />
              </Slider.Root><div className="hub-range-labels"><span>8 am</span><span>12 pm</span><span>4 pm</span><span>8 pm</span></div>
            </div>
            <div className="hub-time-selects"><label>Start time<select aria-label="Start time" disabled={loading || checking} value={range?.[0] ?? ""} onChange={e => { const h = Number(e.target.value); updateRange([h, range && range[1] > h ? range[1] : h + 1]); }}><option value="" disabled>Choose a time</option>{HOURS.map(h => <option key={h} value={h} disabled={rangeUnavailable(date, h, h + 1, slots, now)}>{formatHour(h)}</option>)}</select></label><ArrowRight size={16} /><label>End time<select aria-label="End time" disabled={loading || checking || !range} value={range?.[1] ?? ""} onChange={e => { if (range) updateRange([range[0], Number(e.target.value)]); }}><option value="" disabled>Choose a time</option>{HOURS.map(h => h + 1).filter(h => !range || h > range[0]).map(h => <option key={h} value={h}>{formatHour(h)}</option>)}</select></label></div>
          </>}
          {blocked && <p className="hub-inline-error" role="alert">Your selection includes unavailable time. Move the handles or choose another hour.</p>}
          <div className="hub-reservation-total"><div><span className="hub-eyebrow">Your reservation</span><p>{duration ? `${duration} hour${duration === 1 ? "" : "s"} × $${Number(room.price_per_hour).toFixed(2)}` : `$${Number(room.price_per_hour).toFixed(2)} per hour`}</p></div><strong>{duration ? `$${total.toFixed(2)}` : "—"}<small>AUD</small></strong></div>
          {error && <p className="hub-inline-error" role="alert">{error}</p>}
          <button className="hub-button hub-button-primary hub-checkout-button" disabled={!ready} onClick={handlePay}>{checking ? <><Loader2 size={16} className="animate-spin" />Opening checkout…</> : <>Continue to payment<ArrowRight size={16} /></>}</button>
          <p className="hub-checkout-note"><ShieldCheck size={13} />Availability is checked again before secure checkout.</p>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
