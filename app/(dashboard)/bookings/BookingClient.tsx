"use client";

import { useTransition } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarDays,
  LayoutGrid,
  Clock,
  ShieldCheck,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import RoomCard from "./RoomCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cancelConfirmedBooking } from "./actions";
import { getRefundPolicy } from "@/lib/refund-policy";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

function statusColor(status: string) {
  switch (status?.toLowerCase()) {
    case "confirmed":
      return "bg-emerald-50 text-emerald-600";
    case "pending":
      return "bg-amber-50 text-amber-600";
    case "cancelled":
      return "bg-red-50 text-red-500";
    default:
      return "bg-slate-100 text-slate-500";
  }
}

function CancelBookingButton({
  bookingId,
  roomName,
  startDateTime,
}: {
  bookingId: string;
  roomName: string;
  startDateTime: string;
}) {
  const [isPending, startTransition] = useTransition();
  const policy = getRefundPolicy(startDateTime);

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelConfirmedBooking(bookingId);
      if (result?.success) {
        const refundMsg =
          policy.percent === 100
            ? "A full refund has been processed to your card."
            : policy.percent === 50
              ? "A 50% refund has been processed to your card."
              : "No refund applies per our cancellation policy.";
        toast.success("Booking Cancelled", { description: refundMsg });
      } else {
        toast.error("Could Not Cancel", {
          description: result?.error ?? "An unexpected error occurred.",
        });
      }
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all font-black text-xs uppercase tracking-wider"
        >
          <XCircle className="w-4 h-4 mr-1.5" /> Cancel
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-[32px] border-none shadow-2xl p-10">
        <AlertDialogHeader>
          <div className="h-12 w-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <AlertDialogTitle className="text-2xl font-black uppercase tracking-tight">
            Cancel Booking?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 mt-1">
              <p className="font-medium text-slate-500">
                You are about to cancel your booking for{" "}
                <span className="font-bold text-slate-900">{roomName}</span>.
              </p>
              {/* Refund policy badge */}
              <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider ${policy.color}`}>
                <span>{policy.label}</span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {policy.description}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6">
          <AlertDialogCancel className="rounded-xl font-bold">
            Keep Booking
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-widest"
          >
            Yes, Cancel
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function BookingClient({
  initialBookings,
  rooms,
}: {
  initialBookings: any[];
  rooms: any[];
}) {
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

  const upcomingBookings = initialBookings.filter(
    (b) => b.booking_status !== "cancelled",
  );

  return (
    <Tabs defaultValue="available" className="w-full">
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
            {upcomingBookings.length > 0 ? (
              upcomingBookings.map((b) => {
                const isPast =
                  new Date(b.start_date_time) <= new Date();
                const isCancellable =
                  !isPast && b.booking_status !== "cancelled";

                return (
                  <Card
                    key={b.id}
                    className="rounded-3xl border-slate-100 overflow-hidden"
                  >
                    <CardContent className="p-6 flex justify-between items-center gap-4">
                      <div className="flex gap-4 items-center">
                        <div className="h-12 w-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shrink-0">
                          <CalendarDays className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900">
                            {b.workspaces?.name || "Meeting Room"}
                          </p>
                          <p className="text-xs text-slate-400 font-bold uppercase mt-0.5">
                            {format(
                              parseISO(b.start_date_time),
                              "EEE d MMM, h:mm a",
                            )}{" "}
                            →{" "}
                            {format(parseISO(b.end_date_time), "h:mm a")}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <Badge
                          className={`${statusColor(b.booking_status)} border-none px-4 py-1 rounded-full font-black text-[10px] uppercase`}
                        >
                          {b.booking_status}
                        </Badge>
                        {isCancellable && (
                          <CancelBookingButton
                            bookingId={b.id}
                            roomName={b.workspaces?.name || "Meeting Room"}
                            startDateTime={b.start_date_time}
                          />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
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
