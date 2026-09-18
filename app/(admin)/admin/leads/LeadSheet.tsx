"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertCircle, Check, Loader2, Mail, MessageSquareText, Phone, PhoneCall, Footprints, Send, StickyNote, UserCheck, ArrowRightLeft, Inbox } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { initialsOf } from "@/lib/member-forms";
import {
  HEARD_VIA,
  INTERESTS,
  LOGGABLE_KINDS,
  LOST_REASONS,
  NOTE_KINDS,
  PIPELINE,
  SOURCES,
  STAGE_LABELS,
  STAGE_TONES,
  dayLabel,
  followUpState,
  whenLabel,
  type Lead,
  type LeadNote,
  type LeadStage,
  type NoteKind,
} from "@/lib/admin-leads";
import type { LeadUpdate } from "./actions";
import type { StaffOption } from "./leads-data";

export type LeadActions = {
  timeline: (id: string) => Promise<{ error: string } | { notes: LeadNote[] }>;
  move: (id: string, to: LeadStage, lostReason?: string) => Promise<LeadUpdate>;
  note: (id: string, kind: string, body: string) => Promise<LeadUpdate>;
  details: (id: string, details: { ownerId: string | null; nextFollowUp: string | null }) => Promise<LeadUpdate>;
  convert: (id: string) => Promise<LeadUpdate & { linked?: string | null }>;
};

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; notes: LeadNote[] };

const NOTE_ICONS: Record<NoteKind, typeof StickyNote> = { note: StickyNote, call: PhoneCall, email: Send, tour: Footprints, stage: ArrowRightLeft, enquiry: Inbox };
export const FOLLOW_LABELS = { overdue: "Follow-up overdue", today: "Follow up today", soon: "Follow-up soon", later: "Follow-up booked", none: null } as const;

