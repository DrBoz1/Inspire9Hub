import { Text } from "@react-email/components";
import { EmailAction, EmailLayout, EmailNote, emailStyles, firstName } from "../components/email-layout";

export type ReviewReminderProps = {
  memberName: string;
  memberEmail: string;
  reviewUrl: string;
  logoDataUrl?: string;
};

export default function ReviewReminder({ memberName, memberEmail, reviewUrl, logoDataUrl }: ReviewReminderProps) {
  return <EmailLayout preview="How's your experience at Inspire9? We'd love to hear about it." category="From the community" title="How's life at the hub?" logoDataUrl={logoDataUrl} recipient={memberEmail}>
    <Text style={emailStyles.body}>Hi {firstName(memberName)}, a good workspace is made by the people in it. Thanks for being one of ours.</Text>
    <Text style={emailStyles.body}>If you have a moment, we&apos;d love to hear about your experience at Inspire9. Your honest feedback helps us improve and helps others find their place here.</Text>
    <EmailAction href={reviewUrl}>Share your experience</EmailAction>
    <EmailNote label="In your own words">The space, the people, the little things that made your day. Tell us what worked for you and what could be better.</EmailNote>
    <Text style={{ ...emailStyles.body, marginBottom: "24px" }}>Thanks for making this place what it is.<br />The Inspire9 team</Text>
  </EmailLayout>;
}
