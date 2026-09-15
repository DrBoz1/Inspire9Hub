"use client";

import { toast } from "sonner";
import { Ban, RotateCcw, X } from "lucide-react";
import { AdminConfirm } from "@/components/admin/AdminConfirm";
import { formatLongDay, formatRange } from "@/lib/admin-dashboard";
import { formatMoney, refundQuote, type ScheduleRow, type scheduleActions } from "@/lib/admin-bookings";
import { cancelAndRefundBooking, cancelBookingAsAdmin, issueRefund } from "./actions";

type Allowed = ReturnType<typeof scheduleActions>;

export function BookingActions({ row, allowed }: { row: ScheduleRow; allowed: Allowed }) {
  const what = `${row.member}’s ${row.room} booking`;
  const when = `${formatLongDay(new Date(row.start))}, ${formatRange(row.start, row.end)}`;

  return (
    <div className="admin-booking-actions">
      {allowed.cancel && (
        <AdminConfirm
          trigger={<button type="button" className="hub-button hub-button-outline" aria-label={`Cancel ${what}`}><X size={13} aria-hidden />Cancel</button>}
          title="Cancel this booking?"
          description={<>This cancels {what} on {when}.{allowed.cancelAndRefund ? " They keep their payment until you refund it." : ""}</>}
          confirmLabel="Cancel booking"
          pendingLabel="Cancelling…"
          cancelLabel="Keep it"
          onConfirm={async () => {
            const result = await cancelBookingAsAdmin(row.id);
            if (!result.success) return { error: result.error ?? "Couldn’t cancel this booking." };
            toast.success("Booking cancelled", { description: what });
          }}
        />
      )}

      {allowed.cancelAndRefund && (
        <AdminConfirm
          trigger={<button type="button" className="hub-button hub-button-primary" aria-label={`Cancel and refund ${what}`}><Ban size={13} aria-hidden />Cancel &amp; refund</button>}
          title="Cancel and refund in full?"
          description={<>This cancels {what} on {when} and returns the full {formatMoney(row.payment.amount)} through Stripe. Use it when the hub is the one cancelling.</>}
          confirmLabel={`Cancel and refund ${formatMoney(row.payment.amount)}`}
          pendingLabel="Cancelling and refunding…"
          cancelLabel="Keep it"
          onConfirm={async () => {
            const result = await cancelAndRefundBooking(row.id);
            if (!result.success) return { error: result.error ?? "Couldn’t cancel this booking." };
            if (result.refunded) toast.success("Cancelled and refunded", { description: result.message ?? `${formatMoney(row.payment.amount)} is on its way back to ${row.member}.` });
            else toast.warning("Cancelled, but not refunded", { description: result.error ?? result.message });
          }}
        />
      )}

      {allowed.refund && <RefundButton row={row} what={what} />}
      {allowed.refundOffline && <span className="admin-booking-note">Refund in Stripe</span>}
    </div>
  );
}

function RefundButton({ row, what }: { row: ScheduleRow; what: string }) {
  // Only rendered inside the open dialog, so the "as of now" quote never differs between server and browser.
  const quote = refundQuote(row);
  const due = quote.percent > 0;
  return (
    <AdminConfirm
      trigger={<button type="button" className="hub-button hub-button-outline" aria-label={`Refund ${what}`}><RotateCcw size={13} aria-hidden />Refund</button>}
      title={due ? `Refund ${formatMoney(quote.cents / 100)}?` : "No refund is due"}
      description={
        due
          ? <>{quote.description} That’s {quote.percent}% of the {formatMoney(row.payment.amount)} {row.member} paid, returned through Stripe.</>
          : <>{quote.description} To refund anyway, use the Stripe Dashboard.</>
      }
      confirmLabel={due ? `Refund ${formatMoney(quote.cents / 100)}` : "Nothing to refund"}
      confirmDisabled={!due}
      pendingLabel="Refunding…"
      onConfirm={async () => {
        const result = await issueRefund(row.id);
        if (!result.success) return { error: result.error ?? "Couldn’t issue the refund." };
        toast.success("Refund issued", { description: result.message });
      }}
    />
  );
}
