import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { loginUrl } from "./redirect";
import { toRole, type Role } from "./roles";

// The one place pages, Server Actions and Route Handlers look up who is signed in.
// Reads the session cookie, so call it inside a <Suspense> boundary (Cache Components).

export type CurrentUser = {
  id: string;
  email: string | null;
  role: Role;
};

// Returns the signed-in user, or null. getClaims() verifies the session token's
// signature, so the id and role can be trusted. Cached per request.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;

  const { claims } = data;
  return {
    id: claims.sub,
    email: claims.email ?? null,
    role: toRole(claims.app_metadata?.role),
  };
});

// For pages that need a signed-in user. Sends visitors to /login, then back to `returnTo`.
export async function requireUser(returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginUrl(returnTo));
  return user;
}

// For pages limited to certain roles. Signed-in users without one of the roles are
// sent to their account page, which explains they don't have access.
//
//   const user = await requireRole(["organizer", "admin"], "/events/new");
export async function requireRole(allowed: Role[], returnTo?: string): Promise<CurrentUser> {
  const user = await requireUser(returnTo);
  if (!allowed.includes(user.role)) redirect("/account?denied=1");
  return user;
}
