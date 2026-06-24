"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DoorOpen, Check, Upload, Loader2, TrendingDown, Star } from "lucide-react";
import { toast } from "sonner";
import { ALL_AMENITIES, DEFAULT_ROOM_IMAGE } from "@/lib/constants";
import { getPriceDropInfo } from "@/lib/pricing";
import { updateRoomDetails } from "./actions";

type Room = {
  id: string;
  name: string;
  location: string;
  capacity: number;
  price_per_hour: number;
  regular_price_per_hour: number | null;
  image_url: string | null;
  amenities: string[] | null;
  show_rating: boolean | null;
};

type SavedFields = Pick<
  Room,
  "price_per_hour" | "image_url" | "amenities" | "regular_price_per_hour" | "show_rating"
>;

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
      }`}
    >
      <span
        className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function RoomEditDialog({
  room,
  open,
  onOpenChange,
  onSaved,
}: {
  room: Room;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: SavedFields) => void;
}) {
  const [price, setPrice] = useState(String(room.price_per_hour));
  const [amenities, setAmenities] = useState<string[]>(room.amenities ?? []);
  const [updateRegularPrice, setUpdateRegularPrice] = useState(true);
  const [showRating, setShowRating] = useState(room.show_rating ?? true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke the blob URL whenever it's replaced or the dialog unmounts, so we
  // don't leak memory across repeated edits.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const resetFromRoom = () => {
    setPrice(String(room.price_per_hour));
    setAmenities(room.amenities ?? []);
    setUpdateRegularPrice(true);
    setShowRating(room.show_rating ?? true);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleAmenity = (key: string) => {
    setAmenities((curr) =>
      curr.includes(key) ? curr.filter((k) => k !== key) : [...curr, key],
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Invalid File", { description: "Please choose an image file." });
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image Too Large", { description: "Max file size is 5MB." });
      e.target.value = "";
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.set("roomId", room.id);
    formData.set("price_per_hour", price);
    formData.set("updateRegularPrice", String(updateRegularPrice));
    formData.set("show_rating", String(showRating));
    amenities.forEach((a) => formData.append("amenities", a));

    const file = fileInputRef.current?.files?.[0];
    if (file) formData.set("imageFile", file);

    startTransition(async () => {
      try {
        const result = await updateRoomDetails(formData);
        onSaved({
          price_per_hour: Number(price),
          image_url: result.image_url ?? room.image_url,
          amenities,
          regular_price_per_hour:
            result.regular_price_per_hour ?? room.regular_price_per_hour,
          show_rating: showRating,
        });
        toast.success("Room Updated", {
          description: `${room.name} is now live with the new details.`,
        });
        onOpenChange(false);
      } catch (err: any) {
        toast.error("Update Failed", { description: err.message });
      }
    });
  };

  const displayImage = previewUrl || room.image_url || DEFAULT_ROOM_IMAGE;

  // Baseline used for the live preview below: if "set as new regular price"
  // is checked, the baseline moves with the typed price (so no drop ever
  // shows — this mirrors exactly what the server will do on save).
  const effectiveRegular = updateRegularPrice
    ? Number(price)
    : room.regular_price_per_hour ?? room.price_per_hour;
  const priceDrop = getPriceDropInfo(Number(price) || 0, effectiveRegular);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) resetFromRoom();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-2xl rounded-[32px] border-none shadow-2xl p-0 overflow-hidden bg-white dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="p-10 pb-0">
          <div className="h-12 w-12 bg-red-50 dark:bg-red-950/40 rounded-2xl flex items-center justify-center text-[#E31E24] mb-4">
            <DoorOpen className="w-6 h-6" />
          </div>
          <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            Edit {room.name}
          </DialogTitle>
          <DialogDescription className="font-medium text-slate-500 dark:text-slate-400">
            Changes apply immediately to the live booking page — pricing is
            always re-validated server-side at checkout.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-10 pt-6 space-y-8">
          {/* Image upload — object-cover preview, exactly how it'll render on the card */}
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Room Image
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative block w-full aspect-video overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
            >
              <img
                src={displayImage}
                alt="Room preview"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/50">
                <span className="flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-xs font-black uppercase tracking-wider text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <Upload className="w-3.5 h-3.5" /> Click to upload
                </span>
              </div>
            </button>
            <p className="text-[11px] text-slate-400 font-medium">
              PNG, JPEG, WEBP or GIF — up to 5MB. Automatically cropped to fit
              every card size, no matter the original dimensions.
            </p>
          </div>

          {/* Price — single "$" prefix only; the AUD/HR unit lives outside the
              input so it can never collide with what's typed. */}
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Hourly Rate
            </Label>
            <div className="flex items-center gap-3">
              <div className="relative w-36">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400 pointer-events-none">
                  $
                </span>
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  className="h-12 rounded-xl border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 pl-8 font-black text-slate-900 dark:text-white"
                />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                AUD / Hour
              </span>
            </div>

            {/* Regular-price baseline control */}
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 dark:bg-slate-800 px-4 py-3.5 mt-2">
              <div className="min-w-0">
                <p className="text-[11px] font-black text-slate-700 dark:text-slate-200">
                  Set as new regular price
                </p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                  {updateRegularPrice
                    ? "This becomes the room's normal rate — no drop badge."
                    : `Temporary price — a drop badge shows until it's raised back to $${room.regular_price_per_hour ?? room.price_per_hour}.`}
                </p>
              </div>
              <Switch checked={updateRegularPrice} onChange={setUpdateRegularPrice} />
            </div>

            {/* Live preview of the badge members will actually see */}
            {priceDrop && (
              <div className="flex items-center gap-2 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 px-4 py-3">
                <TrendingDown className="w-4 h-4 text-[#E31E24] shrink-0" />
                <p className="text-[11px] font-bold text-red-700 dark:text-red-400">
                  Members will see{" "}
                  <span className="line-through opacity-60">
                    ${priceDrop.regularPrice}
                  </span>{" "}
                  ${price} —{" "}
                  <span className="font-black">{priceDrop.percentOff}% PRICE DROP</span>{" "}
                  badge.
                </p>
              </div>
            )}
          </div>

          {/* Amenities — live strikethrough preview, exactly what members see */}
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Features &amp; Amenities
            </Label>
            <div className="grid grid-cols-2 gap-2.5">
              {ALL_AMENITIES.map(({ key, label }) => {
                const active = amenities.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleAmenity(key)}
                    className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-[12px] font-bold transition-all active:scale-95 ${
                      active
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600 line-through"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                        active
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-200 dark:bg-slate-700"
                      }`}
                    >
                      {active && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Review rating visibility */}
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 dark:bg-slate-800 px-4 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-500 shrink-0">
                <Star className="w-4 h-4 fill-current" />
              </div>
              <div>
                <p className="text-[11px] font-black text-slate-700 dark:text-slate-200">
                  Show review rating
                </p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                  Toggle off to hide the star rating on the booking page.
                </p>
              </div>
            </div>
            <Switch checked={showRating} onChange={setShowRating} />
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full bg-[#E31E24] hover:bg-red-700 text-white h-14 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-100 dark:shadow-none transition-all active:scale-95 disabled:opacity-60"
          >
            {isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Save Changes"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
