"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, Check, HeartPulse, Mail, Phone } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateOnly, initialsOf } from "@/lib/member-forms";
import { dateTile, formatRange, hubDateKey } from "@/lib/admin-dashboard";
import { STATUS_LABELS, formatMoney, scheduleHref } from "@/lib/admin-bookings";
import { INDUCTION_LABELS, INDUCTION_TONES, passStatus, statusTone, type MemberDetails, type MemberRow } from "@/lib/admin-members";
import type { MemberDetailsResult } from "./actions";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; details: MemberDetails };

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

export function MemberSheet({ member, loadDetails, onClose }: { member: MemberRow; loadDetails: (id: string) => Promise<MemberDetailsResult>; onClose: () => void }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadDetails(member.id).then(
      (result) => { if (!cancelled) setLoad("error" in result ? { status: "error", message: result.error } : { status: "ready", details: result.details }); },
      () => { if (!cancelled) setLoad({ status: "error", message: "Couldn’t reach the server. Please try again." }); },
    );
    return () => { cancelled = true; };
  }, [member.id, attempt, loadDetails]);

  const retry = () => {
    setLoad({ status: "loading" });
    setAttempt((n) => n + 1);
  };
  const details = load.status === "ready" ? load.details : null;
  const count = (n: number | undefined) => (n === undefined ? null : <span>{n}</span>);

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="hub-dialog admin-member-sheet">
        <header className="admin-member-head">
          <span className="admin-member-avatar" aria-hidden>{initialsOf(member.name)}</span>
          <SheetTitle>{member.name}</SheetTitle>
          <SheetDescription>{member.company ?? "No company given"}</SheetDescription>
          <div className="admin-member-badges">
            <span className="hub-status-badge" data-status={statusTone(member.status)}>{member.status} member</span>
            <span className="hub-status-badge" data-status={INDUCTION_TONES[member.induction]}>{INDUCTION_LABELS[member.induction]}</span>
          </div>
          {(member.email || member.mobile) && (
            <div className="admin-member-contact">
              {member.email && <a className="hub-button hub-button-outline" href={`mailto:${member.email}`}><Mail size={13} aria-hidden />Email</a>}
              {member.mobile && <a className="hub-button hub-button-outline" href={`tel:${member.mobile.replace(/[^\d+]/g, "")}`}><Phone size={13} aria-hidden />Call</a>}
            </div>
          )}
        </header>

        <Tabs defaultValue="overview" className="admin-member-tabs">
          <TabsList variant="line" className="hub-tabs" aria-label="Member details">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="bookings">Bookings{count(details?.bookings.length)}</TabsTrigger>
            <TabsTrigger value="payments">Payments{count(details?.payments.length)}</TabsTrigger>
            <TabsTrigger value="passes">Passes{count(details?.passes.length)}</TabsTrigger>
          </TabsList>

          {load.status === "loading" && (
            <div className="admin-member-panel" aria-busy="true" aria-label="Loading member details">
              {Array.from({ length: 4 }, (_, i) => <div key={i} className="admin-member-skeleton"><Skeleton className="h-2.5 w-20" /><Skeleton className="mt-2.5 h-3.5 w-3/4" /></div>)}
            </div>
          )}

          {load.status === "error" && (
            <div className="admin-member-panel">
              <div className="hub-inline-error admin-member-error" role="alert">
                <AlertCircle size={14} aria-hidden />
                <span>{load.message}</span>
                <button type="button" onClick={retry}>Try again</button>
              </div>
            </div>
          )}

          {details && (
            <>
              <TabsContent value="overview" className="admin-member-panel">
                <section className="admin-member-section" aria-labelledby="member-contact">
                  <h3 id="member-contact">Contact</h3>
                  <dl className="admin-member-facts">
                    <div><dt>Email</dt><dd>{member.email ? <a href={`mailto:${member.email}`}>{member.email}</a> : "Not given"}</dd></div>
                    <div><dt>Mobile</dt><dd>{member.mobile ? <a href={`tel:${member.mobile.replace(/[^\d+]/g, "")}`}>{member.mobile}</a> : "Not given"}</dd></div>
                    <div><dt>Company</dt><dd>{member.company ?? "Not given"}</dd></div>
                  </dl>
                </section>
                <section className="admin-member-section" aria-labelledby="member-induction">
                  <h3 id="member-induction">Induction</h3>
                  {details.induction ? (
                    <>
                      <dl className="admin-member-facts">
                        <div><dt>Submitted</dt><dd>{formatDateOnly(details.induction.submittedOn) ?? "Unknown"}</dd></div>
                        <div>
                          <dt>House guide</dt>
                          <dd className="admin-review-ack" data-ok={details.induction.acknowledged || undefined}>
                            {details.induction.acknowledged ? <><Check size={12} aria-hidden />Acknowledged</> : <><AlertCircle size={12} aria-hidden />Not acknowledged</>}
                          </dd>
                        </div>
                      </dl>
                      <div className="admin-review-note">
                        <p className="admin-review-note-label"><HeartPulse size={12} aria-hidden />Emergency contact and medical details</p>
                        <p>{details.induction.emergency ?? "Nothing provided."}</p>
                      </div>
                    </>
                  ) : (
                    <p className="admin-member-empty">No induction on file.</p>
                  )}
                  {member.induction === "under_review" && <Link href="/admin/approvals" className="hub-text-link admin-member-link">Review it in Compliance<ArrowUpRight size={14} aria-hidden /></Link>}
                </section>
              </TabsContent>

              <TabsContent value="bookings" className="admin-member-panel">
                {details.bookings.length === 0 ? <p className="admin-member-empty">No bookings yet.</p> : (
                  <ul className="admin-member-list">
                    {details.bookings.map((b) => {
                      const tile = dateTile(b.start);
                      return (
                        <li key={b.id}>
                          <span className="hub-date-tile" aria-hidden><span>{tile.month}</span><strong>{tile.day}</strong></span>
                          <span className="admin-member-list-main"><strong>{b.room}</strong><span>{tile.weekday} · {formatRange(b.start, b.end)}</span></span>
                          <span className="hub-status-badge" data-status={b.status}>{STATUS_LABELS[b.status] ?? capitalise(b.status)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {member.email && <Link href={scheduleHref({ filter: "all", q: member.email })} className="hub-text-link admin-member-link">See them in the booking schedule<ArrowUpRight size={14} aria-hidden /></Link>}
              </TabsContent>

              <TabsContent value="payments" className="admin-member-panel">
                {details.payments.length === 0 ? <p className="admin-member-empty">No payments yet.</p> : (
                  <ul className="admin-member-list">
                    {details.payments.map((p) => (
                      <li key={p.id}>
                        <span className="admin-member-list-main">
                          <strong className="admin-member-amount">{formatMoney(p.amount)}{p.refunded ? <small> · {formatMoney(p.refunded)} refunded</small> : null}</strong>
                          <span>{formatDateOnly(p.date) ?? "No date"}{p.method ? ` · ${capitalise(p.method)}` : ""}</span>
                        </span>
                        <span className="hub-status-badge" data-status={p.status}>{capitalise(p.status)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="passes" className="admin-member-panel">
                {details.passes.length === 0 ? <p className="admin-member-empty">No access passes issued.</p> : (
                  <ul className="admin-member-list">
                    {details.passes.map((p) => {
                      const status = passStatus(p, hubDateKey(new Date()));
                      return (
                        <li key={p.id}>
                          <span className="admin-member-list-main">
                            <strong>{capitalise(p.type)}</strong>
                            <span>Issued {formatDateOnly(p.issued) ?? "—"} · Expires {formatDateOnly(p.expires) ?? "—"}</span>
                          </span>
                          <span className="hub-status-badge" data-status={status === "active" ? "active" : status === "expired" ? "none" : "cancelled"}>{capitalise(status)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
