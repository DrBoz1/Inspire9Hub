import { Resend } from "resend";

// Single shared Resend instance — import this everywhere
export const resend = new Resend(process.env.RESEND_API_KEY!);

// Verified "from" address. During development Resend allows onboarding@resend.dev.
// In production: set RESEND_FROM_EMAIL="Inspire9 Hub <bookings@yourdomain.com>"
export const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL ?? "Inspire9 Hub <onboarding@resend.dev>";
