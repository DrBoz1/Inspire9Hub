"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Clock,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Sparkles,
  Loader2,
} from "lucide-react";
import { isBefore, startOfToday, format } from "date-fns";
import { checkRoomAvailability, createCheckoutSession } from "./actions";

import { getRoomPrice } from "@/lib/constants";

export default function BookingModal({ room }: { room: any }) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [isChecking, setIsChecking] = useState(false);

  // DYNAMIC PRICE CALCULATION
  const hourlyRate = getRoomPrice(room.capacity);
  const startHour = parseInt(startTime.split(":")[0]);
  const endHour = parseInt(endTime.split(":")[0]);
  const duration = endHour - startHour;
  const totalCost = duration > 0 ? duration * hourlyRate : 0;

  //real time availability check
  const handleBookingStart = async () => {
    if (!date) return toast.error("Please select a date");

    setIsChecking(true);
    const dateStr = format(date, "yyyy-MM-dd");
    const startISO = `${dateStr}T${startTime}:00Z`;
    const endISO = `${dateStr}T${endTime}:00Z`;

    //check availability
    const { available, error } = await checkRoomAvailability(
      room.id,
      startISO,
      endISO,
    );

    if (!available) {
      toast.error("Space Occupied", { description: "Try another time slot." });
      setIsChecking(false);
      return;
    }

    //if the room is free trigger stripe
    toast.success("Redirecting to Stripe...");

    await createCheckoutSession({
      workspaceId: room.id,
      roomName: room.name,
      amount: totalCost,
      date: dateStr,
      startTime: startTime,
      endTime: endTime,
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full bg-slate-950 hover:bg-[#E31E24] text-white h-20 rounded-[28px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl shadow-slate-200">
          Book Space <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[1100px] w-[95vw] p-0 rounded-[40px] overflow-hidden border-none shadow-2xl bg-white">
        <DialogHeader className="sr-only">
          <DialogTitle>Book {room.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col md:flex-row min-h-[600px]">
          <div className="flex-[1.2] p-12 bg-slate-50/50 border-r border-slate-100 flex flex-col justify-center">
            <div className="space-y-8">
              <div className="space-y-1">
                <Badge className="bg-slate-900 text-white rounded-md text-[9px] font-black tracking-[0.2em] px-2 py-1">
                  RESERVATION
                </Badge>
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
                  Select <span className="text-[#E31E24]">Time.</span>
                </h2>
              </div>

              <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm w-fit mx-auto">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(date) => isBefore(date, startOfToday())}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Arrival
                  </Label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="h-14 pl-12 rounded-2xl border-slate-200 bg-white font-bold text-lg"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Departure
                  </Label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="h-14 pl-12 rounded-2xl border-slate-200 bg-white font-bold text-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 p-12 bg-white flex flex-col justify-between">
            <div className="space-y-10">
              <div className="pb-6 border-b border-slate-100">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                  {room.name}
                </h3>
                <p className="text-slate-400 font-bold text-xs mt-4 uppercase tracking-widest leading-none">
                  {room.location || "Level 1"} • Inspire9 Hub
                </p>
              </div>

              <div className="bg-slate-900 rounded-[40px] p-10 text-white relative overflow-hidden shadow-2xl">
                <Sparkles className="absolute -top-4 -right-4 w-24 h-24 text-white/5" />
                <div className="relative z-10 space-y-8">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                    <span>Invoice Summary</span>
                    <span className="text-white bg-white/10 px-2 py-0.5 rounded">
                      AUD
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Grand Total
                    </p>
                    <p className="text-6xl font-black italic tracking-tighter leading-none">
                      ${totalCost}.00
                    </p>
                  </div>
                  <div className="pt-6 border-t border-white/10 flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      Price includes GST & Tech Fees
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Button
              disabled={isChecking || totalCost <= 0}
              onClick={handleBookingStart}
              className="w-full bg-[#E31E24] hover:bg-red-700 h-20 rounded-[32px] font-black uppercase tracking-[0.2em] text-lg shadow-2xl shadow-red-200 transition-all active:scale-95 mt-10"
            >
              {isChecking ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-3" /> Pay Securely
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
