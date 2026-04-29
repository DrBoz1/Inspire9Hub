"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, MapPin, Zap, Star, Monitor } from "lucide-react";
import BookingModal from "./BookingModal";
import { getRoomPrice } from "@/lib/constants";

export default function RoomCard({ room }: { room: any }) {
  const hourlyRate = getRoomPrice(room.capacity);
  const busyToday: boolean = room.busyToday ?? false;

  return (
    <Card className="flex flex-col h-full min-h-[540px] rounded-[40px] border-none shadow-2xl shadow-slate-200/60 bg-white group hover:-translate-y-2 transition-all duration-500 overflow-hidden relative">
      {/* Image area */}
      <div className="relative h-56 bg-slate-100 overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-10" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80')] bg-cover bg-center group-hover:scale-110 transition-transform duration-700" />

        {/* Top-left badges */}
        <div className="absolute top-5 left-5 z-20 flex flex-col gap-2">
          <Badge className="bg-white/95 backdrop-blur-md text-slate-900 border-none font-black text-[10px] px-3 py-1.5 rounded-xl shadow-sm">
            AUD ${hourlyRate}/HR
          </Badge>

          {busyToday ? (
            <Badge className="bg-amber-500 text-white border-none font-black text-[9px] px-3 py-1.5 rounded-lg shadow-lg w-fit">
              BUSY TODAY
            </Badge>
          ) : (
            <Badge className="bg-emerald-500 text-white border-none font-black text-[9px] px-3 py-1.5 rounded-lg shadow-lg shadow-emerald-500/30 w-fit">
              <Zap className="w-3 h-3 mr-1 fill-white" /> OPEN TODAY
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-7 flex flex-col flex-1 gap-4">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight group-hover:text-[#E31E24] transition-colors leading-none">
              {room.name}
            </h3>
            <div className="flex items-center gap-1 text-amber-400 shrink-0 ml-2">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span className="text-xs font-black text-slate-700">4.9</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide">
                {room.capacity} seats
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide">
                {room.location}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-sm text-slate-400 font-medium leading-relaxed">
            <Monitor className="w-4 h-4 mt-0.5 shrink-0 text-slate-200" />
            <p className="text-xs">{room.equipment || "Standard workspace setup."}</p>
          </div>
        </div>

        <div className="mt-auto pt-2">
          <BookingModal room={room} />
        </div>
      </CardContent>
    </Card>
  );
}
