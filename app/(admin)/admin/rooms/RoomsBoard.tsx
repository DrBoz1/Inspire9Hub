"use client";

import { useState } from "react";
import { Check, DoorOpen, MapPin, Pencil, TrendingDown, Users } from "lucide-react";
import { AdminSearch, AdminSegmented, AdminToolbar } from "@/components/admin/AdminToolbar";
import { AdminEmpty } from "@/components/admin/AdminEmpty";
import { DEFAULT_ROOM_IMAGE } from "@/lib/constants";
import { getPriceDropInfo } from "@/lib/pricing";
import { amenitySummary, formatPrice, matchesRoom, roomStatus, sortRooms, type AdminRoom, type RoomSort } from "@/lib/admin-rooms";
import RoomEditDialog from "./RoomEditDialog";

export function RoomsBoard({ initialRooms }: { initialRooms: AdminRoom[] }) {
  const [rooms, setRooms] = useState(initialRooms);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<RoomSort>("capacity");
  const [editingId, setEditingId] = useState<string | null>(null);

  const shown = sortRooms(rooms.filter((r) => matchesRoom(r, query)), sort);
  const editing = rooms.find((r) => r.id === editingId) ?? null;

  return (
    <>
      <div className="admin-rooms-bar">
        <AdminToolbar>
          <AdminSearch label="Search spaces" value={query} onChange={setQuery} placeholder="Search by name or location" />
          <AdminSegmented
            label="Sort spaces"
            value={sort}
            onChange={setSort}
            options={[
              { value: "capacity", label: "By size" },
              { value: "price", label: "By price" },
              { value: "name", label: "A–Z" },
            ]}
          />
        </AdminToolbar>
      </div>

      {shown.length === 0 ? (
        <section className="hub-surface" aria-label="Spaces">
          <AdminEmpty icon={<DoorOpen size={18} />} title={query ? `No spaces match “${query.trim()}”` : "No spaces yet"}>
            {query ? "Try another name or location." : "Spaces added to the floor plan will appear here."}
          </AdminEmpty>
        </section>
      ) : (
        <ul className="admin-room-grid" aria-label="Spaces">
          {shown.map((room) => (
            <li key={room.id}><RoomTile room={room} onEdit={() => setEditingId(room.id)} /></li>
          ))}
        </ul>
      )}

      {editing && (
        <RoomEditDialog
          key={editing.id}
          room={editing}
          onClose={() => setEditingId(null)}
          onSaved={(saved) => setRooms((current) => current.map((r) => (r.id === editing.id ? { ...r, ...saved } : r)))}
        />
      )}
    </>
  );
}

function RoomTile({ room, onEdit }: { room: AdminRoom; onEdit: () => void }) {
  const drop = getPriceDropInfo(room.price_per_hour, room.regular_price_per_hour);
  const { shown, more } = amenitySummary(room.amenities);
  const status = roomStatus(room);

  return (
    <article className="hub-surface admin-room-tile" data-status={status.key} aria-labelledby={`room-${room.id}`}>
      <div className="admin-room-photo" role="img" aria-label={`Photo of ${room.name}`} style={{ backgroundImage: `url("${room.image_url || DEFAULT_ROOM_IMAGE}")` }}>
        <span className="admin-room-price">
          {drop && <del>{formatPrice(drop.regularPrice)}</del>}
          <strong>{formatPrice(room.price_per_hour)}</strong>
          <small>/ hour</small>
        </span>
        {drop && <span className="admin-room-drop"><TrendingDown size={12} aria-hidden />{drop.percentOff}% off</span>}
      </div>
      <div className="admin-room-body">
        <div className="admin-room-title">
          <h2 id={`room-${room.id}`}>{room.name}</h2>
          {status.key !== "live" && <span className="hub-status-badge" data-status={status.key === "removed" ? "cancelled" : "pending"}>{status.label}</span>}
        </div>
        <p className="admin-room-meta">
          <span><MapPin size={12} aria-hidden />{room.location ?? "Inspire9"}</span>
          <span><Users size={12} aria-hidden />Up to {room.capacity}</span>
        </p>
        <ul className="admin-room-amenities" aria-label="Amenities">
          {shown.map((label) => <li key={label}><Check size={11} aria-hidden />{label}</li>)}
          {more > 0 && <li className="admin-room-more">+{more} more</li>}
          {shown.length === 0 && <li className="admin-room-more">No amenities listed</li>}
        </ul>
        <button type="button" className="hub-button hub-button-outline admin-room-edit" onClick={onEdit}>
          <Pencil size={13} aria-hidden />Edit {room.name}
        </button>
      </div>
    </article>
  );
}
