"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
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
import { getRoomPrice } from "@/lib/constants";

const ALL_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

function formatHour(h: number) {
  if (h === 12) return "12 PM";
  if (h === 24 || h === 0) return "12 AM";
  return h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`;
}

function padTime(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

function isHourOccupied(
  hour: number,
  slots: { start_date_time: string; end_date_time: string }[],
) {
  if (hour >= 20) return false;
  return slots.some((s) => {
    const sH = new Date(s.start_date_time).getUTCHours();
    const eH = new Date(s.end_date_time).getUTCHours();
    return sH < hour + 1 && eH > hour;
  });
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

  const hourlyRate = getRoomPrice(room.capacity);
  const duration =
    startHour !== null && endHour !== null ? endHour - startHour : 0;
  const totalCost = duration > 0 ? duration * hourlyRate : 0;

  useEffect(() => {
    if (!date) return;
    setLoadingSlots(true);
    setStartHour(null);
    setEndHour(null);
    getBookedSlotsForDate(room.id, format(date, "yyyy-MM-dd")).then((slots) => {
      setBookedSlots(slots);
      setLoadingSlots(false);
    });
  }, [date, room.id]);

  function handleSlotClick(hour: number) {
    const occupied = isHourOccupied(hour, bookedSlots);

    // ── No start yet (or resetting) ─────────────────────────
    if (startHour === null || endHour !== null) {
      if (hour >= 20) return; // can't start at 8 PM
      if (occupied) {
        toast.error("That hour is already booked.");
        return;
      }
      setStartHour(hour);
      setEndHour(null);
      return;
    }

    // ── Start set, picking end ───────────────────────────────
    if (hour === startHour) {
      // Deselect
      setStartHour(null);
      return;
    }

    if (hour < startHour) {
      // Clicked before start — restart
      if (hour >= 20 || occupied) return;
      setStartHour(hour);
      setEndHour(null);
      return;
    }

    // hour > startHour — validate no booked slots inside the range
    const rangeBlocked = ALL_HOURS.filter(
      (h) => h >= startHour! && h < hour,
    ).some((h) => isHourOccupied(h, bookedSlots));

    if (rangeBlocked) {
      toast.error("A booked slot falls inside that range.", {
        description: "Choose an end time before the first blocked slot.",
      });
      return;
    }

    setEndHour(hour);
  }

  function slotClass(hour: number) {
    const occupied = isHourOccupied(hour, bookedSlots);
    const isStart = hour === startHour;
    const isEnd = hour === endHour;
    const inRange =
      startHour !== null &&
      endHour !== null &&
      hour > startHour &&
      hour < endHour;
    const isEndOnly = hour === 20 && startHour === null;

    if (occupied) {
      return "bg-slate-100 text-slate-300 cursor-not-allowed select-none line-through text-xs";
    }
    if (isStart || isEnd) {
      return "bg-[#E31E24] text-white font-black shadow-md shadow-red-200 ring-2 ring-[#E31E24]";
    }
    if (inRange) {
      return "bg-red-50 text-[#E31E24] font-bold ring-1 ring-red-200";
    }
    if (isEndOnly) {
      return "bg-slate-50 text-slate-300 cursor-not-allowed text-xs";
    }
    return "bg-white border border-slate-200 text-slate-600 hover:border-[#E31E24] hover:text-[#E31E24] font-semibold cursor-pointer transition-colors";
  }

  async function handlePay() {
    if (!date) return toast.error("Please select a date.");
    if (startHour === null || endHour === null)
      return toast.error("Select a start and end time on the grid.");
    if (duration < 1) return toast.error("Minimum booking is 1 hour.");

    setIsChecking(true);
    const dateStr = format(date, "yyyy-MM-dd");
    const startISO = `${dateStr}T${padTime(startHour)}:00Z`;
    const endISO = `${dateStr}T${padTime(endHour)}:00Z`;

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
        </DialogHeader>

        <div className="flex flex-col lg:flex-row">
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

            {/* Calendar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 w-fit">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) => isBefore(d, startOfToday())}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {date ? format(date, "d MMM") : "Select a date"} — pick times
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
                  {ALL_HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      disabled={
                        isHourOccupied(h, bookedSlots) ||
                        (h === 20 && startHour === null)
                      }
                      onClick={() => handleSlotClick(h)}
                      className={`py-2.5 rounded-xl text-xs text-center transition-all ${slotClass(h)}`}
                    >
                      {isHourOccupied(h, bookedSlots) ? (
                        <span className="line-through opacity-50">
                          {formatHour(h)}
                        </span>
                      ) : (
                        formatHour(h)
                      )}
                    </button>
                  ))}
                </div>
              )}

              <p className="text-[11px] font-semibold text-slate-500 pt-1">
                {selectionLabel}
              </p>

              <div className="flex gap-4">
                <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                  <span className="w-3 h-3 rounded-sm bg-slate-100 inline-block" />
                  Unavailable
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                  <span className="w-3 h-3 rounded-sm bg-[#E31E24] inline-block" />
                  Your selection
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 p-8 flex flex-col gap-6">
            <div className="bg-slate-900 rounded-2xl p-8 text-white flex flex-col gap-5 relative overflow-hidden flex-1">
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
                <p className="text-6xl font-black tracking-tighter mt-2 leading-none">
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
