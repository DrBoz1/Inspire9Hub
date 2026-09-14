import { Text } from "@react-email/components";
import { EmailAction, EmailLayout, EmailNote, emailStyles, firstName } from "../components/email-layout";

export type InductionRejectedProps = {
  memberName: string;
  memberEmail: string;
  inductionUrl: string;
  logoDataUrl?: string;
};

export default function InductionRejected({ memberName, memberEmail, inductionUrl, logoDataUrl }: InductionRejectedProps) {
  return <EmailLayout preview="Please review and resubmit your induction so we can finish getting you set up." category="Your induction · Action needed" title="A little more to do." logoDataUrl={logoDataUrl} recipient={memberEmail}>
    <Text style={emailStyles.body}>Hi {firstName(memberName)}, we&apos;ve reviewed your induction and it needs another look before we can approve it.</Text>
    <EmailNote label="Your next step">Open your induction, review your answers, and resubmit when you&apos;re ready. The team will review your new submission.</EmailNote>
    <EmailAction href={inductionUrl}>Review your induction</EmailAction>
    <Text style={{ ...emailStyles.muted, marginBottom: "24px" }}>Workspace bookings will become available once your induction is approved. If you need a hand, contact the team through Support in your hub.</Text>
  </EmailLayout>;
}
