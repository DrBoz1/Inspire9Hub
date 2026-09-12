import type { Metadata } from "next";
import BookingMap from "@/features/booking-map/BookingMapClient";
import type { WorkspaceRow } from "@/features/booking-map/adapter";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Floor Plan | Inspire9 Hub",
};

export default async function SpacesPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const [roomsRes, memberRes] = await Promise.all([
    // `*` on purpose: this works before and after the floor-plan migration adds
    // its columns. The adapter treats a missing floorplan_id as "not placed yet".
    supabase.from("workspaces").select("*"),
    user
      ? supabase.from("members").select("full_name").eq("id", user.id).maybeSingle()
      : null,
  ]);

  if (roomsRes.error) {
    console.error("[floor plan] loading rooms failed:", roomsRes.error.message);
  }

  const memberName: string = memberRes?.data?.full_name?.trim() || "you";

  return (
    <div className="hub-spaces-page">
      <div className="hub-page-heading">
        <div><p className="hub-eyebrow">The workspace · Level 1</p>
          <h1>Find your space<span className="hub-red">.</span></h1>
          <p>A place for every kind of work. Pick a space to make it yours.</p>
        </div>
        <Link href="/bookings" className="hub-text-link">My bookings <ArrowUpRight size={16} /></Link>
      </div>

      {/* The map fills the remaining member-area height, including on mobile. */}
      <div className="hub-spaces-map">
        <BookingMap
          workspaces={(roomsRes.data ?? []) as WorkspaceRow[]}
          memberName={memberName}
          roomsError={roomsRes.error ? "Couldn’t load the rooms. Refresh the page to try again." : null}
        />
      </div>
    </div>
  );
}
