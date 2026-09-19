import type { Metadata } from "next";
import { AuthForms } from "../AuthForms";
import { safeNotice } from "@/lib/auth-notices";

export const metadata: Metadata = { title: "Join | Inspire9 Hub" };

type SearchParams = Promise<{ error?: string; message?: string }>;

export default async function SignupPage(props: { searchParams: SearchParams }) {
  const { error, message } = (await props.searchParams) ?? {};
  return <AuthForms initialMode="signup" error={safeNotice(error)} message={safeNotice(message)} />;
}
