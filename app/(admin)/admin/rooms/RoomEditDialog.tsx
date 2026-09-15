"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ImageUp, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminSwitch } from "@/components/admin/AdminSwitch";
import { ALL_AMENITIES, DEFAULT_ROOM_IMAGE } from "@/lib/constants";
import { getPriceDropInfo } from "@/lib/pricing";
import { checkImage, formatPrice, parsePrice, pricePreview, type AdminRoom } from "@/lib/admin-rooms";
import { updateRoomDetails, type RoomSaveResult } from "./actions";

type Saved = NonNullable<RoomSaveResult["saved"]>;

export default function RoomEditDialog({ room, onClose, onSaved }: { room: AdminRoom; onClose: () => void; onSaved: (saved: Saved) => void }) {
  // A room already on a price drop keeps it unless the admin says otherwise. The old form
  // always defaulted this on, so saving any change quietly ended a running promotion.
  const promoRunning = Boolean(getPriceDropInfo(room.price_per_hour, room.regular_price_per_hour));
  const [price, setPrice] = useState(String(room.price_per_hour));
  const [setAsRegular, setSetAsRegular] = useState(!promoRunning);
  const [amenities, setAmenities] = useState<string[]>(room.amenities);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const parsed = parsePrice(price);
  const priceError = "error" in parsed ? parsed.error : null;
  const priceValue = "value" in parsed ? parsed.value : room.price_per_hour;
  const { regular, drop } = pricePreview(priceValue, room, setAsRegular);
  const amenitiesChanged = amenities.length !== room.amenities.length || amenities.some((a) => !room.amenities.includes(a));
  const dirty = file !== null || priceValue !== room.price_per_hour || amenitiesChanged || setAsRegular === promoRunning;

  const choose = (next: File | undefined) => {
    if (!next) return;
    const problem = checkImage(next);
    if (problem) {
      setError(problem);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setError(null);
    setFile(next);
    setPreview(URL.createObjectURL(next));
  };

  const clearPhoto = () => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const toggle = (key: string) => setAmenities((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (priceError) return setError(priceError);
    const data = new FormData();
    data.set("roomId", room.id);
    data.set("price_per_hour", price.trim());
    data.set("updateRegularPrice", String(setAsRegular));
    amenities.forEach((a) => data.append("amenities", a));
    if (file) data.set("imageFile", file);

    startTransition(async () => {
      setError(null);
      try {
        const result = await updateRoomDetails(data);
        if (result.error || !result.saved) {
          setError(result.error ?? "Couldn’t save this space.");
          return;
        }
        onSaved(result.saved);
        toast.success(`${room.name} updated`, { description: "Members see the changes straight away." });
        onClose();
      } catch {
        setError(file ? "Couldn’t reach the server. If the photo is large, try a smaller one." : "Couldn’t reach the server. Please try again.");
      }
    });
  };

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !pending) onClose(); }}>
      <DialogContent className="hub-dialog admin-room-dialog" overlayClassName="hub-booking-overlay">
        <DialogHeader className="admin-room-dialog-head">
          <p className="hub-eyebrow">Space management</p>
          <DialogTitle>Edit {room.name}</DialogTitle>
          <DialogDescription>Changes go live on the booking pages when you save. Prices are checked again at checkout.</DialogDescription>
        </DialogHeader>

        <form id="room-form" onSubmit={save} className="admin-room-form" noValidate>
          <section aria-labelledby="room-photo-label">
            <h3 id="room-photo-label" className="admin-form-label">Photo</h3>
            <button
              type="button"
              className="admin-photo-drop"
              data-dragging={dragging || undefined}
              style={{ backgroundImage: `url("${preview || room.image_url || DEFAULT_ROOM_IMAGE}")` }}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files?.[0]); }}
            >
              <span><ImageUp size={15} aria-hidden />{file ? "Choose a different photo" : "Replace photo"}</span>
            </button>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" tabIndex={-1} aria-label="Room photo" onChange={(e) => choose(e.target.files?.[0])} />
            <p className="admin-form-hint">
              {file ? <>{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB) uploads when you save. <button type="button" className="admin-link-button" onClick={clearPhoto}>Keep the current photo</button></> : "PNG, JPEG, WEBP or GIF, up to 5MB. Click, or drag a photo onto the picture."}
            </p>
          </section>

          <section aria-labelledby="room-price-label">
            <label id="room-price-label" htmlFor="room-price" className="admin-form-label">Hourly rate</label>
            <div className="admin-price-input" data-invalid={priceError ? true : undefined}>
              <span aria-hidden>$</span>
              <input id="room-price" inputMode="decimal" autoComplete="off" value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={priceError ? true : undefined} aria-describedby="room-price-hint" />
              <small aria-hidden>AUD / hour</small>
            </div>
            <p id="room-price-hint" className={priceError ? "hub-field-error" : "admin-form-hint"} aria-live="polite">
              {priceError ?? (drop ? <>Members will see <del>{formatPrice(drop.regularPrice)}</del> {formatPrice(priceValue)} with a {drop.percentOff}% off badge.</> : <>Members will see {formatPrice(priceValue)} an hour, with no discount badge.</>)}
            </p>
            <AdminSwitch
              id="room-regular"
              label="Make this the regular price"
              description={setAsRegular ? "This becomes the room’s normal rate." : `Treat it as a temporary drop. The badge shows while the price is below ${formatPrice(regular)}.`}
              checked={setAsRegular}
              onChange={setSetAsRegular}
            />
          </section>

          <fieldset className="admin-amenity-picker">
            <legend className="admin-form-label">Amenities <small>{amenities.length} selected</small></legend>
            <div>
              {ALL_AMENITIES.map(({ key, label }) => {
                const on = amenities.includes(key);
                return (
                  <label key={key} data-on={on || undefined}>
                    <input type="checkbox" checked={on} onChange={() => toggle(key)} />
                    <span className="admin-amenity-check" aria-hidden>{on && <Check size={10} strokeWidth={3} />}</span>
                    {label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {error && <p className="hub-inline-error" role="alert">{error}</p>}
        </form>

        <footer className="admin-room-dialog-foot">
          <span className="admin-form-hint" aria-live="polite">{dirty ? "Unsaved changes" : "No changes yet"}</span>
          <button type="button" className="hub-button hub-button-outline" onClick={onClose} disabled={pending}>Cancel</button>
          <button type="submit" form="room-form" className="hub-button hub-button-primary" disabled={pending || !dirty || Boolean(priceError)}>
            {pending ? <><Loader2 size={14} className="hub-spin" aria-hidden />Saving…</> : "Save changes"}
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
