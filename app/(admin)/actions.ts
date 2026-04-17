"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { INDUCTION_STATUS, MEMBER_STATUS } from "@/lib/constants";

export async function approveInduction(formData: FormData) {
  const supabase = await createClient();
  const memberId = formData.get("memberId") as string;

  // 1. Fetch data for history before updating
  const { data: member } = await supabase
    .from("members")
    .select("mobile_number, induction_records(health_emergency_info)")
    .eq("id", memberId)
    .single();

  const medicalData =
    member?.induction_records?.[0]?.health_emergency_info || "None provided";

  // 2. Update status to Approved
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

  // 3. Log to History (Saving the medical info here prevents "N/A")
  await supabase.from("community_entries").insert({
    member_id: memberId,
    member_contact: member?.mobile_number || "No contact",
    tags: "Approved",
    entry_description: medicalData,
    entry_date: new Date().toISOString().split("T")[0],
  });

  revalidatePath("/admin/approvals");
  revalidatePath("/admin/history");
}

export async function rejectInduction(formData: FormData) {
  const supabase = await createClient();
  const memberId = formData.get("memberId") as string;

  // 1. Fetch data for history BEFORE deleting
  const { data: m } = await supabase
    .from("members")
    .select("mobile_number, induction_records(health_emergency_info)")
    .eq("id", memberId)
    .single();

  const medicalData =
    m?.induction_records?.[0]?.health_emergency_info || "None provided";

  // 2. Reset member to Pending so they can redo the form
  await supabase
    .from("members")
    .update({
      induction_status: INDUCTION_STATUS.PENDING,
      member_status: MEMBER_STATUS.INACTIVE,
    })
    .eq("id", memberId);

  // 3. Delete record so they can start fresh (stops spamming/errors)
  await supabase.from("induction_records").delete().eq("member_id", memberId);

  // 4. Log rejection with medical info saved in history description
  await supabase.from("community_entries").insert({
    member_id: memberId,
    member_contact: m?.mobile_number || "N/A",
    tags: "Rejected",
    entry_description: medicalData,
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
