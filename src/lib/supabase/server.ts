import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseEnv } from "./env";

// Supabase client for Server Components, Server Functions and Route Handlers.
// Create a new one per request; never share a client between requests.
export async function createClient() {
  // Read cookies first: it marks the caller as per-request, so the build never
  // prerenders past this point and doesn't need Supabase keys to succeed.
  const cookieStore = await cookies();
  const { url, key } = requireSupabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components can't set cookies. That's fine: src/proxy.ts
          // refreshes the session cookies on every request.
        }
      },
    },
  });
}
