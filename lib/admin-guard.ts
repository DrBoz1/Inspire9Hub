import { createClient } from "@/lib/supabase/server";

export type AdminRole = "admin" | "super_admin";

/**
 * Server actions are public endpoints, so every admin action checks its caller
 * itself instead of trusting the proxy. Server code only.
 */
export async function requireAdmin(roles: AdminRole[] = ["admin", "super_admin"]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has ended. Sign in again." } as const;

  const { data: actor } = await supabase.from("admins").select("role").eq("id", user.id).maybeSingle();
  const role = actor?.role as AdminRole | undefined;
  if (!role || !roles.includes(role)) {
    return { error: roles.includes("admin") ? "Only admins can do that." : "Only a super admin can do that." } as const;
  }
  return { supabase, user, role } as const;
}
