import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { MembershipClient } from "./MembershipClient";
import { loadMembership } from "./membership-data";
import { openBillingPortal, startMembership } from "./actions";

export const metadata: Metadata = { title: "Membership | Inspire9 Hub" };

type SearchParams = Promise<{ status?: string }>;

export default async function MembershipPage(props: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [{ status }, data] = await Promise.all([props.searchParams, loadMembership(user.id)]);

  return (
    <div className="hub-page hub-account hub-membership">
      <div className="hub-page-heading">
        <div>
          <p className="hub-eyebrow">Your membership</p>
          <h1>Membership<span className="hub-red">.</span></h1>
          <p>Your plan, your receipts, and a way to change either.</p>
        </div>
      </div>
      {data.tableMissing ? (
        <p className="hub-surface hub-membership-empty">Memberships are coming soon. Ask the team if you’d like a desk by the month.</p>
      ) : (
        <MembershipClient
          plans={data.plans}
          current={data.current}
          invoices={data.invoices}
          hasCustomer={data.hasCustomer}
          nowIso={new Date().toISOString()}
          returned={status === "joined" || status === "cancelled" ? status : null}
          actions={{ start: startMembership, portal: openBillingPortal }}
        />
      )}
    </div>
  );
}
