"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { INDUCTION_STATUS, MEMBER_STATUS } from "@/lib/constants";
import { sendEmail } from "@/lib/email/send";
import { getLogoUrl } from "@/lib/email/logo";
import InductionApproved from "@/lib/email/templates/induction-approved";
import InductionRejected from "@/lib/email/templates/induction-rejected";
import { createElement } from "react";
import { hubDateKey } from "@/lib/admin-dashboard";
import { isUuid } from "@/lib/admin-compliance";
import { requireAdmin } from "@/lib/admin-guard";
import { recordAudit } from "@/lib/audit";

type ActionResult = { error?: string };

function revalidateReviews() {
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard");
}

async function loadSubmission(supabase: Awaited<ReturnType<typeof createClient>>, memberId: string) {
  const [{ data: member }, { data: induction }] = await Promise.all([
    supabase.from("members").select("mobile_number, email, full_name, induction_status").eq("id", memberId).maybeSingle(),
    supabase.from("induction_records").select("health_emergency_info").eq("member_id", memberId).maybeSingle(),
  ]);
  return { member, medicalData: induction?.health_emergency_info || "None provided" };
}

export async function approveInduction(memberId: string): Promise<ActionResult> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };
  const { supabase } = guard;
  if (!isUuid(memberId)) return { error: "That member couldn’t be found." };

  const { member, medicalData } = await loadSubmission(supabase, memberId);
  if (!member) return { error: "That member couldn’t be found." };
  if (member.induction_status !== INDUCTION_STATUS.SUBMITTED) return { error: "This induction has already been reviewed." };

  const { error: recordError } = await supabase
    .from("induction_records")
    .update({ approval_status: "Approved" })
    .eq("member_id", memberId);
  if (recordError) {
    console.error("[approveInduction] record:", recordError.message);
    return { error: "Couldn’t approve this induction. Please try again." };
  }

  // A blocked update returns no error and no rows, so ask for the row back.
  const { data: updated, error: memberError } = await supabase
    .from("members")
    .update({
      induction_status: INDUCTION_STATUS.COMPLETE,
      member_status: MEMBER_STATUS.ACTIVE,
    })
    .eq("id", memberId)
    .select("id");
  if (memberError || !updated?.length) {
    console.error("[approveInduction] member:", memberError?.message ?? "no rows updated");
    return { error: "Couldn’t approve this induction. Please try again." };
  }

  //log to history
  const { error: logError } = await supabase.from("community_entries").insert({
    member_id: memberId,
    member_contact: member.mobile_number || "No contact",
    tags: "Approved",
    entry_type: "Induction",
    entry_description: medicalData,
    entry_date: hubDateKey(new Date()),
  });
  if (logError) console.error("[approveInduction] history:", logError.message);

  // community_entries records the member this happened to; this records the
  // member of staff who decided it, which is the half that was missing.
  await recordAudit({
    actor: { id: guard.user.id, email: guard.user.email },
    action: "induction.approve",
    entity: "member",
    entityId: memberId,
    summary: `Approved the induction for ${member.full_name?.trim() || member.email || "a member"}`,
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

  revalidateReviews();
  return {};
}

export async function rejectInduction(memberId: string): Promise<ActionResult> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };
  const { supabase } = guard;
  if (!isUuid(memberId)) return { error: "That member couldn’t be found." };

  //fetch the data from the source before deleting — include email + name for notification
  const { member, medicalData } = await loadSubmission(supabase, memberId);
  if (!member) return { error: "That member couldn’t be found." };
  if (member.induction_status !== INDUCTION_STATUS.SUBMITTED) return { error: "This induction has already been reviewed." };

  //reset member status
  const { data: updated, error: memberError } = await supabase
    .from("members")
    .update({
      induction_status: INDUCTION_STATUS.PENDING,
      member_status: MEMBER_STATUS.INACTIVE,
    })
    .eq("id", memberId)
    .select("id");
  if (memberError || !updated?.length) {
    console.error("[rejectInduction] member:", memberError?.message ?? "no rows updated");
    return { error: "Couldn’t reject this induction. Please try again." };
  }

  // Delete the record so they can start again; a leftover row is harmless, their next submission upserts it.
  const { error: deleteError } = await supabase.from("induction_records").delete().eq("member_id", memberId);
  if (deleteError) console.error("[rejectInduction] record:", deleteError.message);

  //log rejection with persistent medical data
  const { error: logError } = await supabase.from("community_entries").insert({
    member_id: memberId,
    member_contact: member.mobile_number || "N/A",
    tags: "Rejected",
    entry_type: "Induction",
    entry_description: medicalData,
    entry_date: hubDateKey(new Date()),
  });
  if (logError) console.error("[rejectInduction] history:", logError.message);

  await recordAudit({
    actor: { id: guard.user.id, email: guard.user.email },
    action: "induction.reject",
    entity: "member",
    entityId: memberId,
    summary: `Sent the induction back to ${member.full_name?.trim() || member.email || "a member"}`,
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

  revalidateReviews();
  return {};
}
