"use client";

import { Users, MapPin, Check } from "lucide-react";
import BookingModal from "./BookingModal";
import { ALL_AMENITIES, DEFAULT_ROOM_IMAGE } from "@/lib/constants";
import { getPriceDropInfo } from "@/lib/pricing";

export type BookingRoom = {
  id: string; name: string; location: string | null; capacity: number;
  price_per_hour: number; regular_price_per_hour?: number | null;
  amenities?: string[] | null; image_url?: string | null; busyToday?: boolean;
  /** Set when the price shown is the member's rate. */
  member_discount_percent?: number;
};

export default function RoomCard({ room }: { room: BookingRoom }) {
  const priceDrop = getPriceDropInfo(room.price_per_hour, room.regular_price_per_hour);
  const features = ALL_AMENITIES.filter(a => room.amenities?.includes(a.key));
  return <article className="hub-room-card hub-surface">
    <div className="hub-room-photo" role="img" aria-label={room.name} style={{ backgroundImage: `url("${room.image_url || DEFAULT_ROOM_IMAGE}")` }}>
      <span className="hub-room-seats"><Users size={13} /> Up to {room.capacity}</span>
      {room.member_discount_percent ? <span className="hub-room-offer">Member rate, {room.member_discount_percent}% off</span> : priceDrop && <span className="hub-room-offer">{priceDrop.percentOff}% lower rate</span>}
    </div>
    <div className="hub-room-body">
      <p className="hub-room-location"><MapPin size={12} />{room.location || "Inspire9 · Level 1"}</p>
      <h2>{room.name}</h2>
      <div className="hub-room-features">{features.length ? features.map(a => <span key={a.key}><Check size={12} />{a.label}</span>) : <span>A place to focus and connect.</span>}</div>
      <div className="hub-room-rate"><div>{priceDrop && <del>${priceDrop.regularPrice}</del>}<strong>${Number(room.price_per_hour).toLocaleString("en-AU", { maximumFractionDigits: 2 })}</strong><span> AUD / hour</span></div><span>{room.busyToday ? "Bookings today" : "Check your preferred time"}</span></div>
      <BookingModal room={room} />
    </div>
  </article>;
}
