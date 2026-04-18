"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { INDUCTION_STATUS, MEMBER_STATUS } from "@/lib/constants";

export async function approveInduction(formData: FormData) {
  const supabase = await createClient();
  const memberId = formData.get("memberId") as string;

  //N/A issue fix (copefully)
  const { data: member } = await supabase
    .from("members")
    .select("mobile_number, induction_records(health_emergency_info)")
    .eq("id", memberId)
    .single();

  const medicalData =
    member?.induction_records?.[0]?.health_emergency_info || "None provided";

  //update approval status
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

  //log to community entries
  await supabase.from("community_entries").insert({
    member_id: memberId,
    member_contact: member?.mobile_number || "No contact",
    tags: "Approved",
    entry_type: "Induction",
    entry_description: medicalData, //pls work
    entry_date: new Date().toISOString().split("T")[0],
  });

  revalidatePath("/admin/approvals");
  revalidatePath("/admin/history");
  revalidatePath("/dashboard");
}

export async function rejectInduction(formData: FormData) {
  const supabase = await createClient();
  const memberId = formData.get("memberId") as string;

  //fetching the data from the history before deleting it
  const { data: m } = await supabase
    .from("members")
    .select("mobile_number, induction_records(health_emergency_info)")
    .eq("id", memberId)
    .single();

  const medicalData =
    m?.induction_records?.[0]?.health_emergency_info || "None provided";

  await supabase
    .from("members")
    .update({
      induction_status: INDUCTION_STATUS.PENDING,
      member_status: MEMBER_STATUS.INACTIVE,
    })
    .eq("id", memberId);

  await supabase.from("induction_records").delete().eq("member_id", memberId);

  //log the rejection to permanent history
  await supabase.from("community_entries").insert({
    member_id: memberId,
    member_contact: m?.mobile_number || "N/A",
    tags: "Rejected",
    entry_type: "Induction",
    entry_description: medicalData,
    entry_date: new Date().toISOString().split("T")[0],
  });

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
