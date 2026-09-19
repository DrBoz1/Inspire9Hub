import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { sendPasswordReset } from "../actions";
import { AuthAlert } from "../AuthAlert";
import { safeNotice } from "@/lib/auth-notices";
import { SubmitButton, TextField } from "../AuthUi";

export const metadata: Metadata = { title: "Reset your password | Inspire9 Hub" };

type SearchParams = Promise<{ error?: string; sent?: string }>;

export default async function ForgotPasswordPage(props: { searchParams: SearchParams }) {
  const { error, sent } = await props.searchParams;

  if (sent) {
    return (
      <div className="auth-page" role="status">
        <span className="auth-sent-mark"><MailCheck size={22} strokeWidth={1.8} aria-hidden /></span>
        <header className="auth-heading">
          <p className="auth-eyebrow">Link sent</p>
          <h1>Check your inbox<span className="auth-red">.</span></h1>
          <p>If an account exists for that email, a reset link is on its way. It expires in 1 hour.</p>
        </header>
        <p className="auth-footnote auth-footnote-left">
          Nothing yet? Check your spam folder, or <Link href="/forgot-password">send another link</Link>.
        </p>
        <Link href="/login" className="auth-secondary">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <Link href="/login" className="auth-back"><ArrowLeft size={14} aria-hidden /> Back to sign in</Link>
      <header className="auth-heading">
        <p className="auth-eyebrow">Account recovery</p>
        <h1>Forgot your password<span className="auth-red">?</span></h1>
        <p>Enter the email you signed up with and we&apos;ll send you a link to set a new one.</p>
      </header>
      {error && <div className="auth-notices"><AuthAlert type="error" message={safeNotice(error)!} /></div>}
      <form action={sendPasswordReset} className="auth-form">
        <TextField id="reset-email" name="email" type="email" label="Email" icon="mail" autoComplete="email" placeholder="you@company.com" required />
        <SubmitButton pendingLabel="Sending your link…">Send reset link</SubmitButton>
      </form>
    </div>
  );
}
