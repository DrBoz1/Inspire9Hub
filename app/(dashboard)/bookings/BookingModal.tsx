"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import {
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { isBefore, startOfToday, format } from "date-fns";
import {
  checkRoomAvailability,
  createCheckoutSession,
  getBookedSlotsForDate,
} from "./actions";
import { formatHour, padTime, makeUTCIso } from "@/lib/datetime";

const ALL_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

// A 1-hour block [hour, hour+1) is occupied if any booking overlaps it.
// getHours() returns LOCAL hours on the client — correct for comparing against slot labels.
function isHourOccupied(
  hour: number,
  slots: { start_date_time: string; end_date_time: string }[],
): boolean {
  if (hour >= 20) return false; // 8 PM is only a valid end-boundary, never start
  return slots.some((s) => {
    const sH = new Date(s.start_date_time).getHours(); // local hour
    const eH = new Date(s.end_date_time).getHours();   // local hour
    return sH < hour + 1 && eH > hour;
  });
}

// Disable slots that have already passed today (local time).
function isHourInPast(hour: number, selectedDate: Date | undefined): boolean {
  if (!selectedDate) return false;
  const now = new Date();
  const isToday =
    selectedDate.getFullYear() === now.getFullYear() &&
    selectedDate.getMonth() === now.getMonth() &&
    selectedDate.getDate() === now.getDate();
  if (!isToday) return false;
  // Block the current hour and anything earlier
  return hour <= now.getHours();
}

