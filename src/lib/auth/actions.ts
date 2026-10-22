"use server";

import type { AuthError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit/log";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "./redirect";
import { toRole } from "./roles";
import { getCurrentUser } from "./session";

export type SignInState = { error: string | null };

// Signs in with email and password. On success Supabase sets the session cookies
// and the user is sent to `next`; on failure the form shows the error.
export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  const requestHeaders = await headers();

  if (error) {
    // No email in the log: failed attempts may contain typos of other people's addresses.
    await logAudit({
      action: "auth.login",
      outcome: "failure",
      reasonCode: error.code ?? "UNKNOWN",
      headers: requestHeaders,
    });
    return { error: messageFor(error) };
  }

  await logAudit({
    action: "auth.login",
    outcome: "success",
    actorId: data.user.id,
    actorRole: toRole(data.user.app_metadata?.role),
    headers: requestHeaders,
  });
  redirect(next);
}

export async function signOut() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  await supabase.auth.signOut();

  if (user) {
    await logAudit({
      action: "auth.logout",
      outcome: "success",
      actorId: user.id,
      actorRole: user.role,
      headers: await headers(),
    });
  }
  redirect("/login");
}

// The same message for a wrong email and a wrong password, so the form
// doesn't reveal which addresses have accounts.
function messageFor(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "email_not_confirmed":
      return "Confirm your email address first, using the link we sent you.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Wait a minute and try again.";
    default:
      return "We couldn't sign you in. Please try again.";
  }
}
