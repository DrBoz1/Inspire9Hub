"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { isUuid } from "@/lib/admin-compliance";
import { IMAGE_TYPES, checkImage, cleanAmenities, parsePrice } from "@/lib/admin-rooms";

export type RoomSaveResult = {
  error?: string;
  saved?: { price_per_hour: number; regular_price_per_hour: number | null; image_url: string | null; amenities: string[]; show_rating: boolean };
};

// Server-side re-validation of every field — this is the same boundary that
// guards booking prices (see bookings/actions.ts). The client form is
// display-only; nothing it sends is trusted without these checks.
// Problems come back as values, not thrown errors: Next hides thrown messages in production.
export async function updateRoomDetails(formData: FormData): Promise<RoomSaveResult> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };

  const roomId = formData.get("roomId");
  if (!isUuid(roomId)) return { error: "That space couldn’t be found." };

  const price = parsePrice(formData.get("price_per_hour"));
  if ("error" in price) return { error: price.error };

  // Default ON: a normal price edit moves the baseline with it. Only when an admin
  // switches this off (a temporary promo) does the price drift below
  // regular_price_per_hour and show the drop badge.
  const updateRegularPrice = formData.get("updateRegularPrice") === "true";

  const update: {
    price_per_hour: number;
    amenities: string[];
    show_rating?: boolean;
    image_url?: string;
    regular_price_per_hour?: number;
  } = { price_per_hour: price.value, amenities: cleanAmenities(formData.getAll("amenities")) };
  if (updateRegularPrice) update.regular_price_per_hour = price.value;
  const showRating = formData.get("show_rating");
  if (showRating === "true" || showRating === "false") update.show_rating = showRating === "true";

  const adminDb = createAdminClient();

  const file = formData.get("imageFile");
  if (file instanceof File && file.size > 0) {
    const problem = checkImage(file);
    if (problem) return { error: problem };

    const path = `${roomId}-${Date.now()}.${IMAGE_TYPES[file.type]}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await adminDb.storage
      .from("room-images")
      .upload(path, buffer, { contentType: file.type, upsert: true });
    if (uploadError) {
      console.error("[rooms] image upload:", uploadError.message);
      return { error: "The photo couldn’t be uploaded. Please try again." };
    }
    update.image_url = adminDb.storage.from("room-images").getPublicUrl(path).data.publicUrl;
  }

  // Admin client bypasses RLS — authorization is already enforced by requireAdmin() above.
  const { data, error } = await adminDb
    .from("workspaces")
    .update(update)
    .eq("id", roomId)
    .select("price_per_hour, regular_price_per_hour, image_url, amenities, show_rating")
    .maybeSingle();
  if (error || !data) {
    console.error("[rooms] update:", error?.message ?? "no rows updated");
    return { error: "Couldn’t save this space. Please try again." };
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/bookings");
  revalidatePath("/spaces");

  return {
    saved: {
      price_per_hour: Number(data.price_per_hour),
      regular_price_per_hour: data.regular_price_per_hour === null ? null : Number(data.regular_price_per_hour),
      image_url: data.image_url,
      amenities: data.amenities ?? [],
      show_rating: data.show_rating !== false,
    },
  };
}
