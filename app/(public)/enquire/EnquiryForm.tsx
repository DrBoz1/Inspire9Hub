"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { Building2, ChevronDown, Mail, MailCheck, Phone, Sparkles, UserRound, Users } from "lucide-react";
import { HEARD_VIA, INTERESTS, MESSAGE_MAX, TEAM_MAX, type LeadField } from "@/lib/admin-leads";
import { AuthAlert } from "../../(auth)/AuthAlert";
import { SubmitButton } from "../../(auth)/AuthUi";
import { submitEnquiry, type EnquiryState } from "./actions";

const INITIAL: EnquiryState = { status: "idle" };

export function EnquiryForm() {
  const [state, action] = useActionState(submitEnquiry, INITIAL);
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const started = useRef<HTMLInputElement>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    // When the visitor started, for the too-fast-to-be-human check. Set here, not in
    // render, and written again after each attempt because the form resets itself.
    if (!startedAt.current) startedAt.current = Date.now();
    if (started.current) started.current.value = String(startedAt.current);
    if (state.status === "sent") heading.current?.focus();
    if (state.status === "error" && state.fieldErrors) form.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  }, [state]);

  if (state.status === "sent") {
    return (
      <section className="auth-page enquire-page" aria-labelledby="enquire-sent-title">
        <span className="auth-sent-mark"><MailCheck size={22} strokeWidth={1.8} aria-hidden /></span>
        <header className="auth-heading">
          <p className="auth-eyebrow">Enquiry sent</p>
          <h1 id="enquire-sent-title" ref={heading} tabIndex={-1}>
            {state.firstName ? `Thanks, ${state.firstName}` : "Thanks"}<span className="auth-red">.</span>
          </h1>
          <p>We’ll reply within one working day, usually sooner.</p>
        </header>
        <ol className="enquire-next">
          <li><strong>We get in touch</strong><span>A real person from the Inspire9 team, not an automated sequence.</span></li>
          <li><strong>You come for a look</strong><span>Tell us when suits and we’ll show you the spaces that fit.</span></li>
          <li><strong>You move in</strong><span>Sign up, do a short induction, and your desk or office is ready.</span></li>
        </ol>
        <p className="auth-footnote auth-footnote-left">
          Already a member? <Link href="/login">Sign in</Link>
        </p>
      </section>
    );
  }

  const failed = state.status === "error" ? state : null;
  const errors = failed?.fieldErrors ?? {};
  const value = (field: LeadField) => failed?.values[field] ?? "";
  // Wires a field to its error message, so screen readers read the problem with the field.
  const invalid = (field: LeadField, id: string) =>
    errors[field] ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : {};
  const problem = (field: LeadField, id: string) =>
    errors[field] ? <p id={`${id}-error`} className="enquire-error">{errors[field]}</p> : null;

  return (
    <section className="auth-page enquire-page" aria-labelledby="enquire-title">
      <header className="auth-heading">
        <p className="auth-eyebrow">Desks · Offices · Meeting rooms</p>
        <h1 id="enquire-title">Find your space<span className="auth-red">.</span></h1>
        <p>Tell us what you need and we’ll show you around. No account needed.</p>
      </header>

      {failed?.error && (
        <div className="auth-notices">
          <AuthAlert key={JSON.stringify(failed)} type="error" message={failed.error} />
        </div>
      )}

      {/* Remounted on each failed attempt. After an action React resets a form to its first
          defaults, and a select only takes its default when it mounts, so without this the
          choice someone made would be wiped by an unrelated typo. */}
      <form key={failed?.attempt ?? 0} ref={form} action={action} className="auth-form" noValidate>
        {/* Hidden from people and from assistive tech; form-filling scripts complete it anyway. */}
        <div className="enquire-hp" aria-hidden="true">
          <label>Leave this empty<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>
        <input ref={started} type="hidden" name="startedAt" defaultValue="" />

        <div className="enquire-row">
          <div className="auth-field">
            <label htmlFor="enq-name">Your name</label>
            <div className="auth-input">
              <UserRound size={16} strokeWidth={1.8} aria-hidden />
              <input id="enq-name" name="name" autoComplete="name" placeholder="Jane Smith" required maxLength={120} defaultValue={value("name")} {...invalid("name", "enq-name")} />
            </div>
            {problem("name", "enq-name")}
          </div>
          <div className="auth-field">
            <label htmlFor="enq-email">Email</label>
            <div className="auth-input">
              <Mail size={16} strokeWidth={1.8} aria-hidden />
              <input id="enq-email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required maxLength={254} defaultValue={value("email")} {...invalid("email", "enq-email")} />
            </div>
            {problem("email", "enq-email")}
          </div>
        </div>

        <div className="enquire-row">
          <div className="auth-field">
            <label htmlFor="enq-phone">Phone <span className="enquire-optional">optional</span></label>
            <div className="auth-input">
              <Phone size={16} strokeWidth={1.8} aria-hidden />
              <input id="enq-phone" name="phone" type="tel" autoComplete="tel" placeholder="0412 345 678" maxLength={30} defaultValue={value("phone")} {...invalid("phone", "enq-phone")} />
            </div>
            {problem("phone", "enq-phone")}
          </div>
          <div className="auth-field">
            <label htmlFor="enq-company">Company <span className="enquire-optional">optional</span></label>
            <div className="auth-input">
              <Building2 size={16} strokeWidth={1.8} aria-hidden />
              <input id="enq-company" name="company" autoComplete="organization" placeholder="Where you work" maxLength={120} defaultValue={value("company")} {...invalid("company", "enq-company")} />
            </div>
            {problem("company", "enq-company")}
          </div>
        </div>

        <div className="enquire-row">
          <div className="auth-field">
            <label htmlFor="enq-interest">Looking for</label>
            <div className="auth-input enquire-select">
              <Sparkles size={16} strokeWidth={1.8} aria-hidden />
              <select id="enq-interest" name="interest" required defaultValue={value("interest")} {...invalid("interest", "enq-interest")}>
                <option value="" disabled>Choose one</option>
                {Object.entries(INTERESTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <ChevronDown size={15} className="enquire-chevron" aria-hidden />
            </div>
            {problem("interest", "enq-interest")}
          </div>
          <div className="auth-field">
            <label htmlFor="enq-team">Team size <span className="enquire-optional">optional</span></label>
            <div className="auth-input">
              <Users size={16} strokeWidth={1.8} aria-hidden />
              <input id="enq-team" name="teamSize" type="number" inputMode="numeric" min={1} max={TEAM_MAX} placeholder="How many people" defaultValue={value("teamSize")} {...invalid("teamSize", "enq-team")} />
            </div>
            {problem("teamSize", "enq-team")}
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="enq-heard">How did you hear about us? <span className="enquire-optional">optional</span></label>
          <div className="auth-input enquire-select enquire-no-icon">
            <select id="enq-heard" name="heardVia" defaultValue={value("heardVia")} {...invalid("heardVia", "enq-heard")}>
              <option value="">Choose one</option>
              {Object.entries(HEARD_VIA).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <ChevronDown size={15} className="enquire-chevron" aria-hidden />
          </div>
          {problem("heardVia", "enq-heard")}
        </div>

        <div className="auth-field">
          <label htmlFor="enq-message">Anything else? <span className="enquire-optional">optional</span></label>
          <div className="auth-input enquire-no-icon">
            <textarea id="enq-message" name="message" rows={4} maxLength={MESSAGE_MAX} placeholder="When you’d like to start, what matters most, a good time to visit…" defaultValue={value("message")} {...invalid("message", "enq-message")} />
          </div>
          {problem("message", "enq-message")}
        </div>

        <SubmitButton pendingLabel="Sending…">Send enquiry</SubmitButton>
      </form>

      <p className="auth-footnote">
        Already a member? <Link href="/login">Sign in</Link>
        <span className="auth-staff-note">We only use your details to reply to this enquiry.</span>
      </p>
    </section>
  );
}
