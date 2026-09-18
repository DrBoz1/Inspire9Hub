import type { Metadata } from "next";
import { HUB_TIMEZONE } from "@/lib/datetime";
import { isUuid } from "@/lib/admin-compliance";
import { todayIn } from "@/features/booking-map/zoned-time";
import { LeadsBoard } from "./LeadsBoard";
import { loadLeads } from "./leads-data";

export const metadata: Metadata = { title: "Leads | Inspire9 Hub" };

type SearchParams = Promise<{ lead?: string }>;

export default async function LeadsPage(props: { searchParams: SearchParams }) {
  const [{ lead }, data] = await Promise.all([props.searchParams, loadLeads()]);
  const now = new Date();
  return (
    <LeadsBoard
      initialLeads={data.leads}
      staff={data.staff}
      tableMissing={data.tableMissing}
      today={todayIn(HUB_TIMEZONE, now.getTime())}
      nowIso={now.toISOString()}
      openLeadId={isUuid(lead) ? lead! : null}
    />
  );
}
