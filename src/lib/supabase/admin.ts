import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "./env";

// Supabase client with the service-role key. It BYPASSES row-level security,
// so use it only for trusted server work (audit logging, the verified
// check-in pipeline), never to fetch data on a user's behalf.
// Server-only: never import this from a Client Component.
export function createAdminClient() {
  const { url } = requireSupabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}