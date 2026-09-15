import type { Metadata } from "next";
import { ComplianceView } from "./ComplianceView";
import { loadCompliance } from "./compliance-data";

export const metadata: Metadata = { title: "Compliance | Inspire9 Hub" };

type SearchParams = Promise<{ view?: string; page?: string; outcome?: string }>;

export default async function CompliancePage(props: { searchParams: SearchParams }) {
  return <ComplianceView data={await loadCompliance(await props.searchParams)} />;
}
