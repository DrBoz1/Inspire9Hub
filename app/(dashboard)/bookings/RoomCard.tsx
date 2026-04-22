"use client";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, MapPin, ArrowRight, Zap, Star } from "lucide-react";
import BookingModal from "./BookingModal";

export default function RoomCard({ room }: { room: any }) {
  return (
    <Card className="flex flex-col h-full min-h-[550px] rounded-[40px] border-none shadow-2xl shadow-slate-200/60 bg-white group hover:-translate-y-2 transition-all duration-500 overflow-hidden relative">
      {/* Image / Header Section */}
      <div className="relative h-64 bg-slate-100 overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent z-10" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80')] bg-cover bg-center group-hover:scale-110 transition-transform duration-700" />

        <div className="absolute top-6 left-6 z-20 flex flex-col gap-2">
          <Badge className="bg-white/95 backdrop-blur-md text-slate-900 border-none font-black text-[10px] px-4 py-2 rounded-xl">
            AUD $25/HR
          </Badge>
          <Badge className="bg-emerald-500 text-white border-none font-black text-[9px] px-3 py-1.5 rounded-lg shadow-lg shadow-emerald-500/20 w-fit">
            <Zap className="w-3 h-3 mr-1 fill-white" /> LIVE AVAILABILITY
          </Badge>
        </div>
      </div>

      {/* Content Section */}
      <CardContent className="p-8 flex flex-col flex-1 justify-between">
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <h3 className="text-3xl font-black text-slate-900 tracking-tighter group-hover:text-[#E31E24] transition-colors">
              {room.name}
            </h3>
            <div className="flex items-center gap-1 text-amber-400">
              <Star className="w-4 h-4 fill-current" />
              <span className="text-xs font-black text-slate-900">4.9</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                Seats {room.capacity}
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                {room.location}
              </span>
            </div>
          </div>

          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            A premium workspace designed for focus and collaboration. High-speed
            fiber and ergonomic seating included.
          </p>
        </div>

        {/* The Modal Trigger is the Button */}
        <div className="pt-8">
          <BookingModal room={room} />
        </div>
      </CardContent>
    </Card>
  );
}
