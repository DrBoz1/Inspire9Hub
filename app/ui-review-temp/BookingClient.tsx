"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarDays, LayoutGrid, Clock, Search, ArrowUpRight, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cancelConfirmedBooking } from "./mocks";
import { getRefundPolicy } from "@/lib/refund-policy";
import { HUB_TIMEZONE } from "@/lib/datetime";
import { useHubClock } from "@/components/use-hub-clock";
import { toast } from "sonner";
import RoomCard, { type BookingRoom } from "./RoomCard";

type MemberBooking = { id: string; booking_status: string; start_date_time: string; end_date_time: string; workspaces: { name: string; capacity?: number } | null };
const dateText = (iso: string, options: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("en-AU", { timeZone: HUB_TIMEZONE, ...options });

function CancelBookingButton({ booking }: { booking: MemberBooking }) {
  const [pending, startTransition] = useTransition();
  const policy = getRefundPolicy(booking.start_date_time);
  return <AlertDialog><AlertDialogTrigger asChild><button className="hub-cancel-link" disabled={pending}><XCircle size={14} />{pending ? "Cancelling…" : "Cancel"}</button></AlertDialogTrigger>
    <AlertDialogContent className="hub-dialog hub-cancel-dialog">
      <AlertDialogHeader><AlertDialogTitle>Cancel your booking?</AlertDialogTitle><AlertDialogDescription asChild><div><p>This will release your reservation for <strong>{booking.workspaces?.name ?? "this room"}</strong>.</p><span className="hub-status-badge" data-status="pending">{policy.label}</span><p>{policy.description}</p></div></AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel className="hub-button hub-button-outline">Keep booking</AlertDialogCancel><AlertDialogAction className="hub-button hub-button-primary" onClick={() => startTransition(async () => {
        try {
          const result = await cancelConfirmedBooking(booking.id);
          if (result?.success) toast.success("Booking cancelled", { description: "View Activity for your payment and refund status." });
          else toast.error("Couldn't cancel", { description: result?.error ?? "Please try again." });
        } catch { toast.error("Couldn't cancel", { description: "Check your connection and try again." }); }
      })}>Cancel booking</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

export default function BookingClient({ initialBookings, rooms }: { initialBookings: MemberBooking[]; rooms: BookingRoom[] }) {
  const [tab, setTab] = useState("available");
  const [query, setQuery] = useState("");
  const [capacity, setCapacity] = useState("all");
  const [period, setPeriod] = useState("upcoming");
  const now = useHubClock();
  const upcoming = initialBookings.filter(b => b.booking_status !== "cancelled" && (!now || new Date(b.end_date_time) > now));
  const past = initialBookings.filter(b => b.booking_status !== "cancelled" && now && new Date(b.end_date_time) <= now).toReversed();
  const schedule = period === "upcoming" ? upcoming : past;
  const visibleRooms = rooms.filter(room => (!query.trim() || `${room.name} ${room.location ?? ""} ${room.amenities?.join(" ") ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())) && (capacity === "all" || room.capacity >= Number(capacity)));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") !== "cancelled") return;
    params.delete("status"); params.delete("bookingId");
    window.history.replaceState({}, "", window.location.pathname + (params.size ? `?${params}` : ""));
    toast("Checkout cancelled", { description: "Your checkout has been cancelled. You can choose another time when you're ready." });
  }, []);

  return <Tabs value={tab} onValueChange={setTab}>
    <TabsList className="hub-tabs"><TabsTrigger value="available"><LayoutGrid size={16} />Browse rooms<span>{rooms.length}</span></TabsTrigger><TabsTrigger value="my-bookings"><CalendarDays size={16} />My schedule<span>{upcoming.length}</span></TabsTrigger></TabsList>
    <TabsContent value="available" className="hub-tab-content">
      <div className="hub-browse-tools"><label className="hub-search"><Search size={16} /><input aria-label="Search rooms" placeholder="Find a room, feature or location…" value={query} onChange={e => setQuery(e.target.value)} />{query && <button onClick={() => setQuery("")} aria-label="Clear search">×</button>}</label>
        <label className="hub-capacity">Room for<select value={capacity} onChange={e => setCapacity(e.target.value)} aria-label="Minimum room capacity"><option value="all">Any group</option><option value="4">4+ people</option><option value="6">6+ people</option><option value="8">8+ people</option><option value="12">12+ people</option></select></label>
        <span className="hub-record-note" aria-live="polite">{visibleRooms.length} {visibleRooms.length === 1 ? "space" : "spaces"}</span>
      </div>
      {visibleRooms.length ? <div className="hub-room-grid">{visibleRooms.map(room => <RoomCard key={room.id} room={room} />)}</div> : <div className="hub-empty-state hub-surface"><Search size={26} /><h3>{rooms.length ? "A little too specific?" : "No rooms to show just yet."}</h3><p>{rooms.length ? "Try another room name or a smaller group." : "The team can help you find a space."}</p>{rooms.length ? <button className="hub-button hub-button-outline" onClick={() => { setQuery(""); setCapacity("all"); }}>Clear filters</button> : <Link href="/support" className="hub-text-link">Contact the team<ArrowUpRight size={14} /></Link>}</div>}
    </TabsContent>
    <TabsContent value="my-bookings" className="hub-tab-content">
      <section className="hub-record-panel hub-surface"><div className="hub-record-heading"><div><p className="hub-eyebrow">Time well spent</p><h2>Your schedule</h2></div><div className="hub-segmented" aria-label="Schedule period">{["upcoming", "past"].map(value => <button key={value} data-active={period === value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{value === "upcoming" ? "Upcoming" : "Past"}</button>)}</div></div>
        <div className="hub-schedule-note"><Clock size={13} />All times are local to Inspire9, Melbourne.<Link href="/history?tab=bookings">All booking records<ArrowUpRight size={13} /></Link></div>
        {schedule.length ? schedule.map(b => <article className="hub-record-row hub-schedule-row" key={b.id}>
          <div className="hub-date-tile"><span>{dateText(b.start_date_time, { month: "short" })}</span><strong>{dateText(b.start_date_time, { day: "2-digit" })}</strong></div>
          <div className="hub-record-copy"><h3>{b.workspaces?.name ?? "Meeting room"}</h3><p>{dateText(b.start_date_time, { weekday: "long", day: "numeric", month: "long" })}</p><span>{dateText(b.start_date_time, { hour: "numeric", minute: "2-digit" })} – {dateText(b.end_date_time, { hour: "numeric", minute: "2-digit" })}</span></div>
          <div className="hub-schedule-actions"><span className="hub-status-badge" data-status={b.booking_status}>{b.booking_status}</span>{now && new Date(b.start_date_time) > now && <CancelBookingButton booking={b} />}</div>
        </article>) : <div className="hub-empty-state"><CalendarDays size={28} strokeWidth={1.3} /><h3>{period === "upcoming" ? "A little room in your calendar." : "Your meetings will live here."}</h3><p>{period === "upcoming" ? "Find a space for your next conversation." : "Completed reservations appear in your past schedule."}</p><button className="hub-button hub-button-outline" onClick={() => setTab("available")}>Find your space<ArrowUpRight size={15} /></button></div>}
      </section>
    </TabsContent>
  </Tabs>;
}
