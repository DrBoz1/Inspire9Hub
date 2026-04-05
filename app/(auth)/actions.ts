"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

  console.log("Updating profile for:", user.id);
  console.log("New Data:", { full_name, company });

  const { error } = await supabase
    .from("profiles")
    .update({ full_name, company })
    .eq("id", user.id);

  if (error) {
    console.error("Supabase Error:", error.message);
    return;
  }

  console.log("Update Successful!");
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

  const inductionData = {
    member_id: user.id,
    full_name: formData.get("full_name") as string,
    mobile_number: formData.get("mobile_number") as string,
    emergency_contact: formData.get("emergency_contact") as string,
  };

  //inserting into the existing induction_records table
  const { error: insertError } = await supabase
    .from("induction_records")
    .insert(inductionData);

  if (insertError) {
    console.error("Induction Insert Error:", insertError.message);
    return;
  }

  //updating the main profile status
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ induction_status: true })
    .eq("id", user.id);

  if (updateError) {
    console.error("Profile Update Error:", updateError.message);
    return;
  }

  // For cache refresh
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
