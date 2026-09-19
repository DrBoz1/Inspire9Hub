import { Text } from "@react-email/components";
import { EmailDetail, EmailLayout, EmailNote, emailStyles, firstName } from "../components/email-layout";

export type EnquiryReceivedProps = {
  name: string;
  email: string;
  /** The label, like "A dedicated desk". */
  interest: string;
  logoDataUrl?: string;
};

/**
 * The reply to someone who used the public enquiry form. A stranger chose the
 * address, so it repeats nothing they typed except their name: no message, no
 * company. That keeps the form from being used to send someone else a note.
 */
export default function EnquiryReceived({ name, email, interest, logoDataUrl }: EnquiryReceivedProps) {
  return <EmailLayout preview="Thanks for your enquiry. Someone from the team will be in touch soon." category="Your enquiry · Received" title="Thanks, we’ll be in touch." logoDataUrl={logoDataUrl} recipient={email}>
    <Text style={emailStyles.body}>Hi {firstName(name)}, thanks for asking about space at Inspire9. Someone from the team will get back to you soon.</Text>
    <EmailDetail label="You asked about" last>{interest}</EmailDetail>
    <EmailNote label="Come and see it">The best way to get a feel for the place is a quick tour. Reply with a day and time that suit you, and we’ll show you around.</EmailNote>
    <Text style={{ ...emailStyles.muted, marginBottom: "20px" }}>Didn’t send an enquiry? You can ignore this email; we won’t write again unless you do.</Text>
  </EmailLayout>;
}
