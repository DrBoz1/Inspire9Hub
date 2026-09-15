"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertCircle, Check, CheckCircle2, HeartPulse, Loader2, X } from "lucide-react";
import { approveInduction, rejectInduction } from "@/app/(admin)/actions";
import { AdminConfirm } from "@/components/admin/AdminConfirm";
import { formatDateOnly, initialsOf } from "@/lib/member-forms";
import { waitingDays, waitingLabel } from "@/lib/admin-dashboard";
import type { ReviewItem } from "@/lib/admin-compliance";

export function ReviewQueue({ items, todayKey }: { items: ReviewItem[]; todayKey: string }) {
  return (
    <ul className="admin-review-grid" aria-label="Inductions waiting for review">
      {items.map((item) => (
        <li key={item.id}><ReviewCard item={item} todayKey={todayKey} /></li>
      ))}
    </ul>
  );
}

function ReviewCard({ item, todayKey }: { item: ReviewItem; todayKey: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const days = waitingDays(item.submittedOn, todayKey);
  const firstName = item.name.split(" ")[0];

  const approve = () =>
    startTransition(async () => {
      setError(null);
      const result = await approveInduction(item.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(`${item.name} is approved`, { description: "We’ve let them know by email." });
    });

  return (
    <article className="hub-surface admin-review-card" aria-labelledby={`review-${item.id}`} aria-busy={pending}>
      <header className="admin-review-head">
        <span className="admin-initials" aria-hidden>{initialsOf(item.name)}</span>
        <div className="admin-review-who">
          <h2 id={`review-${item.id}`}>{item.name}</h2>
          <p>{item.company ?? "No company given"}</p>
        </div>
        <span className="admin-wait" data-urgent={days !== null && days >= 3 ? true : undefined}>
          <span className="sr-only">Waiting </span>{waitingLabel(days)}
        </span>
      </header>

      <dl className="admin-review-facts">
        <div><dt>Email</dt><dd>{item.email ? <a href={`mailto:${item.email}`}>{item.email}</a> : "Not given"}</dd></div>
        <div><dt>Mobile</dt><dd>{item.mobile ? <a href={`tel:${item.mobile.replace(/[^\d+]/g, "")}`}>{item.mobile}</a> : "Not given"}</dd></div>
        <div><dt>Submitted</dt><dd>{formatDateOnly(item.submittedOn) ?? "Unknown"}</dd></div>
        <div>
          <dt>House guide</dt>
          <dd className="admin-review-ack" data-ok={item.acknowledged || undefined}>
            {item.acknowledged ? <><Check size={12} aria-hidden />Acknowledged</> : <><AlertCircle size={12} aria-hidden />Not acknowledged</>}
          </dd>
        </div>
      </dl>

      <div className="admin-review-note">
        <p className="admin-review-note-label"><HeartPulse size={12} aria-hidden />Emergency contact and medical details</p>
        <p>{item.emergency ?? "Nothing provided."}</p>
      </div>

      {error && <p className="hub-inline-error admin-review-error" role="alert">{error}</p>}

      <footer className="admin-review-foot">
        <AdminConfirm
          trigger={<button type="button" className="hub-button hub-button-outline" disabled={pending}><X size={14} aria-hidden />Reject</button>}
          title={`Reject ${firstName}’s induction?`}
          description="They’ll be emailed to complete it again and won’t have access until it’s approved. What they sent stays in the history."
          confirmLabel="Reject induction"
          pendingLabel="Rejecting…"
          onConfirm={async () => {
            const result = await rejectInduction(item.id);
            if (result.error) return { error: result.error };
            toast(`${item.name}’s induction was rejected`, { description: "They’ve been asked to complete it again." });
          }}
        />
        <button type="button" className="hub-button hub-button-primary" onClick={approve} disabled={pending}>
          {pending ? <><Loader2 size={14} className="hub-spin" aria-hidden />Approving…</> : <><CheckCircle2 size={14} aria-hidden />Approve</>}
        </button>
      </footer>
    </article>
  );
}
