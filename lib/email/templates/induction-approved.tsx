import { Text } from "@react-email/components";
import { EmailAction, EmailDetail, EmailLayout, EmailNote, emailStyles, firstName } from "../components/email-layout";

export type InductionApprovedProps = {
  memberName: string;
  memberEmail: string;
  bookingsUrl: string;
  logoDataUrl?: string;
};

export default function InductionApproved({ memberName, memberEmail, bookingsUrl, logoDataUrl }: InductionApprovedProps) {
  return <EmailLayout preview="Your induction is approved. You're ready to book your first space." category="Your induction · Approved" title="Make yourself at home." logoDataUrl={logoDataUrl} recipient={memberEmail}>
    <Text style={emailStyles.body}>Hi {firstName(memberName)}, your induction is approved. You&apos;re ready to find a space, bring your ideas, and get to work.</Text>
    <EmailDetail label="Member">{memberName}</EmailDetail>
    <EmailDetail label="Induction" last>Complete · Workspace bookings available</EmailDetail>
    <EmailAction href={bookingsUrl}>Find your first space</EmailAction>
    <EmailNote label="A good place to begin">Choose a room that suits your group, pick your time, and book through the hub. Your confirmation will arrive by email.</EmailNote>
    <Text style={{ ...emailStyles.body, marginBottom: "24px" }}>Welcome to the community.<br />The Inspire9 team</Text>
  </EmailLayout>;
}
