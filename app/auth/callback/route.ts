import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { safeNextPath } from "@/lib/safe-redirect";
import { friendlyAccountError, NOTICES } from "@/lib/auth-notices";

// Handles both email confirmation (after signup) and password reset links.
// Supabase sends users here with a `code` param — we exchange it for a session
// then redirect to wherever `next` points.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Anyone can edit the link, so only a path on this site is followed.
  const next = safeNextPath(searchParams.get("next"));
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Supabase can redirect here with an error (e.g. expired link)
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(friendlyAccountError(errorDescription ?? error))}`,
    );
  }

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options });
            } catch {}
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: "", ...options });
            } catch {}
          },
        },
      },
    );

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(NOTICES.linkExpired)}`,
  );
}
