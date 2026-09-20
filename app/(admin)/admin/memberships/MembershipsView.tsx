import { AlertTriangle, BadgeDollarSign, CreditCard, Info, Repeat, Users } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStat, AdminStats } from "@/components/admin/AdminStat";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminEmpty } from "@/components/admin/AdminEmpty";
import { formatCentsAmount, membershipTotals, perMonth, planRows, priceLabel, type PlanRow } from "@/lib/admin-plans";
import { GRACE_DAYS } from "@/lib/billing/state";
import type { MembershipsData } from "./memberships-data";
import { SyncPlansButton } from "./SyncPlansButton";

export function MembershipsView({ data, now }: { data: MembershipsData; now: Date }) {
  const totals = membershipTotals(data.subscriptions, now);
  const rows = planRows(data.plans, data.subscriptions, now);
  const onSale = data.plans.filter((p) => p.active).length;

  return (
    <div className="hub-page admin-memberships-page">
      <AdminPageHeader
        eyebrow="Community"
        title="Memberships"
        description="Monthly and yearly plans, billed by Stripe. Prices are set in Stripe; sync to bring changes here."
        actions={!data.tableMissing && <SyncPlansButton />}
      />

      {data.tableMissing ? (
        <section className="hub-surface admin-panel">
          <AdminEmpty icon={<CreditCard size={18} />} title="Memberships aren’t set up yet">
            Run supabase/migrations/add_membership_billing.sql in the Supabase SQL Editor, then refresh this page.
          </AdminEmpty>
        </section>
      ) : (
        <>
          <AdminStats label="Memberships at a glance">
            <AdminStat label="Members" value={totals.members} icon={<Users size={16} />} tone="green" hint={totals.leaving ? `${totals.leaving} leaving at the end of their period` : "Nobody leaving"} />
            <AdminStat label="Monthly recurring revenue" value={formatCentsAmount(totals.mrrCents)} icon={<BadgeDollarSign size={16} />} tone="red" hint="Every plan, as a monthly figure, in AUD" />
            <AdminStat label="Payments overdue" value={totals.overdue} icon={<AlertTriangle size={16} />} tone={totals.overdue ? "amber" : "neutral"} hint={`Still in their ${GRACE_DAYS}-day grace period`} />
            <AdminStat label="Plans on sale" value={onSale} icon={<Repeat size={16} />} hint={onSale ? "Shown to members who join" : "Sync from Stripe to add some"} />
          </AdminStats>

          {totals.offPlan > 0 && (
            <p className="admin-insights-note" role="status">
              <Info size={15} aria-hidden />
              {totals.offPlan} member{totals.offPlan === 1 ? " pays" : "s pay"} through a price that isn’t one of these plans, probably set up by hand in Stripe. Tag its product with hub_plan_slug and sync to include it.
            </p>
          )}

          <section className="hub-surface admin-panel" aria-label="Plans">
            <AdminDataTable<PlanRow>
              caption="Plans, on sale first"
              rows={rows}
              rowKey={(r) => r.plan.id}
              empty={
                <AdminEmpty icon={<CreditCard size={18} />} title="No plans yet">
                  In Stripe, give a product a recurring monthly or yearly price, and add the metadata key hub_plan_slug to the product (for example resident). Then press Sync from Stripe.
                </AdminEmpty>
              }
              columns={[
                { key: "plan", header: "Plan", primary: true, cell: (r) => <>{r.plan.name}<span className="admin-cell-sub">{r.plan.description ?? r.plan.slug}</span></> },
                {
                  key: "price",
                  header: "Price",
                  cell: (r) => (
                    <>
                      {priceLabel(r.plan)}
                      {r.plan.billingInterval === "year" || r.plan.intervalCount > 1 ? <span className="admin-cell-sub">{formatCentsAmount(Math.round(perMonth(r.plan)))} a month</span> : null}
                      {r.plan.bookingDiscountPercent > 0 && <span className="admin-cell-sub">{r.plan.bookingDiscountPercent}% off rooms and day passes</span>}
                    </>
                  ),
                },
                { key: "members", header: "Members", cell: (r) => <>{r.members}{r.leaving ? <span className="admin-cell-sub">{r.leaving} leaving</span> : null}</> },
                {
                  key: "status",
                  header: "Status",
                  cell: (r) => <span className="hub-status-badge" data-status={r.plan.active ? "active" : "inactive"}>{r.plan.active ? "On sale" : "Retired"}</span>,
                },
                { key: "mrr", header: "Per month", align: "end", cell: (r) => <span className="admin-num">{formatCentsAmount(r.mrrCents)}</span> },
              ]}
            />
          </section>
        </>
      )}
    </div>
  );
}
