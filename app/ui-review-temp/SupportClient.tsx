"use client";

import { useRef, useState, useTransition } from "react";
import { Mail, MapPin, Clock, Plus, ArrowUpRight, Send, Check, Loader2 } from "lucide-react";
import { sendSupportRequest } from "./mocks";
import AssistantWidget from "./AssistantWidget";

const TOPICS = ["Booking Issue", "Payments & Refunds", "Induction", "Access Pass", "General Enquiry"];
const FAQS = [
  { q: "What happens if I cancel?", a: "Cancel 48 or more hours before your booking for a full refund, or between 4 and 48 hours for a 50% refund. Under 4 hours, no refund applies. You'll see the applicable policy before you confirm a cancellation." },
  { q: "Can I move a booking to another time?", a: "Book your new time and cancel the original reservation from My schedule. Check availability and the cancellation policy before making a change; each reservation is handled separately." },
  { q: "Where is my access pass?", a: "Your digital pass is issued when a booking is confirmed. Open Activity, then Passes, to see your passes and their expiry dates." },
  { q: "Why is booking locked?", a: "Booking becomes available once your safety induction is approved. Check your dashboard for the current status. If your induction is submitted, the team still needs to review it." },
  { q: "I paid, but my booking still says pending.", a: "Confirmation can take a moment to update. Check your booking in Activity before trying to pay again. If it stays pending, send the team your room, date and payment details using the form below." },
];

export default function SupportClient({ firstName }: { firstName: string }) {
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const messageRef = useRef<HTMLTextAreaElement>(null);
  function escalateFromBot(question: string) {
    setSent(false); setTopic("General Enquiry"); setMessage(question.slice(0, 2000)); setError("");
    requestAnimationFrame(() => { document.getElementById("support-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); messageRef.current?.focus({ preventScroll: true }); });
  }
  return <div className="hub-page hub-support">
    <div className="hub-page-heading"><div><p className="hub-eyebrow">A little help goes a long way</p><h1>We're here for you<span className="hub-red">.</span></h1><p>Hi {firstName}. Let's get you back to the good stuff.</p></div><a className="hub-button hub-button-outline" href="#support-form">Talk to the team<ArrowUpRight size={15} /></a></div>
    <div className="hub-support-grid">
      <AssistantWidget onEscalate={escalateFromBot} />
      <aside className="hub-support-aside">
        <section className="hub-faq hub-surface"><div className="hub-record-heading"><div><p className="hub-eyebrow">Good to know</p><h2>The usual questions</h2></div></div>{FAQS.map((faq, index) => <details key={faq.q}><summary><span className="hub-faq-number">0{index + 1}</span>{faq.q}<Plus size={15} /></summary><p>{faq.a}</p></details>)}</section>
        <div className="hub-contact-card"><span className="hub-eyebrow">Good people, close by</span><p>Sometimes, a conversation<br /><em>makes all the difference.</em></p><a href="mailto:hello@inspire9.com"><Mail size={14} />hello@inspire9.com<ArrowUpRight size={13} /></a><span><MapPin size={14} />41 Stewart St, Richmond VIC</span><span><Clock size={14} />Staffed Monday–Friday, 9 am–5 pm</span></div>
      </aside>
    </div>
    <section id="support-form" className="hub-support-form hub-surface">
      <div className="hub-support-form-intro"><p className="hub-eyebrow">From your screen to our team</p><h2>A human touch.</h2><p>Tell us what's on your mind. The Inspire9 team will reply to your account email.</p><span><Mail size={15} />Straight to the people who can help.</span></div>
      {sent ? <div className="hub-support-sent" role="status"><span><Check size={23} /></span><h3>You're in good hands.</h3><p>Your message has been sent to the team. Keep an eye on your email for a reply.</p><button className="hub-button hub-button-outline" onClick={() => { setSent(false); setMessage(""); setTopic(""); }}>Send another message<ArrowUpRight size={14} /></button></div> :
        <form onSubmit={e => { e.preventDefault(); if (pending) return; setError(""); if (!topic || message.trim().length < 10) { setError("Choose a topic and add at least 10 characters."); return; } const data = new FormData(); data.set("topic", topic); data.set("message", message.trim()); startTransition(async () => { try { const result = await sendSupportRequest(data); if (result?.error) setError(result.error); else setSent(true); } catch { setError("Your message couldn't be sent. Please try again; your draft is saved here."); } }); }}>
          <fieldset disabled={pending}><legend>What's it about?</legend><div className="hub-topic-options">{TOPICS.map(value => <label key={value} data-active={topic === value}><input type="radio" name="topic" value={value} checked={topic === value} onChange={() => setTopic(value)} required />{value}</label>)}</div>
            <label htmlFor="support-message" className="hub-field-label">Your message</label><textarea id="support-message" ref={messageRef} value={message} onChange={e => setMessage(e.target.value)} placeholder="A few details will help us help you…" required minLength={10} maxLength={2000} rows={4} aria-describedby="support-message-hint" />
            <div className="hub-form-footer"><span id="support-message-hint">{message.length} / 2,000</span><button type="submit" className="hub-button hub-button-primary" disabled={pending}>{pending ? <><Loader2 size={14} className="animate-spin" />Sending…</> : <>Send message<Send size={14} /></>}</button></div>
          </fieldset>{error && <p role="alert" className="hub-inline-error">{error}</p>}
        </form>}
    </section>
  </div>;
}
