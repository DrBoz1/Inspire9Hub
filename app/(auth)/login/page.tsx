import type { Metadata } from "next";
import { AuthForms } from "../AuthForms";
import { safeNotice } from "@/lib/auth-notices";

export const metadata: Metadata = { title: "Sign in | Inspire9 Hub" };

type SearchParams = Promise<{ error?: string; message?: string }>;

export default async function LoginPage(props: { searchParams: SearchParams }) {
  const { error, message } = (await props.searchParams) ?? {};
  return <AuthForms initialMode="login" error={safeNotice(error)} message={safeNotice(message)} />;
}
