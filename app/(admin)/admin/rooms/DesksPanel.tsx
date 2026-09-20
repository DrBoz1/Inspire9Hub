"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LayoutGrid, Loader2, Sun } from "lucide-react";
import { deskPriceNote, parseDayPrice, type DeskSummary } from "@/lib/admin-desks";
import { setDeskDayPrice } from "./actions";

/**
 * Desks are sold as day passes at one price, so this is a panel with one number
 * rather than 36 tiles. Clearing the price takes them off sale without touching
 * the floor plan or any pass already bought.
 */
export function DesksPanel({ desks: initial }: { desks: DeskSummary }) {
  const [desks, setDesks] = useState(initial);
  const [price, setPrice] = useState(desks.price === null ? "" : String(desks.price));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"save" | "off" | null>(null);

  const parsed = parseDayPrice(price);
  const priceError = "error" in parsed ? parsed.error : null;
  // Nothing to save only when that price is already on every desk: with mixed
  // prices, saving is exactly how an admin levels them.
  const unchanged = "value" in parsed && parsed.value === desks.price && desks.onSale === desks.total && !desks.mixed;

  const send = (kind: "save" | "off") => {
    if (kind === "save" && priceError) return setError(priceError);
    const data = new FormData();
    if (kind === "off") data.set("offSale", "true");
    else data.set("price_per_day", price.trim());

    setBusy(kind);
    startTransition(async () => {
      setError(null);
      try {
        const result = await setDeskDayPrice(data);
        if (result.error || !result.saved) {
          setError(result.error ?? "Couldn’t save the day price.");
          return;
        }
        const saved = result.saved;
        setDesks((d) => ({ ...d, onSale: saved.price === null ? 0 : saved.desks, price: saved.price, mixed: false }));
        setPrice(saved.price === null ? "" : String(saved.price));
        toast.success(
          saved.price === null ? "Desks are off sale" : `Desks on sale at $${saved.price} a day`,
          { description: saved.price === null ? "Members can’t buy a day pass until you set a price again." : `${saved.desks} desks, bookable from opening to closing.` },
        );
      } catch {
        setError("Couldn’t reach the server. Please try again.");
      } finally {
        setBusy(null);
      }
    });
  };

  return (
    <section className="hub-surface admin-desks" aria-labelledby="admin-desks-title">
      <div className="admin-desks-copy">
        <p className="hub-eyebrow"><Sun size={12} aria-hidden /> Day passes</p>
        <h2 id="admin-desks-title">Hot desks</h2>
        <p className="admin-desks-note" role="status">{deskPriceNote(desks)}</p>
      </div>

      <div className="admin-desks-form">
        <label className="admin-desks-field" htmlFor="desk-day-price">
          <span>Price a day</span>
          <span className="admin-desks-input">
            <i aria-hidden>$</i>
            <input
              id="desk-day-price"
              inputMode="decimal"
              value={price}
              placeholder="35"
              disabled={pending || desks.total === 0}
              onChange={(e) => { setPrice(e.target.value); setError(null); }}
              aria-invalid={price !== "" && priceError ? true : undefined}
              aria-describedby={error ? "desk-day-price-error" : undefined}
            />
          </span>
        </label>
        <div className="admin-desks-buttons">
          <button
            type="button"
            className="hub-button hub-button-primary"
            disabled={pending || desks.total === 0 || price.trim() === "" || unchanged}
            onClick={() => send("save")}
          >
            {busy === "save" ? <Loader2 size={13} className="hub-spin" aria-hidden /> : <LayoutGrid size={13} aria-hidden />}
            {desks.onSale === 0 ? "Put desks on sale" : "Save day price"}
          </button>
          {desks.onSale > 0 && (
            <button type="button" className="hub-button hub-button-outline" disabled={pending} onClick={() => send("off")}>
              {busy === "off" ? <Loader2 size={13} className="hub-spin" aria-hidden /> : null}
              Take off sale
            </button>
          )}
        </div>
        {error && <p className="hub-inline-error" id="desk-day-price-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
