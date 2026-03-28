import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register");

  const isSetupPage = pathname.startsWith("/setup");

  const isInvitePage = pathname.startsWith("/invite/");

  // Public pages — protocol registry and dataset landing pages (no auth required)
  const isPublicPage =
    pathname.startsWith("/registry/") ||
    pathname.startsWith("/data/");

  const isProtected =
    !isAuthPage && !isSetupPage && !isInvitePage && !isPublicPage && pathname !== "/";

  // Redirect unauthenticated users to login
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages (except to setup,
  // and except when they just signed out — ?signout=1 acts as a safety flag
  // in case cookies haven't been fully cleared by the time this runs).
  const isSigningOut = request.nextUrl.searchParams.get("signout") === "1";
  if (isAuthPage && user && !isSigningOut) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // If authenticated and on a protected page, check if workspace setup is needed.
  // We cache the result in a cookie to avoid a DB round-trip on every request.
  if (user && isProtected && !isSetupPage) {
    const workspaceReadyCookie = request.cookies.get('workspace_ready')?.value

    // Only hit the DB when the cookie is absent or belongs to a different user
    if (workspaceReadyCookie !== user.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("workspace_setup_completed")
        .eq("id", user.id)
        .maybeSingle();

      // If profile exists and setup NOT completed, redirect to setup
      if (profile && !profile.workspace_setup_completed) {
        const url = request.nextUrl.clone();
        url.pathname = "/setup";
        return NextResponse.redirect(url);
      }

      // Cache the "setup done" state so we skip this DB call on future requests
      if (profile?.workspace_setup_completed) {
        supabaseResponse.cookies.set('workspace_ready', user.id, {
          maxAge: 60 * 60 * 24, // 24 hours
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        })
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
