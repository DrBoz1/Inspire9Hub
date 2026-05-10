import { createAdminClient } from "@/lib/supabase/admin";
import AnnouncementsClient from "./AnnouncementsClient";
import { Badge } from "@/components/ui/badge";

export default async function AnnouncementsPage() {
  const supabase = createAdminClient();

  const { data: announcements } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  const activeCount =
    (announcements ?? []).filter((a) => a.status === "active").length;

  return (
    <div className="space-y-8 font-poppins pb-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
            Announcements
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Post hub-wide notices that appear instantly on all member dashboards.
          </p>
        </div>
        {activeCount > 0 && (
          <Badge className="rounded-full px-5 py-2 bg-emerald-500 text-white font-black text-[10px] tracking-widest uppercase">
            {activeCount} Live
          </Badge>
        )}
      </div>

      <AnnouncementsClient announcements={announcements ?? []} />
    </div>
  );
}
