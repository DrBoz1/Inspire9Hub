"use client";

import { useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, LayoutGrid, Clock, ShieldCheck } from "lucide-react";
import RoomCard from "./RoomCard";
import { Badge } from "@/components/ui/badge";

// UPDATED INTERFACE: Added 'rooms' here
export default function BookingClient({
  initialBookings,
  rooms,
}: {
  initialBookings: any[];
  rooms: any[];
}) {
  const [view, setView] = useState("available");

  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const item: Variants = {
    hidden: { y: 20, opacity: 0 },
    show: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 24 } as const,
    },
  };

  return (
    <Tabs defaultValue="available" className="w-full" onValueChange={setView}>
      <div className="flex justify-between items-center mb-8">
        <TabsList className="bg-slate-100 p-1 rounded-2xl h-14">
          <TabsTrigger
            value="available"
            className="rounded-xl px-6 font-bold data-[state=active]:bg-white data-[state=active]:text-[#E31E24] data-[state=active]:shadow-sm"
          >
            <LayoutGrid className="w-4 h-4 mr-2" /> Browse Rooms
          </TabsTrigger>
          <TabsTrigger
            value="my-bookings"
            className="rounded-xl px-6 font-bold data-[state=active]:bg-white data-[state=active]:text-[#E31E24] data-[state=active]:shadow-sm"
          >
            <Clock className="w-4 h-4 mr-2" /> My Schedule
          </TabsTrigger>
        </TabsList>

        <div className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" /> Instant
          Confirmation Active
        </div>
      </div>

      <AnimatePresence mode="wait">
        <TabsContent value="available" key="available" className="mt-0">
          {rooms.length > 0 ? (
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {rooms.map((room) => (
                <motion.div key={room.id} variants={item} className="h-full">
                  <RoomCard room={room} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center border-4 border-dashed border-slate-100 rounded-[60px] space-y-4">
              <p className="text-slate-300 font-black uppercase tracking-widest italic text-xl">
                No Workspaces Found
              </p>
              <p className="text-slate-400 text-sm font-medium">
                Please check your database seeding or contact support.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-bookings" key="my-bookings">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            {initialBookings.length > 0 ? (
              initialBookings.map((b) => (
                <Card
                  key={b.id}
                  className="rounded-3xl border-slate-100 overflow-hidden"
                >
                  <CardContent className="p-6 flex justify-between items-center">
                    <div className="flex gap-4 items-center">
                      <div className="h-12 w-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
                        <CalendarDays className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900">
                          {b.workspaces?.name || "Meeting Room"}
                        </p>
                        <p className="text-xs text-slate-400 font-bold uppercase">
                          {b.start_date_time.split("T")[0]}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-600 border-none px-4 py-1 rounded-full font-black text-[10px]">
                      {b.booking_status.toUpperCase()}
                    </Badge>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[40px] text-slate-300 italic font-bold uppercase tracking-widest text-xs">
                No upcoming bookings found.
              </div>
            )}
          </motion.div>
        </TabsContent>
      </AnimatePresence>
    </Tabs>
  );
}
