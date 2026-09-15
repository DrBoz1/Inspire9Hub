import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getPriceDropInfo } from "@/lib/pricing";
import { RoomsBoard } from "./RoomsBoard";
import { loadRooms } from "./rooms-data";

export const metadata: Metadata = { title: "Space management | Inspire9 Hub" };

export default async function AdminRoomsPage() {
  const rooms = await loadRooms();
  const live = rooms.filter((r) => r.active);
  const onSale = live.filter((r) => getPriceDropInfo(r.price_per_hour, r.regular_price_per_hour)).length;

  return (
    <div className="hub-page admin-rooms-page">
      <AdminPageHeader
        eyebrow="Operations"
        title="Space management"
        description={`Photos, prices and amenities for the ${live.length} space${live.length === 1 ? "" : "s"} members can see${onSale ? `, ${onSale} on a price drop right now` : ""}.`}
      />
      <RoomsBoard initialRooms={rooms} />
    </div>
  );
}
