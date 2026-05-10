"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: admin } = await supabase
    .from("admins")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!admin) throw new Error("Admin access required");
  return { user, admin };
}

export async function createAnnouncement(formData: FormData) {
  const { user } = await requireAdmin();

  const title = formData.get("title") as string;
  const message = formData.get("message") as string;
  const type = formData.get("type") as string;
  const expiresAt = formData.get("expires_at") as string | null;

  if (!title?.trim() || !message?.trim() || !type) {
    throw new Error("Title, message and type are required.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("announcements").insert({
    title: title.trim(),
    message: message.trim(),
    type,
    status: "active",
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    created_by: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/announcements");
  revalidatePath("/dashboard");
}

export async function archiveAnnouncement(id: string) {
  await requireAdmin();

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("announcements")
    .update({ status: "archived" })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/announcements");
  revalidatePath("/dashboard");
}

export async function restoreAnnouncement(id: string) {
  await requireAdmin();

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("announcements")
    .update({ status: "active" })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/announcements");
  revalidatePath("/dashboard");
}

export async function deleteAnnouncement(id: string) {
  await requireAdmin();

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/announcements");
}
