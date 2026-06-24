"use client";

import { useState } from "react";
import { Users, MapPin, Pencil, TrendingDown, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALL_AMENITIES, DEFAULT_ROOM_IMAGE } from "@/lib/constants";
import { getPriceDropInfo } from "@/lib/pricing";
import RoomEditDialog from "./RoomEditDialog";

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

export default function RoomsManagementClient({
  initialRooms,
}: {
  initialRooms: Room[];
}) {
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingRoom = rooms.find((r) => r.id === editingId) ?? null;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room) => {
          const features = room.amenities ?? [];
          const priceDrop = getPriceDropInfo(room.price_per_hour, room.regular_price_per_hour);
          return (
            <div
              key={room.id}
              className="flex flex-col rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 overflow-hidden transition-all hover:shadow-lg"
            >
              {/* Image */}
              <div
                className="relative h-36 bg-slate-100 dark:bg-slate-800 bg-cover bg-center"
                style={{
                  backgroundImage: `url('${room.image_url || DEFAULT_ROOM_IMAGE}')`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md text-slate-900 font-black text-[10px] px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-1.5">
                  {priceDrop && (
                    <span className="line-through text-slate-400 font-bold">
                      ${priceDrop.regularPrice}
                    </span>
                  )}
                  AUD ${room.price_per_hour}/HR
                </div>
                {priceDrop && (
                  <div className="absolute top-12 right-3 bg-[#E31E24] text-white font-black text-[9px] px-2.5 py-1 rounded-lg shadow-lg flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" /> {priceDrop.percentOff}% OFF
                  </div>
                )}
                <div className="absolute bottom-3 left-4 text-white flex items-center gap-2">
                  <p className="font-black text-lg leading-tight">{room.name}</p>
                  {room.show_rating === false && (
                    <span
                      title="Rating hidden from members"
                      className="flex items-center justify-center h-5 w-5 rounded-full bg-black/40"
                    >
                      <EyeOff className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-6 flex flex-col flex-1 gap-4">
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                    <Users className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">
                      {room.capacity} seats
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">
                      {room.location}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {ALL_AMENITIES.map(({ key, label }) => {
                    const has = features.includes(key);
                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-1.5 text-[10px] font-semibold ${
                          has
                            ? "text-slate-600 dark:text-slate-300"
                            : "text-slate-300 dark:text-slate-600 line-through"
                        }`}
                      >
                        <span
                          className={`w-1 h-1 rounded-full shrink-0 ${
                            has ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
                          }`}
                        />
                        {label}
                      </div>
                    );
                  })}
                </div>

                <Button
                  onClick={() => setEditingId(room.id)}
                  variant="outline"
                  className="mt-auto w-full rounded-xl border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all active:scale-95"
                >
                  <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Room
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {editingRoom && (
        <RoomEditDialog
          room={editingRoom}
          open={editingId !== null}
          onOpenChange={(open) => !open && setEditingId(null)}
          onSaved={(updated) =>
            setRooms((curr) =>
              curr.map((r) =>
                r.id === editingRoom.id ? { ...r, ...updated } : r,
              ),
            )
          }
        />
      )}
    </>
  );
}
