"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { INDUCTION_STATUS, MEMBER_STATUS } from "@/lib/constants";

export async function approveInduction(formData: FormData) {
  const supabase = await createClient();
  const memberId = formData.get("memberId") as string;

  // 1. Update the record to Approved
  const { error: recordError } = await supabase
    .from("induction_records")
    .update({ approval_status: "Approved" })
    .eq("member_id", memberId);

  if (recordError) throw new Error(recordError.message);

  // 2. Promote Member to Active
  const { error: memberError } = await supabase
    .from("members")
    .update({
      induction_status: INDUCTION_STATUS.COMPLETE,
      member_status: MEMBER_STATUS.ACTIVE,
    })
    .eq("id", memberId);

  if (memberError) throw new Error(memberError.message);

  // 3. Add to Community Entries table
  const { error: communityError } = await supabase
    .from("community_entries")
    .insert({
      member_id: memberId,
      entry_type: "Induction Approved",
      entry_description:
        "Member successfully completed site induction and was approved by admin.",
    });

  if (communityError)
    console.error("Community Entry Error:", communityError.message);

  revalidatePath("/admin/approvals");
  revalidatePath("/admin/history");
  revalidatePath("/dashboard");
}

export async function createAdmin(formData: FormData) {
  const supabase = await createClient();

  const adminData = {
    id: formData.get("user_id"),
    full_name: formData.get("name"),
    email: formData.get("email"),
    role: "admin",
    active_status: "Active",
  };

  const { error } = await supabase.from("admins").insert(adminData);
  if (error) throw error;

  revalidatePath("/admin/users");
}

export async function rejectInduction(formData: FormData) {
  const supabase = await createClient();
  const memberId = formData.get("memberId") as string;

  await supabase.from("induction_records").delete().eq("member_id", memberId);

  revalidatePath("/admin/approvals");
  revalidatePath("/dashboard");
}
