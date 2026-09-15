"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Clock, Download, LifeBuoy, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getBookingById } from "@/app/(dashboard)/bookings/actions";
import { afterCheck, CHECK_INTERVAL_MS, describeBooking, successBookingId, type SuccessBooking, type SuccessState } from "./booking-success";

/**
 * Stripe returns members here with ?status=success&bookingId=…. The dialog opens
 * straight away and confirms in place. The query string only triggers a lookup
 * scoped to the signed-in owner, which is what actually confirms anything.
 */
export default function BookingSuccessModal() {
  const [state, setState] = useState<SuccessState>({ phase: "closed" });
  const bookingId = useRef<string | null>(undefined);
  const dismissed = useRef(false);

  useEffect(() => {
    // Read once: dev runs effects twice, and the first pass cleans the URL.
    if (bookingId.current === undefined) {
      bookingId.current = successBookingId(window.location.search);
      if (bookingId.current) window.history.replaceState(null, "", window.location.pathname);
    }
    const id = bookingId.current;
    if (!id) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = (attempt: number) => {
      getBookingById(id)
        .then((b) => b as SuccessBooking | null, () => "error" as const)
        .then((result) => {
          if (cancelled || dismissed.current) return;
          const next = afterCheck(result, attempt);
          setState(next.state);
          if (next.retry) timer = setTimeout(() => check(attempt + 1), CHECK_INTERVAL_MS);
        });
    };
    timer = setTimeout(() => {
      if (dismissed.current) return;
      setState({ phase: "confirming" });
      check(0);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <BookingSuccessDialog
      state={state}
      onClose={() => {
        dismissed.current = true;
        setState({ phase: "closed" });
      }}
    />
  );
}

const COPY = {
  confirming: { eyebrow: "Payment received", title: "Confirming your booking", mark: "…", body: "This usually takes a few seconds." },
  confirmed: { eyebrow: "Booking confirmed", title: "You’re booked", mark: ".", body: "" },
  processing: { eyebrow: "Payment received", title: "Almost there", mark: ".", body: "We’re still finishing your booking. It’ll appear in Bookings shortly." },
  attention: { eyebrow: "Needs attention", title: "We couldn’t confirm this booking", mark: ".", body: "Your payment may have gone through, but the booking wasn’t confirmed. Check Bookings, or get in touch and we’ll sort it out." },
};

export function BookingSuccessDialog({ state, onClose }: { state: SuccessState; onClose: () => void }) {
  const phase = state.phase === "closed" ? "confirming" : state.phase;
  const copy = COPY[phase];
  const view = state.phase === "confirmed" ? describeBooking(state.booking) : null;

  return (
    <Dialog open={state.phase !== "closed"} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="hub-dialog hub-success-dialog"
        overlayClassName="hub-booking-overlay"
        // Focus the dialog, not its first button: a ring on arrival reads as an error.
        onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement | null)?.focus(); }}
      >
        <div className="hub-success-top">
          <span className="hub-success-mark" data-phase={phase} aria-hidden="true">
            {phase === "confirmed" ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path className="hub-success-check" d="M5 12.5l4.5 4.5L19 7.5" pathLength={24} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : phase === "attention" ? <AlertCircle size={20} strokeWidth={1.8} />
              : phase === "processing" ? <Clock size={20} strokeWidth={1.8} />
              : <Loader2 size={20} strokeWidth={1.8} className="animate-spin" />}
          </span>
          <DialogHeader className="hub-success-header">
            <p className="hub-eyebrow">{copy.eyebrow}</p>
            <DialogTitle>{copy.title}<span className="hub-red">{copy.mark}</span></DialogTitle>
            <DialogDescription>
              {view ? `${view.room} is yours on ${view.weekday} ${view.day} ${view.monthLong}.` : copy.body}
            </DialogDescription>
          </DialogHeader>
        </div>

        {phase === "confirming" && (
          <div aria-hidden="true">
            <div className="hub-success-ticket">
              <span className="hub-success-skel hub-success-skel-tile" />
              <span className="hub-success-when">
                <span className="hub-success-skel" style={{ width: "46%" }} />
                <span className="hub-success-skel" style={{ width: "72%" }} />
              </span>
            </div>
            <div className="hub-success-receipt">
              <div><span className="hub-success-skel" style={{ width: "22%" }} /><span className="hub-success-skel" style={{ width: "26%" }} /></div>
              <div><span className="hub-success-skel" style={{ width: "30%" }} /><span className="hub-success-skel" style={{ width: "22%" }} /></div>
            </div>
          </div>
        )}

        {view && (
          <>
            <div className="hub-success-ticket">
              <div className="hub-date-tile"><span>{view.month}</span><strong>{view.day}</strong></div>
              <div className="hub-success-when">
                <strong>{view.room}</strong>
                <span>{view.timeRange}</span>
                <span>{view.duration}</span>
              </div>
              <span className="hub-status-badge" data-status="confirmed">Confirmed</span>
            </div>
            <dl className="hub-success-receipt">
              {view.amount && <div><dt>Paid</dt><dd>{view.amount}<small>AUD</small></dd></div>}
              <div><dt>Reference</dt><dd>{view.reference}</dd></div>
            </dl>
          </>
        )}

        <div className="hub-success-actions">
          {state.phase === "confirmed" ? (
            <>
              <a className="hub-button hub-button-outline" href={`/api/invoice/${state.booking.id}`} target="_blank" rel="noopener noreferrer">
                <Download size={15} />Invoice
              </a>
              <button className="hub-button hub-button-primary" onClick={onClose}>Done<ArrowRight size={15} /></button>
            </>
          ) : state.phase === "processing" ? (
            <>
              <Link className="hub-button hub-button-outline" href="/bookings" onClick={onClose}>View bookings</Link>
              <button className="hub-button hub-button-primary" onClick={onClose}>Got it</button>
            </>
          ) : state.phase === "attention" ? (
            <>
              <Link className="hub-button hub-button-outline" href="/support" onClick={onClose}><LifeBuoy size={15} />Get help</Link>
              <Link className="hub-button hub-button-primary" href="/bookings" onClick={onClose}>View bookings<ArrowRight size={15} /></Link>
            </>
          ) : (
            <>
              <button className="hub-button hub-button-outline" disabled><Download size={15} />Invoice</button>
              <button className="hub-button hub-button-primary" disabled>Done<ArrowRight size={15} /></button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