export function LeadSheet({
  lead,
  staff,
  today,
  now,
  actions,
  onSaved,
  onClose,
}: {
  lead: Lead;
  staff: StaffOption[];
  today: string;
  now: Date;
  actions: LeadActions;
  onSaved: (lead: Lead) => void;
  onClose: () => void;
}) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [losing, setLosing] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [owner, setOwner] = useState(lead.ownerId ?? "");
  const [follow, setFollow] = useState(lead.nextFollowUp ?? "");
  const [kind, setKind] = useState<NoteKind>("note");
  const [body, setBody] = useState("");

  useEffect(() => {
    let cancelled = false;
    actions.timeline(lead.id).then(
      (result) => { if (!cancelled) setLoad("error" in result ? { status: "error", message: result.error } : { status: "ready", notes: result.notes }); },
      () => { if (!cancelled) setLoad({ status: "error", message: "Couldn’t reach the server. Please try again." }); },
    );
    return () => { cancelled = true; };
  }, [lead.id, attempt, actions]);

  /** Runs one action, keeps the lead and its timeline in step, and says what happened. */
  function run(label: string, work: () => Promise<LeadUpdate & { linked?: string | null }>, done?: (result: { saved: Lead; note: LeadNote | null; linked?: string | null }) => void) {
    setBusy(label);
    setError(null);
    startTransition(async () => {
      try {
        const result = await work();
        if ("error" in result) {
          setError(result.error);
          return;
        }
        onSaved(result.saved);
        if (result.note) setLoad((current) => (current.status === "ready" ? { status: "ready", notes: [result.note!, ...current.notes] } : current));
        done?.(result);
      } catch {
        setError("Couldn’t reach the server. Please try again.");
      } finally {
        setBusy(null);
      }
    });
  }

  const move = (to: LeadStage) => {
    if (to === "won") {
      run("won", () => actions.convert(lead.id), (r) =>
        toast.success(r.linked ? `Won, and linked to ${r.linked === "their" ? "their" : `${r.linked}’s`} account` : "Marked as won", {
          description: r.linked ? undefined : "No member account uses this email yet. Link it once they’ve signed up.",
        }),
      );
      return;
    }
    if (to === "lost") return setLosing(true);
    run(to, () => actions.move(lead.id, to), () => toast.success(`Moved to ${STAGE_LABELS[to]}`));
  };

  const confirmLost = () =>
    run("lost", () => actions.move(lead.id, "lost", lostReason), () => {
      setLosing(false);
      setLostReason("");
      toast.success("Marked as lost");
    });

  const detailsChanged = owner !== (lead.ownerId ?? "") || follow !== (lead.nextFollowUp ?? "");
  const saveDetails = () => run("details", () => actions.details(lead.id, { ownerId: owner || null, nextFollowUp: follow || null }), () => toast.success("Saved"));
  const logNote = (e: React.FormEvent) => {
    e.preventDefault();
    run("note", () => actions.note(lead.id, kind, body), () => {
      setBody("");
      toast.success(`${NOTE_KINDS[kind]} logged`);
    });
  };

  const follows = followUpState(lead, now);
  const ownerName = staff.find((s) => s.id === lead.ownerId)?.name;
  const current = PIPELINE.indexOf(lead.stage as (typeof PIPELINE)[number]);

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="hub-dialog admin-member-sheet admin-lead-sheet">
        <header className="admin-member-head">
          <span className="admin-member-avatar" aria-hidden>{initialsOf(lead.name)}</span>
          <SheetTitle>{lead.name}</SheetTitle>
          <SheetDescription>{[lead.company, INTERESTS[lead.interest], lead.teamSize ? `team of ${lead.teamSize}` : null].filter(Boolean).join(" · ")}</SheetDescription>
          <div className="admin-member-badges">
            <span className="hub-status-badge" data-status={STAGE_TONES[lead.stage]}>{STAGE_LABELS[lead.stage]}{lead.stage === "lost" && lead.lostReason ? `: ${LOST_REASONS[lead.lostReason].toLowerCase()}` : ""}</span>
            {FOLLOW_LABELS[follows] && <span className="admin-follow" data-state={follows}>{FOLLOW_LABELS[follows]}{lead.nextFollowUp && follows !== "today" ? `, ${dayLabel(lead.nextFollowUp)}` : ""}</span>}
          </div>
          <div className="admin-member-contact">
            <a className="hub-button hub-button-outline" href={`mailto:${lead.email}`}><Mail size={13} aria-hidden />Email</a>
            {lead.phone && <a className="hub-button hub-button-outline" href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}><Phone size={13} aria-hidden />Call</a>}
          </div>
        </header>

        <div className="admin-lead-body">
          {error && <p className="hub-inline-error" role="alert"><AlertCircle size={14} aria-hidden /><span>{error}</span></p>}

          <section className="admin-member-section" aria-labelledby="lead-stage-title">
            <h3 id="lead-stage-title">Where it’s at</h3>
            <div className="admin-lead-steps" role="group" aria-label="Move this lead">
              {PIPELINE.map((stage, i) => {
                const on = lead.stage === stage;
                const passed = lead.stage !== "lost" ? i < current : PIPELINE.indexOf(lead.furthestStage) >= i;
                return (
                  // The current stage isn't disabled: disabled buttons fade, and this one should read as chosen.
                  <button key={stage} type="button" aria-pressed={on} data-passed={passed || undefined} disabled={pending && !on} onClick={() => { if (!on && !pending) move(stage); }}>
                    {busy === stage ? <Loader2 size={12} className="hub-spin" aria-hidden /> : passed ? <Check size={12} aria-hidden /> : <i aria-hidden>{i + 1}</i>}
                    {STAGE_LABELS[stage]}
                  </button>
                );
              })}
              <button type="button" className="admin-lead-lost" aria-pressed={lead.stage === "lost"} disabled={pending && lead.stage !== "lost"} onClick={() => { if (lead.stage !== "lost" && !pending) move("lost"); }}>Lost</button>
            </div>
            {losing && (
              <div className="admin-lead-losing">
                <label htmlFor="lead-lost-reason" className="admin-form-label">Why was it lost?</label>
                <div className="admin-lead-inline">
                  <select id="lead-lost-reason" className="admin-text-input" value={lostReason} onChange={(e) => setLostReason(e.target.value)} autoFocus>
                    <option value="" disabled>Choose a reason</option>
                    {Object.entries(LOST_REASONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                  <button type="button" className="hub-button hub-button-primary" disabled={!lostReason || pending} onClick={confirmLost}>
                    {busy === "lost" ? <Loader2 size={13} className="hub-spin" aria-hidden /> : null}Mark lost
                  </button>
                  <button type="button" className="hub-button hub-button-outline" disabled={pending} onClick={() => setLosing(false)}>Cancel</button>
                </div>
              </div>
            )}
            {lead.stage === "won" && !lead.memberId && (
              <p className="admin-form-hint admin-lead-link">
                Not linked to a member account yet.{" "}
                <button type="button" className="hub-text-link" disabled={pending} onClick={() => move("won")}>
                  <UserCheck size={13} aria-hidden />Look again
                </button>
              </p>
            )}
          </section>

          <section className="admin-member-section" aria-labelledby="lead-owner-title">
            <h3 id="lead-owner-title">Looking after it</h3>
            <div className="admin-lead-grid">
              <div className="admin-announce-field">
                <label htmlFor="lead-owner" className="admin-form-label">Who</label>
                <select id="lead-owner" className="admin-text-input" value={owner} onChange={(e) => setOwner(e.target.value)}>
                  <option value="">Nobody yet</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="admin-announce-field">
                <label htmlFor="lead-follow" className="admin-form-label">Follow up on</label>
                <input id="lead-follow" type="date" min={lead.nextFollowUp && lead.nextFollowUp < today ? lead.nextFollowUp : today} className="admin-text-input admin-date-input" value={follow} onChange={(e) => setFollow(e.target.value)} />
              </div>
            </div>
            {detailsChanged && (
              <div className="admin-lead-inline">
                <button type="button" className="hub-button hub-button-primary" disabled={pending} onClick={saveDetails}>
                  {busy === "details" ? <Loader2 size={13} className="hub-spin" aria-hidden /> : null}Save
                </button>
                <button type="button" className="hub-button hub-button-outline" disabled={pending} onClick={() => { setOwner(lead.ownerId ?? ""); setFollow(lead.nextFollowUp ?? ""); }}>Undo</button>
              </div>
            )}
          </section>

          <section className="admin-member-section" aria-labelledby="lead-facts-title">
            <h3 id="lead-facts-title">About them</h3>
            <dl className="admin-member-facts">
              <div><dt>Email</dt><dd>{lead.email}</dd></div>
              {lead.phone && <div><dt>Phone</dt><dd>{lead.phone}</dd></div>}
              <div><dt>Came in through</dt><dd>{SOURCES[lead.source]}, {whenLabel(lead.createdAt, now).toLowerCase()}</dd></div>
              <div><dt>Heard about us</dt><dd>{lead.heardVia ? HEARD_VIA[lead.heardVia] : "Didn’t say"}</dd></div>
              <div><dt>Looked after by</dt><dd>{ownerName ?? "Nobody yet"}</dd></div>
              <div><dt>Member account</dt><dd>{lead.memberId ? "Linked" : "Not yet"}</dd></div>
            </dl>
            {lead.message && <p className="admin-lead-message">{lead.message}</p>}
          </section>

          <section className="admin-member-section" aria-labelledby="lead-history-title">
            <h3 id="lead-history-title">History</h3>
            <form className="admin-lead-composer" onSubmit={logNote}>
              <div className="admin-segmented" role="group" aria-label="What kind of update">
                {LOGGABLE_KINDS.map((k) => (
                  <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{NOTE_KINDS[k]}</button>
                ))}
              </div>
              <label htmlFor="lead-note" className="sr-only">What happened</label>
              <textarea id="lead-note" className="admin-text-input" rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder={kind === "call" ? "Who you spoke to and what was agreed" : kind === "tour" ? "Who came, what they saw, what they thought" : kind === "email" ? "What you sent or what they replied" : "Anything the team should know"} />
              <button type="submit" className="hub-button hub-button-primary" disabled={pending || !body.trim()}>
                {busy === "note" ? <Loader2 size={13} className="hub-spin" aria-hidden /> : <MessageSquareText size={13} aria-hidden />}Log {NOTE_KINDS[kind].toLowerCase()}
              </button>
            </form>

            {load.status === "loading" && (
              <div className="admin-lead-timeline" aria-busy="true" aria-label="Loading history">
                {Array.from({ length: 3 }, (_, i) => <div key={i} className="admin-member-skeleton"><Skeleton className="h-2.5 w-24" /><Skeleton className="mt-2.5 h-3.5 w-3/4" /></div>)}
              </div>
            )}
            {load.status === "error" && (
              <div className="hub-inline-error admin-member-error" role="alert">
                <AlertCircle size={14} aria-hidden />
                <span>{load.message}</span>
                <button type="button" onClick={() => { setLoad({ status: "loading" }); setAttempt((n) => n + 1); }}>Try again</button>
              </div>
            )}
            {load.status === "ready" && (
              load.notes.length === 0 ? (
                <p className="admin-member-empty">Nothing logged yet.</p>
              ) : (
                <ol className="admin-lead-timeline">
                  {load.notes.map((n) => {
                    const Icon = NOTE_ICONS[n.kind];
                    return (
                      <li key={n.id} data-kind={n.kind}>
                        <span className="admin-lead-note-icon" aria-hidden><Icon size={13} /></span>
                        <div>
                          <p className="admin-lead-note-meta"><strong>{NOTE_KINDS[n.kind]}</strong>{n.author ? ` · ${n.author}` : ""} · <time dateTime={n.createdAt}>{whenLabel(n.createdAt, now)}</time></p>
                          <p className="admin-lead-note-body">{n.body}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
