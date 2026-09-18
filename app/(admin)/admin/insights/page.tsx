import type { Metadata } from "next";
import { InsightsView } from "./InsightsView";
import { loadInsights } from "./insights-data";

export const metadata: Metadata = { title: "Insights | Inspire9 Hub" };

type SearchParams = Promise<{ range?: string; room?: string }>;

export default async function InsightsPage(props: { searchParams: SearchParams }) {
  return <InsightsView data={await loadInsights(await props.searchParams)} />;
}
