"use server";

import type { AuthError } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit/log";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { REMEMBER_COOKIE } from "@/lib/supabase/remember";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "./redirect";
import { toRole } from "./roles";
import { getCurrentUser } from "./session";

export type SignInState = { error: string | null };
export type SignUpState = { error: string | null; message: string | null };

// Creates a participant account. Supabase's profile trigger reads display_name
// from user metadata; the database assigns the least-privileged participant role.
export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const displayName = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (displayName.length < 2 || displayName.length > 80) {
    return { error: "Enter a name between 2 and 80 characters.", message: null };
  }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address.", message: null };
  }
  if (password.length < 8) {
    return { error: "Use a password with at least 8 characters.", message: null };
  }
  if (password !== confirmPassword) {
    return { error: "Your passwords don't match.", message: null };
  }
  if (!getSupabaseEnv()) {
    return { error: "Sign-up isn't configured on this version of the site yet.", message: null };
  }

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin")
    ?? process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  let emailRedirectTo: string;
  try {
    const redirectUrl = new URL("/auth/callback?next=/account", origin);
    if (redirectUrl.protocol !== "https:" && redirectUrl.protocol !== "http:") throw new Error("Invalid protocol");
    emailRedirectTo = redirectUrl.toString();
  } catch {
    return { error: "Sign-up couldn't determine this site's address. Please try again later.", message: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: { display_name: displayName },
    },
  });

  if (error) {
    if (error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit") {
      return { error: "Too many sign-up attempts. Wait a minute and try again.", message: null };
    }
    return { error: "We couldn't create an account with those details. Please check them and try again.", message: null };
  }

  if (data.session) redirect("/account");
  return {
    error: null,
    message: "Account created. Check your email for a confirmation link, then sign in.",
  };
}

// Signs in with email and password. On success Supabase sets the session cookies
// and the user is sent to `next`; on failure the form shows the error.
export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }
  if (!getSupabaseEnv()) {
    console.error("Sign-in attempted, but Supabase is not configured on this deployment.");
    return { error: "Sign-in isn't set up on this version of the site yet." };
  }

  // Unchecked Remember Me: keep the session only until the browser closes.
  const remember = formData.get("remember") === "on";
  const supabase = await createClient({ remember });
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

  const cookieStore = await cookies();
  if (remember) {
    cookieStore.delete(REMEMBER_COOKIE);
  } else {
    // A browser-session cookie itself, so it disappears along with the login.
    cookieStore.set(REMEMBER_COOKIE, "0", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
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
  if (!getSupabaseEnv()) redirect("/login");
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(REMEMBER_COOKIE);

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
