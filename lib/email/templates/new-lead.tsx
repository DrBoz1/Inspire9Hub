import { Text } from "@react-email/components";
import { EmailAction, EmailDetail, EmailLayout, emailStyles } from "../components/email-layout";

export type NewLeadProps = {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  interest: string;
  teamSize: number | null;
  heardVia: string | null;
  message: string | null;
  source: string;
  /** They'd already enquired and are still an open lead. */
  repeat: boolean;
  /** Where to see the lead, or null if it couldn't be saved. */
  leadUrl: string | null;
  logoDataUrl?: string;
};

/** To staff, the moment someone enquires. Reply-To is the enquirer, so answering is one click. */
export default function NewLead({ name, email, phone, company, interest, teamSize, heardVia, message, source, repeat, leadUrl, logoDataUrl }: NewLeadProps) {
  const details: [string, string][] = [
    ["Name", name],
    ["Email", email],
    ...(phone ? ([["Phone", phone]] as [string, string][]) : []),
    ...(company ? ([["Company", company]] as [string, string][]) : []),
    ["Looking for", interest],
    ...(teamSize ? ([["Team size", String(teamSize)]] as [string, string][]) : []),
    ...(heardVia ? ([["Heard about us", heardVia]] as [string, string][]) : []),
    ["Came in through", source],
  ];
  return (
    <EmailLayout
      preview={`${repeat ? "Follow-up" : "New enquiry"} from ${name}: ${interest}`}
      category={repeat ? "Leads · Enquired again" : "Leads · New enquiry"}
      title={repeat ? `${name} got in touch again.` : "Someone wants to join."}
      logoDataUrl={logoDataUrl}
    >
      {details.map(([label, value], i) => (
        <EmailDetail key={label} label={label} last={i === details.length - 1}>{value}</EmailDetail>
      ))}
      {message && (
        <>
          <Text style={{ ...emailStyles.label, marginTop: "28px" }}>Their message</Text>
          <Text style={{ ...emailStyles.body, whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>{message}</Text>
        </>
      )}
      <EmailAction href={leadUrl ?? `mailto:${email}`}>{leadUrl ? "Open the lead" : `Reply to ${name}`}</EmailAction>
      <Text style={{ ...emailStyles.muted, marginBottom: "20px" }}>
        {leadUrl
          ? "Reply to this email to answer them directly. Log the reply on the lead so the team can see it."
          : "This enquiry couldn’t be saved to the leads board, so this email is the only copy. Reply to answer them directly."}
      </Text>
    </EmailLayout>
  );
}
