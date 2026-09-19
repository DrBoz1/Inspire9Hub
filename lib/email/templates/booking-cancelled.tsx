import { Text } from "@react-email/components";
import { HALF_REFUND_HOURS } from "@/lib/refund-policy";
import { colors, EmailAction, EmailAmount, EmailDetail, EmailLayout, EmailNote, emailStyles, firstName } from "../components/email-layout";

/** What happened to the money, in the words the email uses. */
export type CancelRefund =
  | { kind: "refunded"; amountAUD: number; percent: number }
  /** Owed, but Stripe didn't take the refund; staff finish it from the bookings page. */
  | { kind: "pending"; amountAUD: number; percent: number }
  /** The member cancelled inside the no-refund window. */
  | { kind: "late" }
  /** Staff cancelled without refunding. */
  | { kind: "none" }
  /** Nothing had been paid. */
  | { kind: "unpaid" };

export type BookingCancelledProps = {
  memberName: string;
  memberEmail: string;
  roomName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  cancelledBy: "member" | "team";
  refund: CancelRefund;
  bookingsUrl: string;
  logoDataUrl?: string;
};

export default function BookingCancelled({ memberName, memberEmail, roomName, bookingDate, startTime, endTime, cancelledBy, refund, bookingsUrl, logoDataUrl }: BookingCancelledProps) {
  const byTeam = cancelledBy === "team";
  return <EmailLayout
    preview={`Cancelled: ${roomName}, ${bookingDate}.`}
    category="Your booking · Cancelled"
    title={byTeam ? "We’ve had to cancel your booking." : "Your booking is cancelled."}
    logoDataUrl={logoDataUrl}
    recipient={memberEmail}
  >
    <Text style={emailStyles.body}>
      {byTeam
        ? <>Hi {firstName(memberName)}, the Inspire9 team has cancelled the booking below. We’re sorry for the change of plans.</>
        : <>Hi {firstName(memberName)}, we’ve cancelled your booking as you asked, so the room is free for someone else.</>}
    </Text>
    <EmailDetail label="Room">{roomName}</EmailDetail>
    <EmailDetail label="Date">{bookingDate}</EmailDetail>
    <EmailDetail label="Time" last>{startTime} – {endTime}<br /><span style={{ color: colors.muted }}>Melbourne time</span></EmailDetail>

    {refund.kind === "refunded" && (
      <EmailAmount tone="positive" label="Refund on its way" amountAUD={refund.amountAUD} note={<>{refund.percent}% of what you paid. It goes back to your card, usually within 5 to 10 business days.</>} />
    )}
    {refund.kind === "pending" && (
      <EmailAmount tone="warning" label="Refund coming" amountAUD={refund.amountAUD} note={<>{refund.percent}% of what you paid. It didn’t go through automatically, so the team will send it and let you know.</>} />
    )}
    {refund.kind === "late" && (
      <EmailNote label="No refund">This booking was cancelled less than {HALF_REFUND_HOURS} hours before it started, so under our cancellation policy it isn’t refunded.</EmailNote>
    )}
    {refund.kind === "none" && (
      <EmailNote label="About a refund">No refund was issued with this cancellation. If you think you should get one, reply to this email and we’ll look into it.</EmailNote>
    )}

    <EmailAction href={bookingsUrl}>Find another time</EmailAction>
    <Text style={{ ...emailStyles.muted, marginBottom: "20px" }}>Questions? Reply to this email and it comes straight to the team.</Text>
  </EmailLayout>;
}
