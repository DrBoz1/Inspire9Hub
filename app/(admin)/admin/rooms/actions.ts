"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { isUuid } from "@/lib/admin-compliance";
import { IMAGE_TYPES, checkImage, cleanAmenities, looksLikeImage, parsePrice } from "@/lib/admin-rooms";
import { recordAudit } from "@/lib/audit";
import { parseDayPrice } from "@/lib/admin-desks";

export type DeskPriceResult = { error?: string; saved?: { price: number | null; desks: number } };

/**
 * Puts every desk on sale at one price a day, or takes them all off sale.
 *
 * One price for all of them on purpose: a day pass is "a desk", not a particular
 * desk, so members would have no way to choose a cheaper one. Selling stops by
 * clearing the price rather than by deleting anything, so the desks stay on the
 * floor plan and the bookings already sold are untouched.
 */
export async function setDeskDayPrice(formData: FormData): Promise<DeskPriceResult> {
  const guard = await requireAdmin();
  if ("error" in guard) return { error: guard.error };

  const offSale = formData.get("offSale") === "true";
  let price: number | null = null;
  if (!offSale) {
    const parsed = parseDayPrice(formData.get("price_per_day"));
    if ("error" in parsed) return { error: parsed.error };
    price = parsed.value;
  }

  // Admin client bypasses RLS — authorization is already enforced by requireAdmin() above.
  const { data, error } = await createAdminClient()
    .from("workspaces")
    .update({ price_per_day: price })
    .or("kind.eq.desk,space_group.eq.desks")
    .select("id");
  if (error) {
    // The column arrives with add_desks_and_day_passes.sql.
    if (error.code === "42703") return { error: "Day passes need their migration run first." };
    console.error("[desks] day price:", error.message);
    return { error: "Couldn’t save the day price. Please try again." };
  }

  const desks = data?.length ?? 0;
  if (desks === 0) return { error: "There are no desks yet. Run the day pass migration to add them." };

  await recordAudit({
    actor: { id: guard.user.id, email: guard.user.email },
    action: "desks.day_price",
    entity: "room",
    entityId: null,
    summary: price === null ? `Took ${desks} desks off sale` : `Put ${desks} desks on sale at $${price.toFixed(2)} a day`,
    meta: { price, desks },
  });

  revalidatePath("/admin", "layout");
  revalidatePath("/bookings");
  revalidatePath("/spaces");

  return { saved: { price, desks } };
}

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

  // Read before writing: an audit line saying "price changed" is worth little
  // without the value it changed from, and the update's own select returns the
  // new state only.
  const { data: before } = await adminDb
    .from("workspaces")
    .select("name, price_per_hour")
    .eq("id", roomId)
    .maybeSingle();

  const file = formData.get("imageFile");
  if (file instanceof File && file.size > 0) {
    const problem = checkImage(file);
    if (problem) return { error: problem };

    const path = `${roomId}-${Date.now()}.${IMAGE_TYPES[file.type]}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!looksLikeImage(buffer, file.type)) return { error: "That file isn't a real PNG, JPEG, WEBP or GIF image." };
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

  const roomName = before?.name?.trim() || "a space";
  const oldPrice = before?.price_per_hour === undefined || before?.price_per_hour === null ? null : Number(before.price_per_hour);
  const priceMoved = oldPrice !== null && oldPrice !== price.value;
  await recordAudit({
    actor: { id: guard.user.id, email: guard.user.email },
    action: "room.update",
    entity: "room",
    entityId: roomId,
    summary: priceMoved
      ? `Updated ${roomName}, price $${oldPrice.toFixed(2)} → $${price.value.toFixed(2)} per hour`
      : `Updated ${roomName}`,
    meta: {
      priceFrom: oldPrice,
      priceTo: price.value,
      baselineMoved: updateRegularPrice,
      photoReplaced: update.image_url !== undefined,
      amenities: update.amenities,
    },
  });

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
