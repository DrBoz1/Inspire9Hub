"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { INDUCTION_STATUS, MEMBER_STATUS } from "@/lib/constants";
import { sendEmail } from "@/lib/email/send";
import { getLogoDataUrl } from "@/lib/email/logo";
import InductionApproved from "@/lib/email/templates/induction-approved";
import InductionRejected from "@/lib/email/templates/induction-rejected";
import { createElement } from "react";

export async function approveInduction(formData: FormData) {
  const supabase = await createClient();
  const memberId = formData.get("memberId") as string;

  //fetch directly to avoid the joiny issues — include email + name for notification
  const { data: member } = await supabase
    .from("members")
    .select("mobile_number, email, full_name")
    .eq("id", memberId)
    .single();

  const { data: induction } = await supabase
    .from("induction_records")
    .select("health_emergency_info")
    .eq("member_id", memberId)
    .single();

  const medicalData = induction?.health_emergency_info || "None provided";

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

  //log to history
  await supabase.from("community_entries").insert({
    member_id: memberId,
    member_contact: member?.mobile_number || "No contact",
    tags: "Approved",
    entry_type: "Induction",
    entry_description: medicalData,
    entry_date: new Date().toISOString().split("T")[0],
  });

  // Send approval email — non-blocking
  try {
    if (member?.email) {
      await sendEmail({
        to: member.email,
        subject: "You're approved — welcome to the Hub! ✓",
        react: createElement(InductionApproved, {
          memberName: member.full_name || "Member",
          memberEmail: member.email,
          bookingsUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/bookings`,
          logoDataUrl: getLogoDataUrl(),
        }),
      });
    }
  } catch (emailErr) {
    console.error("[induction] Approval email failed:", emailErr);
  }

  revalidatePath("/admin/approvals");
  revalidatePath("/admin/history");
  revalidatePath("/dashboard");
}

export async function rejectInduction(formData: FormData) {
  const supabase = await createClient();
  const memberId = formData.get("memberId") as string;

  //fetch the data from the source before deleting — include email + name for notification
  const { data: member } = await supabase
    .from("members")
    .select("mobile_number, email, full_name")
    .eq("id", memberId)
    .single();

  const { data: induction } = await supabase
    .from("induction_records")
    .select("health_emergency_info")
    .eq("member_id", memberId)
    .single();

  const medicalData = induction?.health_emergency_info || "None provided";

  //reset member status
  await supabase
    .from("members")
    .update({
      induction_status: INDUCTION_STATUS.PENDING,
      member_status: MEMBER_STATUS.INACTIVE,
    })
    .eq("id", memberId);

  // 3. Delete the record
  await supabase.from("induction_records").delete().eq("member_id", memberId);

  //log rejection with persistent medical data
  await supabase.from("community_entries").insert({
    member_id: memberId,
    member_contact: member?.mobile_number || "N/A",
    tags: "Rejected",
    entry_type: "Induction",
    entry_description: medicalData,
    entry_date: new Date().toISOString().split("T")[0],
  });

  // Send rejection email — non-blocking
  try {
    if (member?.email) {
      await sendEmail({
        to: member.email,
        subject: "Your induction needs attention — Inspire9 Hub",
        react: createElement(InductionRejected, {
          memberName: member.full_name || "Member",
          memberEmail: member.email,
          inductionUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/induction`,
          logoDataUrl: getLogoDataUrl(),
        }),
      });
    }
  } catch (emailErr) {
    console.error("[induction] Rejection email failed:", emailErr);
  }

  revalidatePath("/admin/approvals");
  revalidatePath("/admin/history");
  revalidatePath("/dashboard");
}

export async function createAdmin(formData: FormData) {
  const supabase = await createClient();
  const userId = formData.get("user_id") as string;
  const name = formData.get("name") as string;

  // 1. Automatically fetch the REAL email from the members table using the UUID
  const { data: member } = await supabase
    .from("members")
    .select("email")
    .eq("id", userId)
    .single();

  if (!member)
    throw new Error("This UUID does not belong to a registered member.");

  const adminData = {
    id: userId,
    full_name: name,
    email: member.email, // Use the real email from the members table
    role: "admin",
    active_status: "Active",
  };

  const { error } = await supabase.from("admins").insert(adminData);
  if (error) throw error;

  revalidatePath("/admin/management");
}

export async function revokeAdminAccess(adminId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("admins").delete().eq("id", adminId);

  if (error) {
    console.error("Revoke Error:", error.message);
    return { success: false, message: error.message };
  }

  revalidatePath("/admin/management");
  return { success: true };
}
