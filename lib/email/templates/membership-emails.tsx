import { Text } from "@react-email/components";
import { EmailAction, EmailAmount, EmailDetail, EmailLayout, EmailNote, emailStyles, firstName } from "../components/email-layout";

/**
 * The emails a membership sends over its life. Stripe events drive them, and
 * each is sent once (see lib/billing/notices.ts). They live together because
 * they share their props and read as one conversation with the member.
 */

type Member = { memberName: string; memberEmail: string; planName: string; membershipUrl: string; logoDataUrl?: string };
const FOOT = "Questions? Reply to this email and it comes straight to the team.";

export function MembershipWelcome({ memberName, memberEmail, planName, membershipUrl, logoDataUrl, priceLabel, renewsOn, discountPercent, spacesUrl }: Member & {
  /** "$75 a month" */
  priceLabel: string;
  renewsOn: string | null;
  discountPercent: number;
  spacesUrl: string;
}) {
  return <EmailLayout preview={`Your ${planName} membership is active.`} category="Your membership · Welcome" title={`Welcome to ${planName}.`} logoDataUrl={logoDataUrl} recipient={memberEmail}>
    <Text style={emailStyles.body}>Hi {firstName(memberName)}, your membership is active. Thanks for joining; it’s good to have you with us.</Text>
    <EmailDetail label="Plan">{planName}</EmailDetail>
    <EmailDetail label="Price" last={!renewsOn && discountPercent <= 0}>{priceLabel}</EmailDetail>
    {renewsOn && <EmailDetail label="Next payment" last={discountPercent <= 0}>{renewsOn}</EmailDetail>}
    {discountPercent > 0 && <EmailDetail label="Member rate" last>{discountPercent}% off every meeting room booking</EmailDetail>}
    {discountPercent > 0
      ? <EmailAction href={spacesUrl}>Book a room at your member rate</EmailAction>
      : <EmailAction href={membershipUrl}>See your membership</EmailAction>}
    <EmailNote label="Your plan, your way">Change your card, download receipts or cancel any time from Plan &amp; billing in the hub.</EmailNote>
    <Text style={{ ...emailStyles.muted, marginBottom: "20px" }}>{FOOT}</Text>
  </EmailLayout>;
}

export function MembershipReceipt({ memberName, memberEmail, planName, membershipUrl, logoDataUrl, amountAUD, periodLabel, paidOn, invoiceNumber, invoiceUrl }: Member & {
  amountAUD: number;
  /** "20 Sep – 20 Oct 2026" */
  periodLabel: string;
  paidOn: string;
  invoiceNumber: string | null;
  invoiceUrl: string | null;
}) {
  return <EmailLayout preview={`Receipt: $${amountAUD.toFixed(2)} for ${planName}, ${periodLabel}.`} category="Your membership · Receipt" title="Payment received." logoDataUrl={logoDataUrl} recipient={memberEmail}>
    <Text style={emailStyles.body}>Hi {firstName(memberName)}, thanks. Here’s your receipt for {planName}.</Text>
    <EmailDetail label="Plan">{planName}</EmailDetail>
    <EmailDetail label="Covers">{periodLabel}</EmailDetail>
    <EmailDetail label="Paid on" last={!invoiceNumber}>{paidOn}</EmailDetail>
    {invoiceNumber && <EmailDetail label="Invoice" last><span style={{ fontFamily: "'Courier New', monospace", letterSpacing: ".5px" }}>{invoiceNumber}</span></EmailDetail>}
    <EmailAmount tone="positive" label="Paid" amountAUD={amountAUD} note="Charged to your card on file." />
    <EmailAction href={invoiceUrl ?? membershipUrl}>{invoiceUrl ? "View or download the invoice" : "See your receipts"}</EmailAction>
    <Text style={{ ...emailStyles.muted, marginBottom: "20px" }}>{FOOT}</Text>
  </EmailLayout>;
}

