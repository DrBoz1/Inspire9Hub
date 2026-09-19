import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthAlert } from "../AuthAlert";
import { safeNotice } from "@/lib/auth-notices";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Set a new password | Inspire9 Hub" };

type SearchParams = Promise<{ error?: string; from?: string }>;

export default async function ResetPasswordPage(props: { searchParams: SearchParams }) {
  const { error, from } = await props.searchParams;
  // Signed-in members arrive from their profile; everyone else from a reset email.
  const fromProfile = from === "profile";

  return (
    <div className="auth-page">
      <Link href={fromProfile ? "/profile" : "/login"} className="auth-back">
        <ArrowLeft size={14} aria-hidden /> {fromProfile ? "Back to your profile" : "Back to sign in"}
      </Link>
      <header className="auth-heading">
        <p className="auth-eyebrow">{fromProfile ? "Your account" : "Account recovery"}</p>
        <h1>{fromProfile ? "Change your password" : "Set a new password"}<span className="auth-red">.</span></h1>
        <p>Pick one you don&apos;t use anywhere else. You&apos;ll sign in again once it&apos;s saved.</p>
      </header>
      {error && <div className="auth-notices"><AuthAlert type="error" message={safeNotice(error)!} /></div>}
      <ResetPasswordForm />
    </div>
  );
}
