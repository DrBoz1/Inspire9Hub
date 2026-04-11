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

  const full_name = formData.get("full_name") as string;
  const company = formData.get("company") as string;

  const { error } = await supabase
    .from("members")
    .update({ full_name, company_name: company })
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

  // Role-Based Redirection Check
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

  const { error: memberError } = await supabase
    .from("members")
    .update({
      full_name: formData.get("full_name") as string,
      mobile_number: formData.get("mobile_number") as string,
      company_name: formData.get("company_name") as string,
      induction_status: INDUCTION_STATUS.SUBMITTED,
      member_status: MEMBER_STATUS.INACTIVE,
    })
    .eq("id", user.id);

  if (memberError)
    return redirect(
      `/induction?error=${encodeURIComponent(memberError.message)}`,
    );

  const { error: recordError } = await supabase
    .from("induction_records")
    .insert({
      member_id: user.id,
      completion_date: new Date().toISOString().split("T")[0],
      acknowledged_terms: formData.get("acknowledged_terms") === "on",
      health_emergency_info: formData.get("health_emergency_info") as string,
      approval_status: "Pending",
    });

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

  revalidatePath("/admin/approvals");
  revalidatePath("/dashboard");
}

export async function rejectInduction(formData: FormData) {
  const supabase = await createClient();
  const memberId = formData.get("memberId") as string;
  await supabase.from("induction_records").delete().eq("member_id", memberId);
  revalidatePath("/admin/approvals");
  revalidatePath("/dashboard");
}