export function MembershipPaymentFailed({ memberName, memberEmail, planName, membershipUrl, logoDataUrl, amountAUD, nextAttempt }: Member & {
  amountAUD: number;
  /** When Stripe will try again, or null when it won't. */
  nextAttempt: string | null;
}) {
  return <EmailLayout preview={`We couldn’t take the payment for ${planName}. Update your card to keep your membership.`} category="Your membership · Payment" title="Your payment didn’t go through." logoDataUrl={logoDataUrl} recipient={memberEmail}>
    <Text style={emailStyles.body}>Hi {firstName(memberName)}, we couldn’t take the latest payment for your {planName} membership. It happens: a card expires or a bank says no.</Text>
    <EmailAmount tone="warning" label="Payment due" amountAUD={amountAUD} note={nextAttempt ? <>We’ll try your card again on {nextAttempt}.</> : <>Update your card so we can take it.</>} />
    <EmailAction href={membershipUrl}>Update your card</EmailAction>
    <EmailNote label="Your access">You keep your membership while we retry. Updating your card now means nothing gets interrupted.</EmailNote>
    <Text style={{ ...emailStyles.muted, marginBottom: "20px" }}>{FOOT}</Text>
  </EmailLayout>;
}

export function MembershipCancelling({ memberName, memberEmail, planName, membershipUrl, logoDataUrl, endsOn }: Member & { endsOn: string }) {
  return <EmailLayout preview={`Your ${planName} membership ends on ${endsOn}. You won’t be charged again.`} category="Your membership · Cancelling" title="Sorry to see you go." logoDataUrl={logoDataUrl} recipient={memberEmail}>
    <Text style={emailStyles.body}>Hi {firstName(memberName)}, we’ve cancelled your {planName} membership as you asked. You keep everything until it ends, and you won’t be charged again.</Text>
    <EmailDetail label="Plan">{planName}</EmailDetail>
    <EmailDetail label="Access until" last>{endsOn}</EmailDetail>
    <EmailNote label="Changed your mind?">You can keep your membership from Plan &amp; billing in the hub any time before {endsOn}.</EmailNote>
    <EmailAction href={membershipUrl}>Keep my membership</EmailAction>
    <Text style={{ ...emailStyles.muted, marginBottom: "20px" }}>{FOOT}</Text>
  </EmailLayout>;
}

export function MembershipEnded({ memberName, memberEmail, planName, membershipUrl, logoDataUrl }: Member) {
  return <EmailLayout preview={`Your ${planName} membership has ended. You can rejoin any time.`} category="Your membership · Ended" title="Your membership has ended." logoDataUrl={logoDataUrl} recipient={memberEmail}>
    <Text style={emailStyles.body}>Hi {firstName(memberName)}, your {planName} membership has now ended. Thanks for being part of Inspire9.</Text>
    <EmailNote label="Still welcome">You can keep booking meeting rooms at the standard rate, and rejoin whenever suits you.</EmailNote>
    <EmailAction href={membershipUrl}>See the plans</EmailAction>
    <Text style={{ ...emailStyles.muted, marginBottom: "20px" }}>{FOOT}</Text>
  </EmailLayout>;
}

export type StaffMembershipAlertKind = "joined" | "cancelling" | "payment_failed" | "ended";
const STAFF_COPY: Record<StaffMembershipAlertKind, { category: string; title: (name: string, plan: string) => string }> = {
  joined: { category: "Memberships · New member", title: (name, plan) => `${name} joined ${plan}.` },
  cancelling: { category: "Memberships · Cancelling", title: (name) => `${name} is leaving.` },
  payment_failed: { category: "Memberships · Payment failed", title: (name) => `${name}’s payment failed.` },
  ended: { category: "Memberships · Ended", title: (name) => `${name}’s membership ended.` },
};

/** To the team inbox, so a change in who's paying never goes unnoticed. */
export function StaffMembershipAlert({ kind, memberName, memberEmail, planName, detail, adminUrl, logoDataUrl }: {
  kind: StaffMembershipAlertKind;
  memberName: string;
  memberEmail: string;
  planName: string;
  /** One line of what to know: "Ends 20 October 2026", "$75.00, next try 23 September". */
  detail: string;
  adminUrl: string;
  logoDataUrl?: string;
}) {
  const copy = STAFF_COPY[kind];
  return <EmailLayout preview={`${copy.title(memberName, planName)} ${detail}`} category={copy.category} title={copy.title(memberName, planName)} logoDataUrl={logoDataUrl}>
    <EmailDetail label="Member">{memberName}</EmailDetail>
    <EmailDetail label="Email">{memberEmail}</EmailDetail>
    <EmailDetail label="Plan">{planName}</EmailDetail>
    <EmailDetail label="Detail" last>{detail}</EmailDetail>
    <EmailAction href={adminUrl}>Open memberships</EmailAction>
  </EmailLayout>;
}
