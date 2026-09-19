import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // Reassigned inside setAll below whenever Supabase needs to refresh the
  // session — must stay a `let` so the refreshed cookies actually reach the browser.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // Carries any refreshed session cookies onto a redirect response —
  // otherwise a token refresh right before a redirect would be lost.
  const redirectTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  // Every path this runs on is for signed-in people only. Turning visitors away
  // here means a signed-out request never renders a page or queries the database:
  // under load (or from a bot) that was the difference between ~1,200 and ~120
  // requests a second, and every one of the slow ones hit Supabase.
  if (!user) return redirectTo("/login");

  // Protect all Admin routes
  if (pathname.startsWith("/admin")) {

    const { data: adminData } = await supabase
      .from("admins")
      .select("role")
      .eq("id", user.id)
      .single();

    // If not an admin at all, kick to dashboard
    if (
      !adminData ||
      (adminData.role !== "admin" && adminData.role !== "super_admin")
    ) {
      return redirectTo("/dashboard");
    }

    //only 'super_admin' can access /admin/management
    if (
      pathname.startsWith("/admin/management") &&
      adminData.role !== "super_admin"
    ) {
      return redirectTo("/admin/approvals");
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/induction/:path*",
    "/profile/:path*",
    "/history/:path*",
    "/bookings/:path*",
    "/membership/:path*",
    "/spaces/:path*",
    "/support/:path*",
  ],
};
