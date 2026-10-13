// Public Supabase settings, safe to use in the browser.
// The Supabase-Vercel integration may set either the legacy "anon" key name or the newer
// "publishable" key name, so accept both. Each name must be written out in full: Next.js
// only inlines NEXT_PUBLIC_* variables into browser code when they are referenced directly.
// Never read SUPABASE_SERVICE_ROLE_KEY here; it must stay server-only.

export type SupabaseEnv = { url: string; key: string };

export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export function requireSupabaseEnv(): SupabaseEnv {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in the values.",
    );
  }
  return env;
}
