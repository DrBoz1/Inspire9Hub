import { Column, Heading, Row, Section, Text } from "@react-email/components";
import { colors, EmailAction, EmailDetail, EmailLayout, emailStyles, firstName } from "../components/email-layout";

export type BookingConfirmationProps = {
  memberName: string;
  memberEmail: string;
  roomName: string;
  location: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  totalAUD: number;
  bookingRef: string;
  dashboardUrl: string;
  logoDataUrl?: string;
};

export default function BookingConfirmation({ memberName, memberEmail, roomName, location, bookingDate, startTime, endTime, durationHours, totalAUD, bookingRef, dashboardUrl, logoDataUrl }: BookingConfirmationProps) {
  return <EmailLayout preview={`Confirmed: ${roomName}, ${bookingDate}, ${startTime}–${endTime}.`} category="Your booking · Confirmed" title="Consider it reserved." logoDataUrl={logoDataUrl} recipient={memberEmail}>
    <Text style={emailStyles.body}>Hi {firstName(memberName)}, your space is ready for the calendar. Here are the details for your next visit.</Text>
    <Section style={{ margin: "28px 0 0", borderTop: `2px solid ${colors.sage}`, paddingTop: "23px" }}>
      <Text style={emailStyles.label}>Your space</Text>
      <Heading as="h2" style={{ margin: "0 0 5px", fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "27px", lineHeight: "34px", fontWeight: 400, color: colors.ink }}>{roomName}</Heading>
      <Text style={{ ...emailStyles.muted, marginBottom: "18px" }}>{location}</Text>
      <EmailDetail label="Date">{bookingDate}</EmailDetail>
      <EmailDetail label="Time">{startTime} – {endTime}<br /><span style={{ color: colors.muted }}>Melbourne time · {durationHours} {durationHours === 1 ? "hour" : "hours"}</span></EmailDetail>
      <EmailDetail label="Booked for">{memberName}</EmailDetail>
      <EmailDetail label="Reference" last><span style={{ fontFamily: "'Courier New', monospace", letterSpacing: ".5px" }}>{bookingRef}</span></EmailDetail>
    </Section>
    <Section style={{ backgroundColor: colors.soft, padding: "22px", margin: "12px 0 0" }}>
      <Row><Column><Text style={{ ...emailStyles.label, color: colors.sage, marginBottom: "5px" }}>Payment received</Text><Text style={emailStyles.muted}>Including GST</Text></Column>
        <Column align="right"><Text style={{ margin: 0, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "28px", lineHeight: "34px", color: colors.ink }}>${totalAUD.toFixed(2)}</Text><Text style={{ ...emailStyles.label, margin: "3px 0 0", fontSize: "9px" }}>AUD</Text></Column></Row>
    </Section>
    <EmailAction href={dashboardUrl}>Open your member hub</EmailAction>
    <Text style={{ ...emailStyles.muted, marginBottom: "20px" }}>Keep this email for your records. You can also find your booking and download its invoice in the hub.</Text>
  </EmailLayout>;
}
