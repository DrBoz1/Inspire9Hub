import type { ReactElement } from "react";
import { resend, FROM_ADDRESS } from "./resend";

export type EmailAttachment = {
  filename: string;
  content: Buffer;
};

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  react: ReactElement;
  attachments?: EmailAttachment[];
};

// Universal send function — all email features across the app go through this.
// Add new templates in lib/email/templates/ and call sendEmail() from
// server actions, webhooks, or API routes.
export async function sendEmail({
  to,
  subject,
  react,
  attachments,
}: SendEmailOptions): Promise<void> {
  const recipients = Array.isArray(to) ? to : [to];

  // RESEND_TO_OVERRIDE routes every email to one address regardless of intended recipient.
  // Set this in .env.local during development so you can receive emails in your own inbox
  // without needing a verified domain. Leave it unset in production.
  const override = process.env.RESEND_TO_OVERRIDE;
  const finalRecipients = override ? [override] : recipients;

  if (override) {
    console.log(`[email] DEV override: routing to ${override} (intended: ${recipients.join(", ")})`);
  }

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: finalRecipients,
    subject,
    react,
    attachments: attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
    })),
  });

  if (error) {
    console.error("[email] Resend error:", error);
    throw new Error(`Email send failed: ${error.message}`);
  }
}
