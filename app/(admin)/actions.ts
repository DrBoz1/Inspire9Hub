"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { INDUCTION_STATUS, MEMBER_STATUS } from "@/lib/constants";
import { sendEmail } from "@/lib/email/send";
import { getLogoUrl } from "@/lib/email/logo";
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
          logoDataUrl: getLogoUrl(),
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
          logoDataUrl: getLogoUrl(),
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
  const role = formData.get("role") as string;

  if (role !== "admin" && role !== "super_admin")
    throw new Error("Invalid role selected.");

  const { data: member } = await supabase
    .from("members")
    .select("email")
    .eq("id", userId)
    .single();

  if (!member)
    throw new Error("This UUID does not belong to a registered member.");

  const { error } = await supabase.from("admins").insert({
    id: userId,
    full_name: name,
    email: member.email,
    role,
    active_status: "Active",
  });
  if (error) throw error;

  revalidatePath("/admin/management");
}

export async function revokeAdminAccess(adminId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return { success: false, message: "Your session expired — sign in again." };

  // Middleware already gates /admin/management, but a server action is its own
  // public endpoint — re-check the caller's role here rather than trusting it.
  const { data: actor } = await supabase
    .from("admins")
    .select("role")
    .eq("id", user.id)
    .single();

  if (actor?.role !== "super_admin")
    return { success: false, message: "Only a super admin can revoke access." };

  if (adminId === user.id)
    return { success: false, message: "You can't revoke your own access." };

  const { data: target } = await supabase
    .from("admins")
    .select("role")
    .eq("id", adminId)
    .single();

  if (!target)
    return { success: false, message: "That admin record no longer exists." };

  // Never leave the hub with nobody able to reach this page
  if (target.role === "super_admin") {
    const { count } = await supabase
      .from("admins")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin");

    if ((count ?? 0) <= 1)
      return {
        success: false,
        message: "That's the last super admin — promote someone else first.",
      };
  }

  // super_admins.admin_id references admins.id, so clear the child row first or
  // the delete below trips a foreign key violation.
  await supabase.from("super_admins").delete().eq("admin_id", adminId);

  const { data: deleted, error } = await supabase
    .from("admins")
    .delete()
    .eq("id", adminId)
    .select("id");

  if (error) {
    console.error("[revokeAdminAccess]", error.message);
    return { success: false, message: error.message };
  }

  // A delete blocked by row-level security returns no error *and* no rows —
  // report that instead of a success that never happened.
  if (!deleted?.length)
    return {
      success: false,
      message: "The database rejected that delete (row-level security).",
    };

  revalidatePath("/admin/management");
  return { success: true };
}

/**
 * `public.admins` has no foreign key to `auth.users`, so deleting a login from the
 * Supabase Auth dashboard leaves its admins row behind. Those rows can never sign
 * in but still appear on the roster. This removes them.
 *
 * The ids arrive from the client, so every one is re-verified against Auth here —
 * a row is only deleted once Supabase confirms the login account is really gone.
 */
export async function purgeOrphanedAdmins(adminIds: string[]) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return { success: false, message: "Your session expired — sign in again." };

  const { data: actor } = await supabase
    .from("admins")
    .select("role")
    .eq("id", user.id)
    .single();

  if (actor?.role !== "super_admin")
    return { success: false, message: "Only a super admin can do that." };

  const authAdmin = createAdminClient();
  const confirmed: string[] = [];

  for (const id of adminIds) {
    if (id === user.id) continue; // never purge the signed-in account
    const { data } = await authAdmin.auth.admin.getUserById(id);
    if (!data?.user) confirmed.push(id); // no login account -> genuinely orphaned
  }

  if (!confirmed.length)
    return {
      success: false,
      message: "Those records still have active login accounts.",
    };

  await supabase.from("super_admins").delete().in("admin_id", confirmed);

  const { data: deleted, error } = await supabase
    .from("admins")
    .delete()
    .in("id", confirmed)
    .select("id");

  if (error) {
    console.error("[purgeOrphanedAdmins]", error.message);
    return { success: false, message: error.message };
  }

  if (!deleted?.length)
    return {
      success: false,
      message: "The database rejected that delete (row-level security).",
    };

  revalidatePath("/admin/management");
  return { success: true, removed: deleted.length };
}
