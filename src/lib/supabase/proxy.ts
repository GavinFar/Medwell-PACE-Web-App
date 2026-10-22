import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
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
  await supabase.auth.getClaims();

  return response;
}
