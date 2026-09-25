import { Text } from "@react-email/components";
import { EmailDetail, EmailLayout, EmailNote, emailStyles } from "../components/email-layout";

export type SystemAlertProps = {
  /** The kind of problem, for the category line: "Billing needs a person". */
  label: string;
  /** What happened, in one line. */
  headline: string;
  /** The facts someone needs to act: ids, emails, amounts. */
  facts: [string, string][];
  /** What to do about it, when there's something specific. */
  action: string | null;
  logoDataUrl?: string;
};

/**
 * To the team inbox, when something needs a person rather than a retry. Written
 * to be read on a phone in ten seconds: what broke, the ids to look it up with,
 * and what to do. No links into the app, because the fix is usually in Stripe.
 */
export default function SystemAlert({ label, headline, facts, action, logoDataUrl }: SystemAlertProps) {
  return (
    <EmailLayout preview={headline} category={`Hub · ${label}`} title={headline} logoDataUrl={logoDataUrl}>
      <Text style={emailStyles.body}>
        The hub carried on as normal — members aren’t stuck on an error — but this one needs someone to
        look at it.
      </Text>
      {facts.map(([fact, value], i) => (
        <EmailDetail key={fact} label={fact} last={i === facts.length - 1}>{value}</EmailDetail>
      ))}
      {action && <EmailNote label="What to do">{action}</EmailNote>}
      <Text style={{ ...emailStyles.muted, marginBottom: "20px" }}>
        One email per problem per day. If it hasn’t been fixed, it will arrive again tomorrow.
      </Text>
    </EmailLayout>
  );
}
