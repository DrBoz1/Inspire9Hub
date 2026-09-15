import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminDashboardView } from "./AdminDashboardView";
import { loadDashboardData } from "./dashboard-data";

export const metadata: Metadata = { title: "Admin dashboard | Inspire9 Hub" };

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  const [data, admin] = await Promise.all([
    loadDashboardData(),
    user ? createAdminClient().from("admins").select("full_name").eq("id", user.id).maybeSingle() : null,
  ]);

  return <AdminDashboardView {...data} adminName={admin?.data?.full_name ?? null} />;
}
