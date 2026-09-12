"use client";

import { ArrowRight, ArrowUpRight, AlertCircle, ShieldCheck, Megaphone, CalendarDays, Wrench, AlertTriangle, Clock, Bell, BookOpen, MapPin, Check, LifeBuoy } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import { getAnnouncementType } from "@/lib/announcement-types";
import { MEMBER_STATUS } from "@/lib/constants";
import BookingSuccessModal from "./BookingSuccessModal";
import { useHubClock } from "@/components/use-hub-clock";

type AnnouncementRow = { id: string; title: string; message: string; type: string; created_at: string };
type HistoryRow = { id: string; entry_type: string; entry_description?: string | null; added_date?: string | null; entry_date?: string | null; tags?: string | null };
type NextBookingRow = { workspaces: { name: string } | { name: string }[] | null; start_date_time: string } | null;
export type DashboardClientProps = {
  firstName: string; memberStatus: string; isInducted: boolean; isSubmitted: boolean; isAdmin: boolean;
  nextBooking: NextBookingRow; announcements: AnnouncementRow[]; history: HistoryRow[];
};
const ANNOUNCEMENT_ICONS = { general: Megaphone, event: CalendarDays, maintenance: Wrench, alert: AlertTriangle, hours: Clock, reminder: Bell };

function workspaceName(w: { name: string } | { name: string }[] | null) {
  return (Array.isArray(w) ? w[0] : w)?.name ?? "Meeting room";
}

