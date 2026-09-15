"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, Building2, CalendarDays, Check, KeyRound, LifeBuoy, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { logout, updateProfile } from "@/app/(auth)/actions";
import { IDLE_FORM, hasErrors, initialsOf, validateProfile, type InductionStage, type ProfileValues } from "@/lib/member-forms";
import { HubInput } from "../HubField";

type Props = {
  member: ProfileValues & { email: string; memberStatus: string; inductionStage: InductionStage };
  memberSince: string;
  bookingCount: number;
};

const INDUCTION = {
  not_started: { tone: "red", text: "Not started yet. It takes about three minutes." },
  under_review: { tone: "amber", text: "Submitted. The team is reviewing it." },
  complete: { tone: "green", text: "Complete. Your house guide lives here." },
};

export default function ProfileClient({ member, memberSince, bookingCount }: Props) {
  const [state, formAction, pending] = useActionState(updateProfile, IDLE_FORM);
  const initial = { full_name: member.full_name, mobile_number: member.mobile_number, company_name: member.company_name };
  const [values, setValues] = useState<ProfileValues>(initial);
  const [baseline, setBaseline] = useState<ProfileValues>(initial);
  const [attempted, setAttempted] = useState(false);

  // Each answer from the server: a save becomes the new baseline, an error stays up until they edit again.
  const [seenState, setSeenState] = useState(state);
  const [serverNotice, setServerNotice] = useState(false);
  if (state !== seenState) {
    setSeenState(state);
    setServerNotice(state.status === "error");
    if (state.status === "saved" && state.values) {
      setBaseline(state.values);
      setAttempted(false);
    }
  }

  const liveErrors = validateProfile(values);
  const errors = attempted ? liveErrors : serverNotice ? state.errors ?? {} : {};
  const dirty = (Object.keys(values) as (keyof ProfileValues)[]).some((k) => values[k].replace(/\s+/g, " ").trim() !== baseline[k]);
  const set = (key: keyof ProfileValues) => (value: string) => {
    setServerNotice(false);
    setValues((v) => ({ ...v, [key]: value }));
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!hasErrors(liveErrors)) return;
    e.preventDefault();
    setAttempted(true);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(".hub-account-form [aria-invalid='true']")?.focus());
  };

  const status = pending
    ? { state: "pending", text: "Saving your changes…" }
    : hasErrors(errors)
      ? { state: "error", text: "Fix the highlighted field to save." }
      : serverNotice && state.status === "error"
        ? { state: "error", text: state.message }
        : dirty
          ? { state: "dirty", text: "You have unsaved changes." }
          : state.status === "saved"
            ? { state: "saved", text: "Saved. Your details are up to date." }
            : { state: "idle", text: "Your details are up to date." };

  const name = values.full_name.replace(/\s+/g, " ").trim() || "New member";
  const company = values.company_name.trim();
  const induction = INDUCTION[member.inductionStage];

  return (
    <div className="hub-page hub-account">
      <div className="hub-page-heading">
        <div>
          <p className="hub-eyebrow">Your membership</p>
          <h1>Your profile<span className="hub-red">.</span></h1>
          <p>How you show up around the hub, and how the team reaches you.</p>
        </div>
      </div>

      <div className="hub-account-grid">
        <aside className="hub-account-aside">
          <section className="hub-surface hub-id-card" aria-label="Your member card">
            <div className="hub-id-top">
              <span className="hub-id-avatar" aria-hidden>{initialsOf(name)}</span>
              <span className="hub-status-badge" data-status={member.memberStatus.toLowerCase()}>{member.memberStatus}</span>
            </div>
            <h2>{name}</h2>
            <p>{member.email}</p>
            {company && <p><Building2 size={12} aria-hidden />{company}</p>}
            <dl className="hub-id-stats">
              <div><dt>Member since</dt><dd>{memberSince}</dd></div>
              <div><dt>Bookings</dt><dd>{bookingCount}</dd></div>
            </dl>
          </section>

          <nav className="hub-surface hub-account-list" aria-label="Membership shortcuts">
            <Link href="/induction" className="hub-account-row">
              <span className="hub-row-icon" data-tone={induction.tone}><ShieldCheck size={16} aria-hidden /></span>
              <div><strong>Hub induction</strong><span>{induction.text}</span></div>
              <ArrowUpRight size={15} aria-hidden />
            </Link>
            <Link href="/bookings" className="hub-account-row">
              <span className="hub-row-icon"><CalendarDays size={16} aria-hidden /></span>
              <div><strong>Your bookings</strong><span>{bookingCount === 0 ? "Nothing booked yet." : `${bookingCount} confirmed so far.`}</span></div>
              <ArrowUpRight size={15} aria-hidden />
            </Link>
            <Link href="/support" className="hub-account-row">
              <span className="hub-row-icon"><LifeBuoy size={16} aria-hidden /></span>
              <div><strong>Help &amp; support</strong><span>Questions, or a change of email.</span></div>
              <ArrowUpRight size={15} aria-hidden />
            </Link>
          </nav>
        </aside>

        <div className="hub-account-main">
          <form action={formAction} onSubmit={onSubmit} noValidate className="hub-surface hub-account-form" aria-labelledby="details-title">
            <header className="hub-account-head">
              <p className="hub-eyebrow">Personal details</p>
              <h2 id="details-title">About you</h2>
              <p>Keep these up to date so the team can reach you.</p>
            </header>
            <div className="hub-form-grid">
              <HubInput id="full_name" name="full_name" label="Full name" icon="user" autoComplete="name" value={values.full_name} onValueChange={set("full_name")} error={errors.full_name} span="full" required maxLength={80} />
              <HubInput id="mobile_number" name="mobile_number" type="tel" inputMode="tel" label="Mobile number" hint="Optional" icon="phone" autoComplete="tel" placeholder="0412 345 678" value={values.mobile_number} onValueChange={set("mobile_number")} error={errors.mobile_number} />
              <HubInput id="company_name" name="company_name" label="Company or organisation" hint="Optional" icon="building" autoComplete="organization" placeholder="Where you work" value={values.company_name} onValueChange={set("company_name")} error={errors.company_name} maxLength={100} />
              <HubInput id="email" label="Email" icon="mail" type="email" value={member.email} readOnly span="full" note={<>Your sign-in email. To change it, <Link href="/support">contact the team</Link>.</>} />
            </div>
            <footer className="hub-account-foot">
              <p className="hub-form-status" data-state={status.state} aria-live="polite">
                {status.state === "saved" && <Check size={14} aria-hidden />}
                {status.state === "error" && <AlertCircle size={14} aria-hidden />}
                {status.text}
              </p>
              <button type="submit" className="hub-button hub-button-primary" disabled={pending || !dirty}>
                {pending ? <><Loader2 size={15} className="hub-spin" aria-hidden />Saving…</> : "Save changes"}
              </button>
            </footer>
          </form>

          <section className="hub-surface hub-account-security" aria-labelledby="security-title">
            <header className="hub-account-head">
              <p className="hub-eyebrow">Sign-in &amp; security</p>
              <h2 id="security-title">Your account</h2>
            </header>
            <div className="hub-account-row">
              <span className="hub-row-icon"><KeyRound size={16} aria-hidden /></span>
              <div><strong>Password</strong><span>Set a new one. You’ll sign in again afterwards.</span></div>
              <Link href="/reset-password?from=profile" className="hub-button hub-button-outline">Change password</Link>
            </div>
            <div className="hub-account-row">
              <span className="hub-row-icon"><LogOut size={16} aria-hidden /></span>
              <div><strong>Sign out</strong><span>End your session on this device.</span></div>
              <form action={logout}><button type="submit" className="hub-button hub-button-outline">Sign out</button></form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
