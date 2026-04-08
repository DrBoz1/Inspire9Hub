"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { INDUCTION_STATUS } from "@/lib/constants";

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

  const full_name = formData.get("full_name") as string;
  const company = formData.get("company") as string;

  const { error } = await supabase
    .from("members")
    .update({
      full_name,
      company_name: company,
    })
    .eq("id", user.id);

  if (error) {
    console.error("Supabase Error:", error.message);
    return;
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function login(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    return redirect("/login?error=Could not authenticate user");
  }

  return redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      data: {
        full_name: formData.get("name") as string,
      },
    },
  };

  const { error } = await supabase.auth.signUp(data);
  if (error) {
    return redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }
  return redirect("/login?message=Check email to confirm registration");
}

export async function submitInduction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const full_name = formData.get("full_name") as string;
  const mobile_number = formData.get("mobile_number") as string;
  const company_name = formData.get("company_name") as string;
  const health_emergency_info = formData.get("health_emergency_info") as string;
  const acknowledged_terms = formData.get("acknowledged_terms") === "on";

  // 1. Update existing Member record
  const { error: memberError } = await supabase
    .from("members")
    .update({
      full_name,
      mobile_number,
      company_name,
      induction_status: INDUCTION_STATUS.COMPLETE,
    })
    .eq("id", user.id);

  if (memberError)
    return redirect(
      `/induction?error=${encodeURIComponent(memberError.message)}`,
    );

  // 2. Insert Induction Record linked to Member
  const { error: recordError } = await supabase
    .from("induction_records")
    .insert({
      member_id: user.id,
      completion_date: new Date().toISOString().split("T")[0],
      acknowledged_terms,
      health_emergency_info,
      approval_status: "Approved",
    });

  if (recordError)
    return redirect(
      `/induction?error=${encodeURIComponent(recordError.message)}`,
    );

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
