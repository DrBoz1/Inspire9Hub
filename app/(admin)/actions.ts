"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { INDUCTION_STATUS, MEMBER_STATUS } from "@/lib/constants";

export async function approveInduction(formData: FormData) {
  const supabase = await createClient();
  const memberId = formData.get("memberId") as string;

  //fetch directly to avoid the joiny issues
  const { data: member } = await supabase
    .from("members")
    .select("mobile_number")
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

  revalidatePath("/admin/approvals");
  revalidatePath("/admin/history");
  revalidatePath("/dashboard");
}

export async function rejectInduction(formData: FormData) {
  const supabase = await createClient();
  const memberId = formData.get("memberId") as string;

  //fetch the data from the source before deleting
  const { data: member } = await supabase
    .from("members")
    .select("mobile_number")
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

export async function cancelBookingAsAdmin(bookingId: string) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("bookings")
    .update({ booking_status: "cancelled" })
    .eq("id", bookingId);

  if (error) {
    console.error("Admin cancel error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  return { success: true };
}

// Fetches full profile details for the member profile modal
export async function getMemberDetails(memberId: string) {
  const supabase = createAdminClient();

  const [bookingsRes, paymentsRes, passesRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, start_date_time, end_date_time, booking_status, workspaces(name)")
      .eq("member_id", memberId)
      .order("start_date_time", { ascending: false })
      .limit(10),

    supabase
      .from("payments")
      .select("id, amount, payment_date, payment_status, payment_method")
      .eq("member_id", memberId)
      .order("payment_date", { ascending: false })
      .limit(10),

    supabase
      .from("access_passes")
      .select("id, issued_date, expiry_date, pass_type, pass_status")
      .eq("member_id", memberId)
      .order("issued_date", { ascending: false })
      .limit(5),
  ]);

  return {
    bookings: bookingsRes.data ?? [],
    payments: paymentsRes.data ?? [],
    passes: passesRes.data ?? [],
  };
}
