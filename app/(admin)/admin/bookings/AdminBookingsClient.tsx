"use client";

import { useTransition } from "react";
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
import { XCircle, AlertTriangle, RotateCcw } from "lucide-react";
import { cancelBookingAsAdmin, issueRefund } from "./actions";
import { getRefundPolicy } from "@/lib/refund-policy";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

function statusColor(status: string) {
  switch (status?.toLowerCase()) {
    case "confirmed": return "bg-emerald-50 text-emerald-700";
    case "pending":   return "bg-amber-50 text-amber-700";
    case "cancelled": return "bg-red-50 text-red-600";
    case "completed": return "bg-blue-50 text-blue-600";
    default:          return "bg-slate-100 text-slate-600";
  }
}

function CancelButton({ bookingId, label }: { bookingId: string; label: string }) {
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelBookingAsAdmin(bookingId);
      if (result?.success) {
        toast.success("Booking Cancelled", { description: `${label} has been cancelled.` });
      } else {
        toast.error("Failed", { description: result?.error ?? "Unknown error." });
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
          className="text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl font-black text-xs uppercase tracking-wider"
        >
          <XCircle className="w-4 h-4 mr-1" /> Cancel
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-[32px] border-none shadow-2xl p-10">
        <AlertDialogHeader>
          <div className="h-12 w-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <AlertDialogTitle className="text-2xl font-black uppercase">
            Cancel Booking?
          </AlertDialogTitle>
          <AlertDialogDescription className="font-medium text-slate-500">
            This cancels{" "}
            <span className="font-bold text-slate-900">{label}</span>. Use the
            Refund button afterward to return the member's payment.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6">
          <AlertDialogCancel className="rounded-xl font-bold">Keep It</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-widest"
          >
            Confirm Cancel
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RefundButton({
  bookingId,
  label,
  startDateTime,
}: {
  bookingId: string;
  label: string;
  startDateTime: string;
}) {
  const [isPending, startTransition] = useTransition();
  const policy = getRefundPolicy(startDateTime);

  const handleRefund = () => {
    startTransition(async () => {
      const result = await issueRefund(bookingId);
      if (result?.success) {
        toast.success("Refund Issued", {
          description: `${policy.label} processed via Stripe for ${label}.`,
        });
      } else {
        toast.error("Refund Failed", { description: result?.error ?? "Unknown error." });
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
          className="text-slate-300 hover:text-violet-600 hover:bg-violet-50 rounded-xl font-black text-xs uppercase tracking-wider"
        >
          <RotateCcw className="w-4 h-4 mr-1" /> Refund
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-[32px] border-none shadow-2xl p-10">
        <AlertDialogHeader>
          <div className="h-12 w-12 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-600 mb-4">
            <RotateCcw className="w-6 h-6" />
          </div>
          <AlertDialogTitle className="text-2xl font-black uppercase">
            Issue Refund?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 mt-1">
              <p className="font-medium text-slate-500">
                Refund for{" "}
                <span className="font-bold text-slate-900">{label}</span>.
                This action cannot be undone.
              </p>
              <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider ${policy.color}`}>
                {policy.label}
              </div>
              <p className="text-xs text-slate-400 font-medium">
                {policy.description}
              </p>
              {policy.percent === 0 && (
                <p className="text-xs text-amber-600 font-bold">
                  Policy says no refund. Proceeding will return nothing — use
                  the Stripe Dashboard to override.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6">
          <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRefund}
            disabled={policy.percent === 0}
            className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-black uppercase tracking-widest disabled:opacity-40"
          >
            Confirm Refund
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function AdminBookingsClient({
  bookings,
  refundableIds,
}: {
  bookings: any[];
  refundableIds: string[];
}) {
  const refundableSet = new Set(refundableIds);

  return (
    <div className="divide-y divide-slate-50">
      {bookings.length === 0 ? (
        <p className="text-slate-400 italic text-sm font-medium p-8">
          No bookings found.
        </p>
      ) : (
        bookings.map((b) => {
          const isPast = new Date(b.start_date_time) <= new Date();
          const canCancel = b.booking_status !== "cancelled" && !isPast;
          const canRefund =
            b.booking_status === "cancelled" && refundableSet.has(b.id);
          const label = `${b.members?.full_name ?? "Member"} — ${b.workspaces?.name ?? "Room"}`;

          return (
            <div
              key={b.id}
              className="flex items-center justify-between px-8 py-5 hover:bg-slate-50/30 transition-colors group"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-black text-slate-900 group-hover:text-[#E31E24] transition-colors">
                  {b.workspaces?.name ?? "Room"}
                </span>
                <span className="text-[11px] text-slate-400 font-bold mt-0.5">
                  {b.members?.full_name ?? "—"} · {b.members?.email ?? ""}
                </span>
                <span className="text-[11px] text-slate-500 font-bold mt-1">
                  {format(parseISO(b.start_date_time), "EEE d MMM yyyy, h:mm a")}{" "}
                  → {format(parseISO(b.end_date_time), "h:mm a")}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  className={`${statusColor(b.booking_status)} border-none px-3 py-1 rounded-full font-black text-[10px] uppercase`}
                >
                  {b.booking_status}
                </Badge>
                {canCancel && <CancelButton bookingId={b.id} label={label} />}
                {canRefund && <RefundButton bookingId={b.id} label={label} startDateTime={b.start_date_time} />}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
