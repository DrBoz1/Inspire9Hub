import type { Metadata } from "next";
import { MembershipsView } from "./MembershipsView";
import { loadMemberships } from "./memberships-data";

export const metadata: Metadata = { title: "Memberships | Inspire9 Hub" };

export default async function MembershipsPage() {
  return <MembershipsView data={await loadMemberships()} now={new Date()} />;
}
