import { Text } from "@react-email/components";
import { EmailAction, EmailDetail, EmailLayout, EmailNote, emailStyles, firstName } from "../components/email-layout";

export type StaffAccessProps = {
  memberName: string;
  memberEmail: string;
  /** "Admin" or "Super admin". */
  roleLabel: string;
  adminUrl: string;
  logoDataUrl?: string;
};

export default function StaffAccess({ memberName, memberEmail, roleLabel, adminUrl, logoDataUrl }: StaffAccessProps) {
  return <EmailLayout preview={`You now have ${roleLabel.toLowerCase()} access to the Inspire9 Hub.`} category="Your account · Staff access" title="You’re on the team." logoDataUrl={logoDataUrl} recipient={memberEmail}>
    <Text style={emailStyles.body}>Hi {firstName(memberName)}, you now have staff access to the Inspire9 Hub. Sign in with the same email and password you use now, and the admin area opens up.</Text>
    <EmailDetail label="Access">{roleLabel}</EmailDetail>
    <EmailDetail label="Account" last>{memberEmail}</EmailDetail>
    <EmailAction href={adminUrl}>Open the admin</EmailAction>
    <EmailNote label="Didn’t expect this?">Reply to this email and we’ll switch it off. Nobody can use it without your password.</EmailNote>
  </EmailLayout>;
}
