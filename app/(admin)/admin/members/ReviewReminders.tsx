"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send, Star } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Eligible = { name: string | null; email: string };
const ENDPOINT = "/api/cron/review-reminder";

async function call(query = "") {
  const res = await fetch(`${ENDPOINT}${query}`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data as { eligible?: Eligible[]; message?: string };
}

const message = (err: unknown) => (err instanceof Error ? err.message : undefined);

/** Checks who's due a Google review request first, then sends only on confirmation. */
export function ReviewReminders() {
  const [open, setOpen] = useState(false);
  const [eligible, setEligible] = useState<Eligible[]>([]);
  const [checking, startCheck] = useTransition();
  const [sending, startSend] = useTransition();

  const check = () =>
    startCheck(async () => {
      try {
        const data = await call("?dryRun=true");
        setEligible(data.eligible ?? []);
        setOpen(true);
      } catch (err) {
        toast.error("Couldn’t check who’s due a reminder", { description: message(err) });
      }
    });

  const send = () =>
    startSend(async () => {
      try {
        const data = await call();
        toast.success("Review reminders sent", { description: data.message });
        setOpen(false);
      } catch (err) {
        toast.error("Couldn’t send the reminders", { description: message(err) });
      }
    });

  const count = eligible.length;
  return (
    <>
      <button type="button" className="hub-button hub-button-outline admin-reminders-button" onClick={check} disabled={checking}>
        {checking ? <Loader2 size={14} className="hub-spin" aria-hidden /> : <Star size={14} aria-hidden />}
        Review reminders
      </button>
      <AlertDialog open={open} onOpenChange={(next) => { if (!sending) setOpen(next); }}>
        <AlertDialogContent className="hub-dialog hub-cancel-dialog admin-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{count ? `Send ${count} review reminder${count === 1 ? "" : "s"}?` : "Nobody’s due a reminder"}</AlertDialogTitle>
            <AlertDialogDescription>
              {count
                ? "These active members haven’t been asked in the last 30 days. Each gets an email with a link to Inspire9’s Google reviews."
                : "Every active member has been asked in the last 30 days. Try again later."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {count > 0 && (
            <ul className="admin-reminder-list" aria-label="Members who will get a reminder">
              {eligible.map((m) => <li key={m.email}><strong>{m.name ?? "Member"}</strong><span>{m.email}</span></li>)}
            </ul>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="hub-button hub-button-outline" disabled={sending}>{count ? "Cancel" : "Close"}</AlertDialogCancel>
            {count > 0 && (
              <button type="button" className="hub-button hub-button-primary" onClick={send} disabled={sending}>
                {sending ? <><Loader2 size={14} className="hub-spin" aria-hidden />Sending…</> : <><Send size={14} aria-hidden />Send reminders</>}
              </button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
