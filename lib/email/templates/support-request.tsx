import { Text } from "@react-email/components";
import { EmailAction, EmailDetail, EmailLayout, emailStyles } from "../components/email-layout";

export type SupportRequestProps = {
  memberName: string;
  memberEmail: string;
  topic: string;
  message: string;
  logoDataUrl?: string;
};

export default function SupportRequest({ memberName, memberEmail, topic, message, logoDataUrl }: SupportRequestProps) {
  return <EmailLayout preview={`Support request from ${memberName}: ${topic}`} category="Member support · New request" title="A member needs a hand." logoDataUrl={logoDataUrl}>
    <EmailDetail label="From">{memberName}</EmailDetail>
    <EmailDetail label="Email">{memberEmail}</EmailDetail>
    <EmailDetail label="Topic" last>{topic}</EmailDetail>
    <Text style={{ ...emailStyles.label, marginTop: "28px" }}>Their message</Text>
    <Text style={{ ...emailStyles.body, whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>{message}</Text>
    <EmailAction href={`mailto:${memberEmail}`}>Reply to member</EmailAction>
    <Text style={{ ...emailStyles.muted, marginBottom: "20px" }}>Submitted through Support in the Inspire9 Hub.</Text>
  </EmailLayout>;
}
