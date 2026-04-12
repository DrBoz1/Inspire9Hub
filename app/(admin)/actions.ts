"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { INDUCTION_STATUS, MEMBER_STATUS } from "@/lib/constants";

export async function approveInduction(formData: FormData) {
  const supabase = await createClient();
  const memberId = formData.get("memberId") as string;

  // 1. Update the record status
  await supabase
    .from("induction_records")
    .update({ approval_status: "Approved" })
    .eq("member_id", memberId);

  // 2. Fetch contact info for the log
  const { data: member } = await supabase
    .from("members")
    .select("mobile_number")
    .eq("id", memberId)
    .single();

  // 3. Promote Member to Active/Complete
  await supabase
    .from("members")
    .update({
      induction_status: INDUCTION_STATUS.COMPLETE,
      member_status: MEMBER_STATUS.ACTIVE,
    })
    .eq("id", memberId);

  // 4. Log to Community Entries (History) with DYNAMIC date
  await supabase.from("community_entries").insert({
    member_id: memberId,
    member_contact: member?.mobile_number || "No contact",
    tags: "Approved",
    entry_date: new Date().toISOString().split("T")[0], // Dynamic: Today's date
  });

  revalidatePath("/admin/approvals");
  revalidatePath("/admin/history");
  revalidatePath("/dashboard");
}

export async function rejectInduction(formData: FormData) {
  const supabase = await createClient();
  const memberId = formData.get("memberId") as string;

  // 1. Fetch contact info BEFORE we start changing things
  const { data: m } = await supabase
    .from("members")
    .select("mobile_number")
    .eq("id", memberId)
    .single();

  // 2. Reset member status to Pending
  // This makes the "Start Induction" button reappear for them
  await supabase
    .from("members")
    .update({
      induction_status: INDUCTION_STATUS.PENDING,
      member_status: MEMBER_STATUS.INACTIVE,
    })
    .eq("id", memberId);

  // 3. CRITICAL FIX: Delete the old induction record
  await supabase.from("induction_records").delete().eq("member_id", memberId);

  // 4. Log to Audit Trail with DYNAMIC date
  await supabase.from("community_entries").insert({
    member_id: memberId,
    member_contact: m?.mobile_number || "N/A",
    tags: "Rejected",
    entry_date: new Date().toISOString().split("T")[0], // Dynamic: Date of rejection
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
