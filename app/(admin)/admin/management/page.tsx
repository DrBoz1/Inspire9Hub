import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ManagementClient from "./ManagementClient";

// Who holds admin access is reconciled against Supabase Auth on every request —
// this page must never be served from a prerendered snapshot.
export const dynamic = "force-dynamic";

export default async function ManagementPage() {
  const supabase = await createClient();

  const [{ data: staff }, { data: auth }] = await Promise.all([
    supabase.from("admins").select("*").order("role", { ascending: false }),
    supabase.auth.getUser(),
  ]);

  const rows = staff ?? [];

  // `public.admins` has no foreign key to `auth.users`, so deleting a login from the
  // Supabase Auth dashboard leaves its admins row behind. Such a row can never sign
  // in, so check each id against Auth and let the client separate the dead ones out
  // instead of listing them as active staff.
  const authAdmin = createAdminClient();
  const reconciled = await Promise.all(
    rows.map(async (row) => {
      const { data } = await authAdmin.auth.admin.getUserById(row.id);
      return {
        ...row,
        hasAuthUser: Boolean(data?.user),
        // Auth is the source of truth for the address — admins.email goes stale
        // the moment it's changed on the login account.
        email: data?.user?.email ?? row.email,
      };
    }),
  );

  return (
    <div className="space-y-8 font-poppins">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
          Staff Management
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
          Manage platform administrators and permissions.
        </p>
      </div>

      <ManagementClient
        initialStaff={reconciled}
        currentAdminId={auth.user?.id ?? null}
      />
    </div>
  );
}
