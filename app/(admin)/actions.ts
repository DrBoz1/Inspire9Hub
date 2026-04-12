"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { INDUCTION_STATUS, MEMBER_STATUS } from "@/lib/constants";

export async function approveInduction(formData: FormData) {
  const supabase = await createClient();
  const memberId = formData.get("memberId") as string;

  // 1. Update the record
  await supabase
    .from("induction_records")
    .update({ approval_status: "Approved" })
    .eq("member_id", memberId);

  // 2. Fetch contact info
  const { data: member } = await supabase
    .from("members")
    .select("mobile_number")
    .eq("id", memberId)
    .single();

  // 3. Promote Member
  await supabase
    .from("members")
    .update({
      induction_status: INDUCTION_STATUS.COMPLETE,
      member_status: MEMBER_STATUS.ACTIVE,
    })
    .eq("id", memberId);

  // 4. Log to History
  await supabase.from("community_entries").insert({
    member_id: memberId,
    member_contact: member?.mobile_number || "No contact",
    tags: "Approved",
    entry_date: new Date().toISOString().split("T")[0],
  });

  revalidatePath("/admin/approvals");
  revalidatePath("/admin/history");
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

  // 1. Set status to Rejected instead of deleting (so it shows in history)
  await supabase
    .from("members")
    .update({
      induction_status: "Rejected",
      member_status: "Inactive",
    })
    .eq("id", memberId);

  // 2. Log Rejection to History
  const { data: member } = await supabase
    .from("members")
    .select("mobile_number")
    .eq("id", memberId)
    .single();

  await supabase.from("community_entries").insert({
    member_id: memberId,
    member_contact: member?.mobile_number || "No contact",
    tags: "Rejected",
    entry_date: new Date().toISOString().split("T")[0],
  });

  revalidatePath("/admin/approvals");
  revalidatePath("/admin/history");
}
