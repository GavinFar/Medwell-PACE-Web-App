import "server-only";
import { createClient } from "@supabase/supabase-js";
import { connection } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export type OrganizationOption = { id: string; name: string };

// The groups a volunteer can pick on the sign-up form, sorted by name.
// Uses list_organizations() (supabase/migrations/20261111195437_list_organizations.sql),
// which signed-out visitors may call; it returns only each group's id and name.
export async function listOrganizations(): Promise<OrganizationOption[]> {
  await connection(); // fetch per request, so new groups appear without a redeploy
  const env = getSupabaseEnv();
  if (!env) return [];

  const supabase = createClient(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.rpc("list_organizations");
  if (error) {
    console.error(`Couldn't load organizations for sign-up: ${error.message}`);
    return [];
  }
  return (data ?? []) as OrganizationOption[];
}
