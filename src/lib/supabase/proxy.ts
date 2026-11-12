import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { homeFor } from "@/lib/auth/redirect";
import { toRole } from "@/lib/auth/roles";
import { getSupabaseEnv } from "./env";
import { applyRemember, REMEMBER_COOKIE } from "./remember";

// Refreshes the signed-in user's session cookies before each page renders.
// Called from src/proxy.ts.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = getSupabaseEnv();
  if (!env) return response;
  const keepSession = request.cookies.get(REMEMBER_COOKIE)?.value !== "0";

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, applyRemember(options, keepSession)),
        );
        // No-cache headers, so a CDN never serves one user's session to another.
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Don't add code between createServerClient and getClaims(): getClaims()
  // is what refreshes an expired session.
  const { data } = await supabase.auth.getClaims();

  // The home page (Krishna's landing page, a static file) can't tell who is logged in,
  // so send signed-in visitors to their own page instead: volunteers to /dashboard,
  // everyone else to /account. Logged-out visitors still see the landing page.
  if (data?.claims && request.nextUrl.pathname === "/") {
    const home = request.nextUrl.clone();
    home.pathname = homeFor(toRole(data.claims.app_metadata?.role));
    home.search = "";
    const redirect = NextResponse.redirect(home);
    // Keep any refreshed session cookies and the no-cache headers.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    for (const key of ["cache-control", "expires", "pragma"]) {
      const value = response.headers.get(key);
      if (value) redirect.headers.set(key, value);
    }
    // Never cache this redirect: it depends on who is asking.
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }

  return response;
}
