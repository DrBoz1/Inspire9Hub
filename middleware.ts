import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          request.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // Protect all Admin routes
  if (pathname.startsWith("/admin")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));

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
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    //only 'super_admin' can access /admin/management
    if (
      pathname.startsWith("/admin/management") &&
      adminData.role !== "super_admin"
    ) {
      return NextResponse.redirect(new URL("/admin/approvals", request.url));
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
