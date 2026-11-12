"use server";

import type { AuthError } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit/log";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { REMEMBER_COOKIE } from "@/lib/supabase/remember";
import { createClient } from "@/lib/supabase/server";
import { PENDING_EMAIL_COOKIE, PENDING_EMAIL_MAX_AGE, shortCookie, writePendingEmail } from "./auth-cookies";
import { signupErrors } from "./form-rules";
import { safeNextPath } from "./redirect";
import { toRole } from "./roles";
import { getCurrentUser } from "./session";

export type SignInState = { error: string | null };
export type SignUpState = {
  error: string | null;
  fieldErrors: Partial<Record<"fullName" | "email" | "password" | "confirmPassword" | "agreeTerms" | "agreeSharing", string>>;
};

// The version of the sign-up agreements (the two checkboxes) a volunteer accepted.
// Saved on their profile with the time; change it when the wording changes.
const CONSENT_VERSION = "1.0";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Creates a volunteer (participant) account from Krishna's sign-up form.
// The profile trigger in the database copies display_name, organization_id (only if it's
// a real organization) and consent_version from the sign-up metadata; the database
// assigns the least-privileged participant role. Field names match the form.
export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const fields = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    agreeTerms: formData.get("agreeTerms") === "on",
    agreeSharing: formData.get("agreeSharing") === "on",
  };
  const fieldErrors = signupErrors(fields);
  if (Object.keys(fieldErrors).length > 0) return { error: null, fieldErrors };

  // Optional: the group picked from the dropdown ("" means none).
  const organizationId = String(formData.get("organizationId") ?? "");

  if (!getSupabaseEnv()) {
    return { error: "Sign-up isn't set up on this version of the site yet.", fieldErrors: {} };
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
    return { error: "Something went wrong. Please try again later.", fieldErrors: {} };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: fields.email,
    password: fields.password,
    options: {
      emailRedirectTo,
      data: {
        display_name: fields.fullName.trim(),
        ...(UUID.test(organizationId) ? { organization_id: organizationId } : {}),
        consent_version: CONSENT_VERSION,
      },
    },
  });

  if (error) {
    if (error.code === "over_request_rate_limit" || error.code === "over_email_send_rate_limit") {
      return { error: "Too many sign-up attempts. Please wait a minute and try again.", fieldErrors: {} };
    }
    if (error.code === "weak_password") {
      return { error: null, fieldErrors: { password: "Your password doesn’t meet all the needs listed below yet." } };
    }
    return { error: "We couldn't create your account. Please check your details and try again.", fieldErrors: {} };
  }

  if (data.session) redirect("/account");
  // Remember the address for /verify-email (shown there, and used to check the code).
  (await cookies()).set(PENDING_EMAIL_COOKIE, writePendingEmail(fields.email, Date.now()), shortCookie(PENDING_EMAIL_MAX_AGE));
  redirect("/verify-email");
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
    // Right password, but they never entered the code from their email: send them to
    // the code page (Supabase only says this after checking the password).
    if (error.code === "email_not_confirmed") {
      (await cookies()).set(PENDING_EMAIL_COOKIE, writePendingEmail(email, 0), shortCookie(PENDING_EMAIL_MAX_AGE));
      redirect("/verify-email");
    }
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
      return "Please check your email and password and try again.";
    case "email_not_confirmed":
      return "Please confirm your email first, using the 6-digit code we sent you.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a minute and try again.";
    default:
      return "Please try again in a moment.";
  }
}
