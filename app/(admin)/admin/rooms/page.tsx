import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import RoomsManagementClient from "./RoomsManagementClient";

export default async function AdminRoomsPage() {
  const supabase = createAdminClient();
  const { data: rooms } = await supabase
    .from("workspaces")
    .select("*")
    .order("capacity", { ascending: true });

  return (
    <div className="space-y-8 font-poppins pb-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
            Space Management
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Edit pricing, imagery, and amenities for every bookable room.
          </p>
        </div>
        <Badge className="rounded-full px-5 py-2 bg-slate-900 dark:bg-slate-800 text-white font-black text-[10px] tracking-widest uppercase">
          {rooms?.length ?? 0} Rooms
        </Badge>
      </div>

      <RoomsManagementClient initialRooms={rooms ?? []} />
    </div>
  );
}
