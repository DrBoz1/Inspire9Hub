"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, ArrowUpDown, Check, Copy, LifeBuoy, Loader2, LockKeyhole, Sparkles, Wifi } from "lucide-react";
import { submitInduction } from "@/app/(auth)/actions";
import { IDLE_FORM, LIMITS, hasErrors, inductionProgress, validateInduction, type InductionStage, type InductionValues, type ProfileValues } from "@/lib/member-forms";
import { HubInput } from "../HubField";

type Props = {
  stage: InductionStage;
  memberStatus: string;
  firstName: string;
  member: ProfileValues;
  submittedOn: string | null;
};

export default function InductionClient(props: Props) {
  return props.stage === "not_started" ? <InductionForm member={props.member} /> : <InductionStatus {...props} />;
}

const STEPS = [
  { id: "about", n: "01", title: "About you", caption: "Name, number and company" },
  { id: "emergency", n: "02", title: "In case of emergency", caption: "Who we should call" },
  { id: "guide", n: "03", title: "House guide", caption: "Wi-Fi, lift and shared spaces" },
  { id: "confirm", n: "04", title: "Confirm", caption: "Acknowledge and submit" },
] as const;

function InductionForm({ member }: { member: ProfileValues }) {
  const [state, formAction, pending] = useActionState(submitInduction, IDLE_FORM);
  const [values, setValues] = useState<InductionValues>({ ...member, health_emergency_info: "", acknowledged_terms: false });
  const [attempted, setAttempted] = useState(false);
  const [guideSeen, setGuideSeen] = useState(false);
  const guideEndRef = useRef<HTMLDivElement>(null);

  // The guide counts as read once they've scrolled to its end, not just because a tall screen shows it on load.
  useEffect(() => {
    const el = guideEndRef.current;
    if (!el || guideSeen) return;
    let scrolled = false;
    let visible = false;
    const update = () => { if (scrolled && visible) setGuideSeen(true); };
    const onScroll = () => { scrolled = true; update(); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(el);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      observer.disconnect();
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [guideSeen]);

  const liveErrors = validateInduction(values);
  const errors = attempted ? liveErrors : state.status === "error" ? state.errors ?? {} : {};
  const progress = inductionProgress(values, guideSeen);
  const doneCount = Object.values(progress).filter(Boolean).length;
  const current = STEPS.find((s) => !progress[s.id])?.id;
  const errorCount = Object.keys(errors).length;
  const set = <K extends keyof InductionValues>(key: K) => (value: InductionValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!hasErrors(liveErrors)) return;
    e.preventDefault();
    setAttempted(true);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(".hub-induction-form [aria-invalid='true']")?.focus());
  };

  const summary = pending
    ? { state: "pending", text: "Submitting your induction…" }
    : errorCount
      ? { state: "error", text: `${errorCount} thing${errorCount === 1 ? "" : "s"} to fix before you submit.` }
      : state.status === "error"
        ? { state: "error", text: state.message }
        : doneCount === 4
          ? { state: "saved", text: "All done. Ready when you are." }
          : { state: "idle", text: `${4 - doneCount} step${4 - doneCount === 1 ? "" : "s"} to go.` };

  return (
    <div className="hub-page hub-induction">
      <div className="hub-page-heading">
        <div>
          <p className="hub-eyebrow">Welcome to Inspire9</p>
          <h1>Let’s get you settled<span className="hub-red">.</span></h1>
          <p>A few details and a quick read of the house guide. About three minutes, then the team takes a look.</p>
        </div>
      </div>

      <div className="hub-induction-grid">
        <nav className="hub-surface hub-steps" aria-label="Induction steps">
          <div className="hub-steps-top">
            <p className="hub-eyebrow">Your progress</p>
            <strong>{doneCount} of 4</strong>
          </div>
          <div className="hub-steps-meter" role="progressbar" aria-label="Induction progress" aria-valuemin={0} aria-valuemax={4} aria-valuenow={doneCount}>
            <span style={{ width: `${(doneCount / 4) * 100}%` }} />
          </div>
          <ol>
            {STEPS.map((s) => (
              <li key={s.id} data-done={progress[s.id]} data-current={current === s.id}>
                <a href={`#${s.id}`}>
                  <span className="hub-step-mark">{progress[s.id] ? <Check size={13} strokeWidth={2.4} aria-label="Done" /> : s.n}</span>
                  <span><strong>{s.title}</strong><small>{s.caption}</small></span>
                </a>
              </li>
            ))}
          </ol>
          <p className="hub-steps-note"><LockKeyhole size={13} aria-hidden />Only the Inspire9 team can see what you share here.</p>
        </nav>

        <form action={formAction} onSubmit={onSubmit} noValidate className="hub-induction-form">
          <section id="about" className="hub-surface hub-step-card" aria-labelledby="about-title">
            <StepHead n="01" id="about-title" title="About you" text="So the team knows who’s joining, and how to reach you." />
            <div className="hub-form-grid">
              <HubInput id="full_name" name="full_name" label="Full name" icon="user" autoComplete="name" value={values.full_name} onValueChange={set("full_name")} error={errors.full_name} span="full" required maxLength={80} />
              <HubInput id="mobile_number" name="mobile_number" type="tel" inputMode="tel" label="Mobile number" icon="phone" autoComplete="tel" placeholder="0412 345 678" value={values.mobile_number} onValueChange={set("mobile_number")} error={errors.mobile_number} required />
              <HubInput id="company_name" name="company_name" label="Company" icon="building" autoComplete="organization" placeholder="Where you work" value={values.company_name} onValueChange={set("company_name")} error={errors.company_name} required maxLength={100} />
            </div>
          </section>

          <section id="emergency" className="hub-surface hub-step-card" aria-labelledby="emergency-title">
            <StepHead n="02" id="emergency-title" title="In case of emergency" text="Who should we call if something happens at the hub? Add anything we should know, like allergies or a medical condition." />
            <div className="hub-field">
              <label className="hub-field-label" htmlFor="health_emergency_info">
                Emergency contact and medical details
                <small>{values.health_emergency_info.length.toLocaleString("en-AU")} / 1,000</small>
              </label>
              <textarea
                id="health_emergency_info"
                name="health_emergency_info"
                rows={5}
                required
                maxLength={LIMITS.emergency}
                placeholder={"Alex Chen (partner), 0400 000 000\nAsthma, carries an inhaler"}
                value={values.health_emergency_info}
                onChange={(e) => set("health_emergency_info")(e.target.value)}
                aria-invalid={errors.health_emergency_info ? true : undefined}
                aria-describedby={errors.health_emergency_info ? "health_emergency_info-error" : undefined}
              />
              {errors.health_emergency_info && <p className="hub-field-error" id="health_emergency_info-error"><AlertCircle size={12} aria-hidden />{errors.health_emergency_info}</p>}
            </div>
          </section>

          <section id="guide" className="hub-surface hub-step-card" aria-labelledby="guide-title">
            <StepHead n="03" id="guide-title" title="House guide" text="The essentials for your first day. You can come back to this page any time." />
            <HouseGuide />
            <div ref={guideEndRef} aria-hidden />
          </section>

          <section id="confirm" className="hub-surface hub-step-card hub-confirm-card" aria-labelledby="confirm-title">
            <StepHead n="04" id="confirm-title" title="Confirm and submit" text="The Inspire9 team reviews your details and activates your membership. We’ll send a confirmation to your email." />
            <label className="hub-check" data-invalid={errors.acknowledged_terms ? true : undefined}>
              <input
                type="checkbox"
                name="acknowledged_terms"
                checked={values.acknowledged_terms}
                onChange={(e) => set("acknowledged_terms")(e.target.checked)}
                aria-invalid={errors.acknowledged_terms ? true : undefined}
                aria-describedby={errors.acknowledged_terms ? "acknowledged_terms-error" : undefined}
              />
              <span>I acknowledge that I have been informed of the site’s safety rules and have completed the induction.</span>
            </label>
            {errors.acknowledged_terms && <p className="hub-field-error" id="acknowledged_terms-error"><AlertCircle size={12} aria-hidden />{errors.acknowledged_terms}</p>}
            <div className="hub-confirm-foot">
              <p className="hub-form-status" data-state={summary.state} aria-live="polite">
                {summary.state === "error" && <AlertCircle size={14} aria-hidden />}
                {summary.state === "saved" && <Check size={14} aria-hidden />}
                {summary.text}
              </p>
              <button type="submit" className="hub-button hub-button-primary" disabled={pending}>
                {pending ? <><Loader2 size={15} className="hub-spin" aria-hidden />Submitting…</> : <>Complete induction<ArrowRight size={15} aria-hidden /></>}
              </button>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}

function InductionStatus({ stage, memberStatus, firstName, submittedOn }: Props) {
  const complete = stage === "complete";
  const active = memberStatus === "Active";
  const steps = [
    { title: "Details submitted", text: submittedOn ? `Received on ${submittedOn}.` : "We have your details.", state: "done" },
    { title: "Team review", text: complete ? "Approved by the Inspire9 team." : "The team is checking your details now.", state: complete ? "done" : "current" },
    {
      title: "Membership active",
      text: !complete ? "Your membership switches on once you’re approved." : active ? "You’re free to book spaces and settle in." : `Your membership is currently ${memberStatus.toLowerCase()}. Get in touch if that looks wrong.`,
      state: !complete ? "upcoming" : active ? "done" : "attention",
    },
  ];
  const name = firstName ? `, ${firstName}` : "";

  return (
    <div className="hub-page hub-induction">
      <div className="hub-page-heading">
        <div>
          <p className="hub-eyebrow">Hub induction</p>
          <h1>{complete ? `You’re all set${name}` : `Thanks${name}. We’re on it`}<span className="hub-red">.</span></h1>
          <p>{complete ? "Your induction is complete. The house guide is here whenever you need it." : "Your induction is with the Inspire9 team. Here’s what happens next."}</p>
        </div>
      </div>

      <div className="hub-review-grid">
        <section className="hub-surface hub-timeline" aria-labelledby="timeline-title">
          <div className="hub-review-top">
            <p className="hub-eyebrow">Where things are</p>
            <span className="hub-status-badge" data-status={complete ? "approved" : "pending"}>{complete ? "Approved" : "In review"}</span>
          </div>
          <h2 id="timeline-title">{complete ? "Induction complete" : "Under review"}</h2>
          <ol>
            {steps.map((s, i) => (
              <li key={s.title} data-state={s.state}>
                <span className="hub-step-mark">{s.state === "done" ? <Check size={13} strokeWidth={2.4} aria-label="Done" /> : `0${i + 1}`}</span>
                <div><strong>{s.title}</strong><span>{s.text}</span></div>
              </li>
            ))}
          </ol>
          <div className="hub-review-actions">
            {complete && active
              ? <Link href="/spaces" className="hub-button hub-button-primary">Find a space<ArrowRight size={15} aria-hidden /></Link>
              : <Link href="/dashboard" className="hub-button hub-button-primary">Back to overview<ArrowRight size={15} aria-hidden /></Link>}
            <Link href="/support" className="hub-button hub-button-outline"><LifeBuoy size={15} aria-hidden />Questions?</Link>
          </div>
        </section>

        <section className="hub-surface hub-step-card" aria-labelledby="guide-title">
          <StepHead id="guide-title" title="House guide" text="The essentials, for your first day and every day after." />
          <HouseGuide />
        </section>
      </div>
    </div>
  );
}

function StepHead({ n, id, title, text }: { n?: string; id: string; title: string; text: string }) {
  return (
    <header className="hub-step-head">
      {n && <span className="hub-step-index" aria-hidden>{n}</span>}
      <div><h2 id={id}>{title}</h2><p>{text}</p></div>
    </header>
  );
}

function HouseGuide() {
  return (
    <div className="hub-guide-grid">
      <article className="hub-guide-card">
        <span className="hub-guide-icon"><Wifi size={16} aria-hidden /></span>
        <h3>Wi-Fi</h3>
        <dl className="hub-wifi">
          <div><dt>Network</dt><dd>Residents</dd></div>
          <div><dt>Password</dt><dd><code>community9</code><CopyButton value="community9" label="Copy Wi-Fi password" /></dd></div>
        </dl>
      </article>
      <article className="hub-guide-card">
        <span className="hub-guide-icon"><ArrowUpDown size={16} aria-hidden /></span>
        <h3>Lift access</h3>
        <p>Lift access is restricted outside 8:30am – 4:00pm without a pass.</p>
      </article>
      <article className="hub-guide-card">
        <span className="hub-guide-icon"><Sparkles size={16} aria-hidden /></span>
        <h3>Shared spaces</h3>
        <p>Please clean whiteboards and kitchen areas after use.</p>
      </article>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }, () => {});
  };
  return (
    <button type="button" className="hub-copy" onClick={copy} data-copied={copied} aria-label={copied ? "Copied" : label}>
      {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
      <span aria-hidden>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
