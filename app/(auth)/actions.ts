"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { INDUCTION_STATUS, MEMBER_STATUS } from "@/lib/constants";
import { HUB_TIMEZONE } from "@/lib/datetime";
import {
  hasErrors,
  inductionStage,
  readInduction,
  readProfile,
  validateInduction,
  validateProfile,
  type FormState,
} from "@/lib/member-forms";
import { sendEmail } from "@/lib/email/send";
import { getLogoUrl } from "@/lib/email/logo";
import InductionSubmitted from "@/lib/email/templates/induction-submitted";
import { createElement } from "react";
import { friendlyAccountError, friendlyLoginError, friendlySignupError, NOTICES } from "@/lib/auth-notices";

const to = (path: string, key: "error" | "message", text: string) => `${path}?${key}=${encodeURIComponent(text)}`;

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Your session has ended. Sign in again to save changes." };

  const values = readProfile(formData);
  const errors = validateProfile(values);
  if (hasErrors(errors)) return { status: "error", message: "A couple of details need another look.", errors };

  const { error } = await supabase.from("members").update(values).eq("id", user.id);
  if (error) {
    console.error("[profile] update failed:", error.message);
    return { status: "error", message: "We couldn’t save your changes. Please try again." };
  }

  revalidatePath("/", "layout");
  return { status: "saved", values, savedAt: Date.now() };
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (authError || !authData.user) {
    return redirect(to("/login", "error", friendlyLoginError(authError?.message ?? "")));
  }

  const { data: adminRecord } = await supabase
    .from("admins")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  if (adminRecord?.role === "admin" || adminRecord?.role === "super_admin") {
    return redirect("/admin/approvals");
  }

  return redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  // Checked here as well as in the browser: this is a public endpoint.
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!name || name.length > 100) return redirect(to("/signup", "error", NOTICES.badName));
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return redirect(to("/signup", "error", NOTICES.badEmail));
  if (password.length < 8 || password.length > 128) return redirect(to("/signup", "error", NOTICES.shortPassword));

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
  if (error) return redirect(to("/signup", "error", friendlySignupError(error.message)));
  return redirect(to("/login", "message", NOTICES.created));
}

export async function sendPasswordReset(formData: FormData) {
  const email = (formData.get("email") as string)?.trim();
  if (!email)
    return redirect(to("/forgot-password", "error", NOTICES.noEmail));

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback?next=/reset-password`,
  });

  // Always redirect to success — never reveal whether an email exists in our DB
  return redirect("/forgot-password?sent=true");
}

export async function updatePassword(formData: FormData) {
  const password = formData.get("password") as string;
  const confirm = formData.get("confirm_password") as string;

  if (!password || password.length < 8)
    return redirect(to("/reset-password", "error", NOTICES.shortPassword));
  if (password !== confirm)
    return redirect(to("/reset-password", "error", NOTICES.mismatch));

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) return redirect(to("/reset-password", "error", friendlyAccountError(error.message)));

  await supabase.auth.signOut();
  return redirect(to("/login", "message", NOTICES.passwordUpdated));
}

export async function submitInduction(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Your session has ended. Sign in again to continue." };

  // Only once: resubmitting would reset an approved member back to inactive.
  const { data: member } = await supabase
    .from("members")
    .select("induction_status")
    .eq("id", user.id)
    .maybeSingle();
  if (inductionStage(member?.induction_status) !== "not_started") redirect("/induction");

  const values = readInduction(formData);
  const errors = validateInduction(values);
  if (hasErrors(errors)) return { status: "error", message: "A few details need another look.", errors };

  //update Member Table
  const { error: memberError } = await supabase
    .from("members")
    .update({
      full_name: values.full_name,
      mobile_number: values.mobile_number,
      company_name: values.company_name,
      induction_status: INDUCTION_STATUS.SUBMITTED,
      member_status: MEMBER_STATUS.INACTIVE,
    })
    .eq("id", user.id);
  if (memberError) {
    console.error("[induction] member update failed:", memberError.message);
    return { status: "error", message: "We couldn’t submit your induction. Please try again." };
  }

  //upsert Induction Record (Prevents Duplicate Key Errors)
  const { error: recordError } = await supabase
    .from("induction_records")
    .upsert(
      {
        member_id: user.id,
        // Melbourne's date: a morning submission shouldn't be filed under yesterday.
        completion_date: new Intl.DateTimeFormat("en-CA", { timeZone: HUB_TIMEZONE }).format(new Date()),
        acknowledged_terms: values.acknowledged_terms,
        health_emergency_info: values.health_emergency_info,
        approval_status: "Pending",
      },
      { onConflict: "member_id" },
    );

  if (recordError) {
    console.error("[induction] record upsert failed:", recordError.message);
    // Undo the status change so they can try again.
    await supabase.from("members").update({ induction_status: INDUCTION_STATUS.PENDING }).eq("id", user.id);
    return { status: "error", message: "We couldn’t submit your induction. Please try again." };
  }

  // Send confirmation email — non-blocking
  try {
    if (user.email) {
      await sendEmail({
        to: user.email,
        subject: "We've received your induction — Inspire9 Hub",
        react: createElement(InductionSubmitted, {
          memberName: values.full_name || "Member",
          memberEmail: user.email,
          dashboardUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
          logoDataUrl: getLogoUrl(),
        }),
      });
    }
  } catch (emailErr) {
    console.error("[induction] Submitted confirmation email failed:", emailErr);
  }

  revalidatePath("/", "layout");
  redirect("/induction");
}
