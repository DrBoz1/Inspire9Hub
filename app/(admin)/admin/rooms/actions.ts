"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { ALL_AMENITIES } from "@/lib/constants";

const VALID_AMENITY_KEYS = new Set<string>(ALL_AMENITIES.map((a) => a.key));
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data: admin } = await supabase
    .from("admins")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!admin || (admin.role !== "admin" && admin.role !== "super_admin")) {
    throw new Error("Admin access required.");
  }
}

// Server-side re-validation of every field — this is the same boundary that
// guards booking prices (see bookings/actions.ts). The client form is
// display-only; nothing it sends is trusted without these checks.
export async function updateRoomDetails(formData: FormData) {
  await requireAdmin();

  const roomId = formData.get("roomId") as string;
  if (!roomId) throw new Error("Missing room id.");

  const price = Number(formData.get("price_per_hour"));
  if (!Number.isFinite(price) || price <= 0 || price > 1000) {
    throw new Error("Price must be a number between $1 and $1000 per hour.");
  }

  const amenities = formData
    .getAll("amenities")
    .map(String)
    .filter((key) => VALID_AMENITY_KEYS.has(key));

  const showRating = formData.get("show_rating") === "true";

  // Default ON: a normal price edit moves the baseline with it, so nothing
  // changes from before this feature existed. Only when an admin explicitly
  // unchecks this (running a temporary promo) does price_per_hour drift below
  // the stored regular_price_per_hour and trigger the drop badge.
  const updateRegularPrice = formData.get("updateRegularPrice") === "true";

  const adminDb = createAdminClient();
  const update: {
    price_per_hour: number;
    amenities: string[];
    show_rating: boolean;
    image_url?: string;
    regular_price_per_hour?: number;
  } = {
    price_per_hour: price,
    amenities,
    show_rating: showRating,
  };
  if (updateRegularPrice) update.regular_price_per_hour = price;

  const file = formData.get("imageFile");
  if (file instanceof File && file.size > 0) {
    const ext = ALLOWED_IMAGE_TYPES[file.type];
    if (!ext) throw new Error("Image must be a PNG, JPEG, WEBP, or GIF file.");
    if (file.size > MAX_IMAGE_BYTES) throw new Error("Image must be smaller than 5MB.");

    const path = `${roomId}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await adminDb.storage
      .from("room-images")
      .upload(path, buffer, { contentType: file.type, upsert: true });
    if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

    const { data: publicUrlData } = adminDb.storage
      .from("room-images")
      .getPublicUrl(path);
    update.image_url = publicUrlData.publicUrl;
  }

  // Admin client bypasses RLS — authorization is already enforced by requireAdmin() above.
  const { error } = await adminDb.from("workspaces").update(update).eq("id", roomId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/rooms");
  revalidatePath("/bookings");

  return {
    image_url: update.image_url,
    regular_price_per_hour: update.regular_price_per_hour,
  };
}
