import { Text } from "@react-email/components";
import { EmailAction, EmailLayout, EmailNote, emailStyles, firstName } from "../components/email-layout";

export type InductionSubmittedProps = {
  memberName: string;
  memberEmail: string;
  dashboardUrl: string;
  logoDataUrl?: string;
};

export default function InductionSubmitted({ memberName, memberEmail, dashboardUrl, logoDataUrl }: InductionSubmittedProps) {
  return <EmailLayout preview="Your induction is with our team. We'll email you when it's been reviewed." category="Your induction · Received" title="You're one step closer." logoDataUrl={logoDataUrl} recipient={memberEmail}>
    <Text style={emailStyles.body}>Hi {firstName(memberName)}, thanks for completing your induction. We&apos;ve received your submission and the team will review it.</Text>
    <EmailNote label="What happens next">We&apos;ll email you once your induction has been reviewed. Workspace bookings open when you&apos;re approved.</EmailNote>
    <Text style={emailStyles.body}>There&apos;s nothing else you need to do for now. You can check your induction status in your member hub.</Text>
    <EmailAction href={dashboardUrl}>Visit your member hub</EmailAction>
    <Text style={{ ...emailStyles.muted, marginBottom: "20px" }}>We look forward to welcoming you in.<br />The Inspire9 team</Text>
  </EmailLayout>;
}