export default function DashboardClient({ firstName, memberStatus, isInducted, isSubmitted, isAdmin, nextBooking, announcements, history }: DashboardClientProps) {
  const now = useHubClock();
  const today = now?.toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne", weekday: "long", day: "numeric", month: "long" });
  const isActive = memberStatus === MEMBER_STATUS.ACTIVE;
  const bookingDate = nextBooking ? new Date(nextBooking.start_date_time) : null;

  return <div className="hub-dashboard">
    <BookingSuccessModal />
    <div className="hub-page-heading">
      <div><p className="hub-eyebrow">A place to belong</p><h1>Welcome back, {firstName}<span className="hub-red">.</span></h1><p>Your day at Inspire9, all in one place.</p></div>
      <div className="hub-heading-meta"><span>{today}</span>{isAdmin && <Link href="/admin/approvals" className="hub-text-link"><ShieldCheck size={15} /> Admin portal <ArrowUpRight size={14} /></Link>}</div>
    </div>

    {!isInducted && <div className="hub-induction-notice" role="status">
      <span className="hub-notice-icon"><AlertCircle size={20} /></span>
      <div><strong>{isSubmitted ? "Your induction is being reviewed" : "Make yourself at home"}</strong><p>{isSubmitted ? "The team will review your induction and update your access." : "Complete your induction to get ready for life at the hub."}</p></div>
      {!isSubmitted && <Link href="/induction" className="hub-text-link">Start induction <ArrowRight size={16} /></Link>}
    </div>}

    <div className="hub-feature-grid">
      <section className="hub-hero">
        <Image src="/images/login-side.jpg" alt="Members working together around a shared table at Inspire9" fill sizes="(max-width: 900px) 100vw, 65vw" priority className="hub-hero-photo" />
        <div className="hub-hero-shade" />
        <div className="hub-hero-content">
          <span className="hub-hero-location"><MapPin size={13} /> INSPIRE9 · LEVEL 1</span>
          <div><h2>A little space.<br /><em>A lot of possibility.</em></h2><p>Find a quiet corner, bring the team together,<br className="hidden sm:block" /> or settle into your next big idea.</p></div>
          <Link href="/spaces" className="hub-button hub-button-light">Find your space <ArrowUpRight size={17} /></Link>
        </div>
        <span className="hub-hero-index" aria-hidden>01 / THE WORKSPACE</span>
      </section>

      <section className="hub-next-booking hub-surface">
        <div className="hub-section-top"><span className="hub-eyebrow">On your calendar</span><CalendarDays size={19} /></div>
        {nextBooking && bookingDate ? <>
          <div className="hub-booking-date"><span>{bookingDate.toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne", month: "short" })}</span><strong>{bookingDate.toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne", day: "2-digit" })}</strong></div>
          <div className="hub-next-copy"><span className="hub-eyebrow">Your next booking</span><h2>{workspaceName(nextBooking.workspaces)}</h2><p><Clock size={14} />{bookingDate.toLocaleString("en-AU", { timeZone: "Australia/Melbourne", weekday: "short", hour: "numeric", minute: "2-digit" })}</p></div>
          <Link href="/bookings" className="hub-booking-link">View bookings <ArrowUpRight size={18} /></Link>
        </> : <>
          <div className="hub-empty-calendar" aria-hidden><span /><CalendarDays size={38} strokeWidth={1} /></div>
          <div className="hub-next-copy"><h2>A little room<br />in your calendar.</h2><p>No upcoming reservations.<br />Let&apos;s make space for something good.</p></div>
          <Link href="/bookings" className="hub-booking-link">Book a space <ArrowUpRight size={18} /></Link>
        </>}
      </section>
    </div>

    <div className="hub-membership-strip hub-surface">
      <Link href="/profile" className="hub-membership-item"><span className="hub-strip-icon"><UserMark /></span><div><span className="hub-eyebrow">Your membership</span><strong><i className="hub-status-dot" data-active={isActive} />{memberStatus} member</strong></div><ArrowUpRight size={16} /></Link>
      <Link href={isInducted || isSubmitted ? "/profile" : "/induction"} className="hub-membership-item"><span className="hub-strip-icon">{isInducted ? <ShieldCheck size={20} /> : <BookOpen size={20} />}</span><div><span className="hub-eyebrow">Hub induction</span><strong>{isInducted ? "You're all set" : isSubmitted ? "Under review" : "Let's get you settled"}{isInducted && <Check size={14} className="hub-green" />}</strong></div><ArrowUpRight size={16} /></Link>
      <Link href="/support" className="hub-membership-item"><span className="hub-strip-icon"><LifeBuoy size={20} /></span><div><span className="hub-eyebrow">Here for you</span><strong>A helping hand</strong></div><ArrowUpRight size={16} /></Link>
    </div>

    <div className="hub-feed-grid">
      <section className="hub-feed hub-surface">
        <div className="hub-feed-heading"><div><p className="hub-eyebrow">Your hub, lately</p><h2>Recent activity</h2></div><Link href="/history" className="hub-text-link">View all <ArrowUpRight size={15} /></Link></div>
        {history.length ? <div className="hub-activity-list">{history.map(entry => {
          const Icon = entry.entry_type === "Room Booking" ? CalendarDays : entry.entry_type === "Induction" ? BookOpen : Bell;
          return <div key={entry.id} className="hub-activity-item"><span className="hub-activity-icon" data-tone={entry.tags === "Approved" ? "green" : entry.tags === "Rejected" ? "red" : "neutral"}><Icon size={17} /></span><div><strong>{entry.entry_type}</strong><p>{entry.entry_description ?? "Your hub activity has been updated."}</p></div><time>{entry.added_date ? format(parseISO(entry.added_date), "d MMM") : entry.entry_date ?? "—"}</time></div>;
        })}</div> : <div className="hub-feed-empty"><Clock size={24} strokeWidth={1.3} /><h3>Your story starts here.</h3><p>Your bookings and hub updates will appear here.</p><Link href="/spaces" className="hub-text-link">Explore the hub <ArrowRight size={14} /></Link></div>}
      </section>
      <section className="hub-feed hub-surface">
        <div className="hub-feed-heading"><div><p className="hub-eyebrow">From the community</p><h2>The noticeboard</h2></div><Megaphone size={19} /></div>
        {announcements.length ? <div className="hub-announcements">{announcements.map(a => {
          const kind = getAnnouncementType(a.type);
          const Icon = ANNOUNCEMENT_ICONS[a.type as keyof typeof ANNOUNCEMENT_ICONS] ?? Megaphone;
          return <article key={a.id} className="hub-announcement"><div className="hub-announcement-meta"><span><Icon size={13} />{kind.label}</span><time>{format(parseISO(a.created_at), "d MMM")}</time></div><h3>{a.title}</h3><p>{a.message}</p></article>;
        })}</div> : <div className="hub-feed-empty"><Megaphone size={24} strokeWidth={1.3} /><h3>All quiet for now.</h3><p>News, events and updates from the Inspire9 team will find a home here.</p></div>}
      </section>
    </div>
    <footer className="hub-dashboard-footer"><span>Good people. Great things.</span><span>Inspire9 · Member hub</span></footer>
  </div>;
}

function UserMark() { return <span className="hub-member-mark" aria-hidden>i9</span>; }