export default function BookingModal({ room }: { room: any }) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [startHour, setStartHour] = useState<number | null>(null);
  const [endHour, setEndHour] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<
    { start_date_time: string; end_date_time: string }[]
  >([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const hourlyRate = room.price_per_hour;
  const duration =
    startHour !== null && endHour !== null ? endHour - startHour : 0;
  const totalCost = duration > 0 ? duration * hourlyRate : 0;

  // Reload availability whenever date changes.
  // Pass UTC day boundaries computed in the browser so the query is timezone-correct.
  useEffect(() => {
    if (!date) return;
    setLoadingSlots(true);
    setStartHour(null);
    setEndHour(null);

    // Day start/end in local timezone → UTC for the Supabase query
    const dayStart = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0, 0, 0, 0,
    ).toISOString();
    const dayEnd = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      23, 59, 59, 999,
    ).toISOString();

    getBookedSlotsForDate(room.id, dayStart, dayEnd).then((slots) => {
      setBookedSlots(slots);
      setLoadingSlots(false);
    });
  }, [date, room.id]);

  function isSlotDisabled(hour: number): boolean {
    return (
      isHourOccupied(hour, bookedSlots) ||
      isHourInPast(hour, date) ||
      (hour === 20 && startHour === null) // 8 PM can't be a start time
    );
  }

  function handleSlotClick(hour: number) {
    if (isSlotDisabled(hour)) return;

    // ── No start set yet (or resetting) ────────────────────────
    if (startHour === null || endHour !== null) {
      if (hour >= 20) return;
      setStartHour(hour);
      setEndHour(null);
      return;
    }

    // ── Deselect current start ──────────────────────────────────
    if (hour === startHour) {
      setStartHour(null);
      return;
    }

    // ── Clicked before start — restart ─────────────────────────
    if (hour < startHour) {
      setStartHour(hour);
      setEndHour(null);
      return;
    }

    // ── hour > startHour — validate the range ──────────────────
    const rangeBlocked = ALL_HOURS.filter(
      (h) => h >= startHour! && h < hour,
    ).some((h) => isHourOccupied(h, bookedSlots) || isHourInPast(h, date));

    if (rangeBlocked) {
      toast.error("A blocked slot falls inside that range.", {
        description: "Choose an end time before the first unavailable slot.",
      });
      return;
    }

    setEndHour(hour);
  }

  function slotClass(hour: number): string {
    const disabled = isSlotDisabled(hour);
    const isStart = hour === startHour;
    const isEnd = hour === endHour;
    const inRange =
      startHour !== null &&
      endHour !== null &&
      hour > startHour &&
      hour < endHour;

    if (disabled) {
      return "bg-slate-100 text-slate-300 cursor-not-allowed select-none";
    }
    if (isStart || isEnd) {
      return "bg-[#E31E24] text-white font-black shadow-md shadow-red-200 ring-2 ring-[#E31E24]";
    }
    if (inRange) {
      return "bg-red-50 text-[#E31E24] font-bold ring-1 ring-red-200";
    }
    return "bg-white border border-slate-200 text-slate-600 hover:border-[#E31E24] hover:text-[#E31E24] font-semibold cursor-pointer transition-colors";
  }

  async function handlePay() {
    if (!date) return toast.error("Please select a date.");
    if (startHour === null || endHour === null)
      return toast.error("Select a start and end time on the grid.");
    if (duration < 1) return toast.error("Minimum booking is 1 hour.");

    setIsChecking(true);

    // Build correct UTC ISO strings from local date + local hours
    const startISO = makeUTCIso(date, startHour);
    const endISO = makeUTCIso(date, endHour);
    const dateStr = format(date, "yyyy-MM-dd");

    const { available, error } = await checkRoomAvailability(
      room.id,
      startISO,
      endISO,
    );
    if (error || !available) {
      toast.error("Slot no longer available", {
        description: "Someone just reserved it. Pick a different time.",
      });
      setIsChecking(false);
      return;
    }

    const toastId = toast.loading("Reserving your seat…");
    try {
      await createCheckoutSession({
        workspaceId: room.id,
        roomName: room.name,
        amount: totalCost,
        date: dateStr,
        startTime: padTime(startHour),
        endTime: padTime(endHour),
        startISO,
        endISO,
      });
    } catch (err: any) {
      if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
      toast.dismiss(toastId);
      toast.error("Booking Failed", { description: err.message });
      setIsChecking(false);
    }
  }

  const selectionLabel =
    startHour !== null && endHour !== null
      ? `${formatHour(startHour)} → ${formatHour(endHour)}`
      : startHour !== null
        ? `From ${formatHour(startHour)} — now pick end time`
        : "Tap a slot to set start time";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full bg-slate-950 hover:bg-[#E31E24] text-white h-16 rounded-2xl font-black uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-slate-200 group">
          Book Space
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-4xl w-[95vw] p-0 rounded-3xl overflow-hidden border-none shadow-2xl bg-white">
        <DialogHeader className="sr-only">
          <DialogTitle>Book {room.name}</DialogTitle>
          <DialogDescription>
            Pick a date and time slots, then continue to secure payment.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row">
          {/* ── Left: calendar + time grid ──────────────────── */}
          <div className="flex-[1.3] p-8 bg-slate-50 border-r border-slate-100 flex flex-col gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                Reservation
              </p>
              <h2 className="text-xl font-black text-slate-900 mt-0.5">
                {room.name}
              </h2>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                {room.location} · ${hourlyRate} AUD / hr
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 w-fit">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) => isBefore(d, startOfToday())}
              />
            </div>

            {/* Time slot grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {date ? format(date, "d MMM") : "Select a date"} — pick
                  times
                </p>
                {(startHour !== null || endHour !== null) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartHour(null);
                      setEndHour(null);
                    }}
                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}
              </div>

              {loadingSlots ? (
                <div className="flex items-center gap-2 text-slate-300 py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs font-bold">
                    Checking availability…
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {ALL_HOURS.map((h) => {
                    const disabled = isSlotDisabled(h);
                    const past = isHourInPast(h, date);
                    return (
                      <button
                        key={h}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleSlotClick(h)}
                        title={
                          past
                            ? "This time has already passed"
                            : isHourOccupied(h, bookedSlots)
                              ? "Already booked"
                              : undefined
                        }
                        className={`py-2.5 rounded-xl text-xs text-center transition-all ${slotClass(h)}`}
                      >
                        {isHourOccupied(h, bookedSlots) ? (
                          <span className="line-through opacity-60">
                            {formatHour(h)}
                          </span>
                        ) : past ? (
                          <span className="opacity-40">{formatHour(h)}</span>
                        ) : (
                          formatHour(h)
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="text-[11px] font-semibold text-slate-500 pt-1">
                {selectionLabel}
              </p>

              <div className="flex gap-4">
                <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                  <span className="w-3 h-3 rounded-sm bg-slate-100 inline-block" />
                  Booked / past
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                  <span className="w-3 h-3 rounded-sm bg-[#E31E24] inline-block" />
                  Your selection
                </span>
              </div>
            </div>
          </div>

          {/* ── Right: invoice + pay ─────────────────────────── */}
          <div className="flex-1 p-8 flex flex-col gap-6 bg-white dark:bg-slate-950">
            <div className="bg-slate-900 dark:bg-slate-800 rounded-2xl p-8 text-white flex flex-col gap-5 relative overflow-hidden flex-1">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-white/5 rounded-full pointer-events-none" />

              <div className="relative">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                  Invoice Summary
                </p>
                <h3 className="text-3xl font-black text-white mt-3 leading-tight">
                  {room.name}
                </h3>
                <p className="text-base text-slate-400 font-medium mt-1">
                  {date ? format(date, "EEEE, d MMMM yyyy") : "—"}
                </p>
              </div>

              <div className="relative space-y-0 divide-y divide-white/10">
                {[
                  {
                    label: "From",
                    value: startHour !== null ? formatHour(startHour) : "—",
                  },
                  {
                    label: "Until",
                    value: endHour !== null ? formatHour(endHour) : "—",
                  },
                  {
                    label: "Duration",
                    value:
                      duration > 0
                        ? `${duration} hour${duration > 1 ? "s" : ""}`
                        : "—",
                  },
                  { label: "Rate", value: `$${hourlyRate} AUD / hr` },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex justify-between items-center py-3"
                  >
                    <span className="text-sm font-bold text-slate-400">
                      {label}
                    </span>
                    <span className="text-base font-black text-white">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="relative pt-4 border-t border-white/10">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Total (AUD incl. GST)
                </p>
                <p className="text-6xl font-black tracking-tighter mt-2 leading-none text-white!">
                  ${totalCost}
                  <span className="text-2xl text-slate-500">.00</span>
                </p>
              </div>

              <div className="relative space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-400">
                    Includes GST & booking fees
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-400">
                    Slot held 30 min during checkout
                  </span>
                </div>
              </div>
            </div>

            <Button
              disabled={isChecking || totalCost <= 0 || duration < 1}
              onClick={handlePay}
              className="w-full bg-[#E31E24] hover:bg-red-700 h-14 rounded-2xl font-black uppercase tracking-wider text-base shadow-lg shadow-red-100 transition-all active:scale-95"
            >
              {isChecking ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" /> Pay Securely
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
