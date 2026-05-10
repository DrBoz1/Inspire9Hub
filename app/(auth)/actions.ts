"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { INDUCTION_STATUS, MEMBER_STATUS } from "@/lib/constants";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("members")
    .update({
      full_name: formData.get("full_name") as string,
      company_name: formData.get("company") as string,
    })
    .eq("id", user.id);

  if (error) return;
  revalidatePath("/", "layout");
  redirect("/dashboard");
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
    return redirect("/login?error=Could not authenticate user");
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
  const supabase = await createClient();
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      data: { full_name: formData.get("name") as string },
    },
  };

  const { error } = await supabase.auth.signUp(data);
  if (error)
    return redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  return redirect("/login?message=Check email to confirm registration");
}

export async function sendPasswordReset(formData: FormData) {
  const email = (formData.get("email") as string)?.trim();
  if (!email)
    return redirect("/forgot-password?error=Please enter your email address.");

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
    return redirect(
      "/reset-password?error=Password must be at least 8 characters.",
    );
  if (password !== confirm)
    return redirect("/reset-password?error=Passwords do not match.");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error)
    return redirect(
      `/reset-password?error=${encodeURIComponent(error.message)}`,
    );

  await supabase.auth.signOut();
  return redirect(
    "/login?message=Password updated successfully. Please sign in.",
  );
}

export async function submitInduction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  //update Member Table
  await supabase
    .from("members")
    .update({
      full_name: formData.get("full_name") as string,
      mobile_number: formData.get("mobile_number") as string,
      company_name: formData.get("company_name") as string,
      induction_status: INDUCTION_STATUS.SUBMITTED,
      member_status: MEMBER_STATUS.INACTIVE,
    })
    .eq("id", user.id);

  //upsert Induction Record (Prevents Duplicate Key Errors)
  const { error: recordError } = await supabase
    .from("induction_records")
    .upsert(
      {
        member_id: user.id,
        completion_date: new Date().toISOString().split("T")[0],
        acknowledged_terms: formData.get("acknowledged_terms") === "on",
        health_emergency_info: formData.get("health_emergency_info") as string,
        approval_status: "Pending",
      },
      { onConflict: "member_id" },
    );

  if (recordError)
    return redirect(
      `/induction?error=${encodeURIComponent(recordError.message)}`,
    );

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function approveInduction(formData: FormData) {
  const supabase = await createClient();
  const memberId = formData.get("memberId") as string;

  //fetch member info for the entry log
  const { data: m } = await supabase
    .from("members")
    .select("mobile_number")
    .eq("id", memberId)
    .single();

  //update status to Approved
  await supabase
    .from("induction_records")
    .update({ approval_status: "Approved" })
    .eq("member_id", memberId);
  await supabase
    .from("members")
    .update({
      induction_status: INDUCTION_STATUS.COMPLETE,
      member_status: MEMBER_STATUS.ACTIVE,
    })
    .eq("id", memberId);

  //log to COMMUNITY ENTRIES (Audit Trail)
  await supabase.from("community_entries").insert({
    member_id: memberId,
    member_contact: m?.mobile_number || "N/A",
    tags: "Approved",
    entry_date: new Date().toISOString().split("T")[0], // Dynamic Date
  });

  revalidatePath("/admin/approvals");
  revalidatePath("/admin/history");
}

export async function rejectInduction(formData: FormData) {
  const supabase = await createClient();
  const memberId = formData.get("memberId") as string;

  //fetch contact info
  const { data: m } = await supabase
    .from("members")
    .select("mobile_number")
    .eq("id", memberId)
    .single();

  //reset member to Pending so they can redo the form
  await supabase
    .from("members")
    .update({
      induction_status: INDUCTION_STATUS.PENDING,
      member_status: MEMBER_STATUS.INACTIVE,
    })
    .eq("id", memberId);

  //delete record so they start fresh (fixes resubmission spam)
  await supabase.from("induction_records").delete().eq("member_id", memberId);

  //log TO COMMUNITY ENTRIES (Audit Trail)
  await supabase.from("community_entries").insert({
    member_id: memberId,
    member_contact: m?.mobile_number || "N/A",
    tags: "Rejected",
    entry_date: new Date().toISOString().split("T")[0], // Dynamic Date
  });

  revalidatePath("/admin/approvals");
  revalidatePath("/admin/history");
}
