import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
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

  // Protect all Admin routes
  if (pathname.startsWith("/admin")) {
    if (!user) return redirectTo("/login");

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
  ],
};
