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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Clock,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Loader2,
  CalendarDays,
  Ban,
} from "lucide-react";
import { isBefore, startOfToday, format, parseISO } from "date-fns";
import {
  checkRoomAvailability,
  createCheckoutSession,
  getBookedSlotsForDate,
} from "./actions";
import { getRoomPrice } from "@/lib/constants";

export default function BookingModal({ room }: { room: any }) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [isChecking, setIsChecking] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<
    { start_date_time: string; end_date_time: string }[]
  >([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const hourlyRate = getRoomPrice(room.capacity);
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const durationMins = endH * 60 + endM - (startH * 60 + startM);
  const durationHours = durationMins / 60;
  const totalCost = durationHours > 0 ? durationHours * hourlyRate : 0;

  // Fetch booked slots whenever the selected date changes
  useEffect(() => {
    if (!date) return;
    const dateStr = format(date, "yyyy-MM-dd");
    setLoadingSlots(true);
    getBookedSlotsForDate(room.id, dateStr).then((slots) => {
      setBookedSlots(slots);
      setLoadingSlots(false);
    });
  }, [date, room.id]);

  const handleBookingStart = async () => {
    if (!date) return toast.error("Please select a date.");
    if (durationMins <= 0) return toast.error("Departure must be after arrival.");
    if (durationMins < 60) return toast.error("Minimum booking is 1 hour.");

    setIsChecking(true);
    const dateStr = format(date, "yyyy-MM-dd");
    const startISO = `${dateStr}T${startTime}:00Z`;
    const endISO = `${dateStr}T${endTime}:00Z`;

    const { available, error } = await checkRoomAvailability(
      room.id,
      startISO,
      endISO,
    );

    if (error || !available) {
      toast.error("Time Conflict", {
        description: "That slot is already booked. Pick a different time.",
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
        startTime,
        endTime,
      });
    } catch (err: any) {
      if (err?.digest?.startsWith("NEXT_REDIRECT")) throw err;
      toast.dismiss(toastId);
      toast.error("Booking Failed", { description: err.message });
      setIsChecking(false);
    }
  };

  const durationLabel =
    durationMins > 0
      ? durationHours % 1 === 0
        ? `${durationHours}h`
        : `${Math.floor(durationHours)}h ${durationMins % 60}m`
      : null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full bg-slate-950 hover:bg-[#E31E24] text-white h-16 rounded-2xl font-black uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-slate-200 group">
          Book Space{" "}
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-250 w-[95vw] p-0 rounded-3xl overflow-hidden border-none shadow-2xl bg-white">
        <DialogHeader className="sr-only">
          <DialogTitle>Book {room.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row min-h-145">
          {/* ── Left: Date & time picker ─────────────────────────── */}
          <div className="flex-[1.3] p-8 bg-slate-50 border-r border-slate-100 space-y-6 flex flex-col">
            {/* Room header */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-1">
                Booking
              </p>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {room.name}
              </h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5 uppercase tracking-wider">
                {room.location || "Inspire9 Hub"} · ${hourlyRate}/hr
              </p>
            </div>

            {/* Calendar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 w-fit mx-auto">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) => isBefore(d, startOfToday())}
                className="rounded-xl"
              />
            </div>

            {/* Time pickers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  From
                </Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="h-12 pl-10 rounded-xl border-slate-200 bg-white font-bold"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Until
                </Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="h-12 pl-10 rounded-xl border-slate-200 bg-white font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Duration chip */}
            {durationLabel && (
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center">
                Duration:{" "}
                <span className="text-slate-700">{durationLabel}</span>
              </p>
            )}

            {/* Booked slots for selected date */}
            <div className="flex-1 min-h-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                <CalendarDays className="w-3 h-3" />
                {date
                  ? `Taken on ${format(date, "d MMM")}`
                  : "Select a date"}
              </p>
              {loadingSlots ? (
                <div className="flex items-center gap-2 text-slate-300">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-xs font-bold">Checking…</span>
                </div>
              ) : bookedSlots.length === 0 ? (
                <p className="text-xs text-emerald-600 font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> All slots available
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {bookedSlots.map((slot, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[10px] font-black bg-red-50 text-red-500 px-2.5 py-1 rounded-lg border border-red-100"
                    >
                      <Ban className="w-3 h-3" />
                      {format(parseISO(slot.start_date_time), "h:mm a")} –{" "}
                      {format(parseISO(slot.end_date_time), "h:mm a")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Invoice + Pay ─────────────────────────────── */}
          <div className="flex-1 p-8 bg-white flex flex-col gap-6">
            {/* Invoice card */}
            <div className="bg-slate-900 rounded-2xl p-8 text-white flex-1 flex flex-col justify-between relative overflow-hidden">
              {/* Decorative circles */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />

              <div className="relative z-10 space-y-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                    Invoice Summary
                  </p>
                  <p className="text-xs font-bold text-slate-400 mt-3">
                    {date ? format(date, "EEEE, d MMMM yyyy") : "—"}
                  </p>
                  <p className="text-xs font-bold text-slate-500 mt-0.5">
                    {startTime} – {endTime} · {durationLabel ?? "—"}
                  </p>
                </div>

                <div className="border-t border-white/10 pt-6">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Total (AUD)
                  </p>
                  <p className="text-5xl font-black tracking-tighter mt-1">
                    ${totalCost.toFixed(0)}
                    <span className="text-lg text-slate-400">.00</span>
                  </p>
                </div>
              </div>

              <div className="relative z-10 space-y-2 mt-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    Includes GST & booking fees
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    Slot held 30 min during checkout
                  </span>
                </div>
              </div>
            </div>

            {/* Pay button */}
            <Button
              disabled={isChecking || totalCost <= 0 || durationMins < 60}
              onClick={handleBookingStart}
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
