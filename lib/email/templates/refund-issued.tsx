import { Text } from "@react-email/components";
import { EmailAction, EmailAmount, EmailDetail, EmailLayout, emailStyles, firstName } from "../components/email-layout";

export type RefundIssuedProps = {
  memberName: string;
  memberEmail: string;
  roomName: string;
  bookingDate: string;
  amountAUD: number;
  percent: number;
  bookingsUrl: string;
  logoDataUrl?: string;
};

/** A refund staff issued after the booking was cancelled, for example one that failed at the time. */
export default function RefundIssued({ memberName, memberEmail, roomName, bookingDate, amountAUD, percent, bookingsUrl, logoDataUrl }: RefundIssuedProps) {
  return <EmailLayout preview={`Refunded: $${amountAUD.toFixed(2)} for ${roomName}, ${bookingDate}.`} category="Your booking · Refunded" title="Your refund is on its way." logoDataUrl={logoDataUrl} recipient={memberEmail}>
    <Text style={emailStyles.body}>Hi {firstName(memberName)}, we’ve refunded your cancelled booking.</Text>
    <EmailDetail label="Room">{roomName}</EmailDetail>
    <EmailDetail label="Date" last>{bookingDate}</EmailDetail>
    <EmailAmount tone="positive" label="Refunded" amountAUD={amountAUD} note={<>{percent}% of what you paid. It goes back to your card, usually within 5 to 10 business days.</>} />
    <EmailAction href={bookingsUrl}>View your bookings</EmailAction>
    <Text style={{ ...emailStyles.muted, marginBottom: "20px" }}>Questions? Reply to this email and it comes straight to the team.</Text>
  </EmailLayout>;
}
