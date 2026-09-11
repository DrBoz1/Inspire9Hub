import type { Metadata } from "next";
import BookingMap from "@/features/booking-map/BookingMapClient";
import type { WorkspaceRow } from "@/features/booking-map/adapter";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

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
    <div className="space-y-6 font-poppins">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
          Floor Plan
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
          Pick a space on the plan to see what&apos;s free and book it.
        </p>
      </div>

      {/*
        The map inherits its height from this box — it has no intrinsic size and
        would collapse in normal document flow. The dashboard shell is h-screen
        with a header and p-8 padding, so subtract those to fill what's left.
      */}
      <div className="h-[calc(100vh-15rem)] min-h-[520px] overflow-hidden rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm">
        <BookingMap
          workspaces={(roomsRes.data ?? []) as WorkspaceRow[]}
          memberName={memberName}
          roomsError={roomsRes.error ? "Couldn’t load the rooms. Refresh the page to try again." : null}
        />
      </div>
    </div>
  );
}
