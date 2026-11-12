"use server";

import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { logAudit } from "@/lib/audit/log";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  PENDING_EMAIL_COOKIE,
  PENDING_EMAIL_MAX_AGE,
  readPendingEmail,
  RECOVERY_COOKIE,
  RECOVERY_MAX_AGE,
  shortCookie,
  writePendingEmail,
} from "./auth-cookies";
import { isEmail, passwordErrors, readCode } from "./form-rules";
import { toRole } from "./roles";

export type EmailSentState = { error: string | null; email: string; sentAt: number | null };
export type NewPasswordState = {
  error: string | null;
  fieldErrors: Partial<Record<"password" | "confirmPassword", string>>;
  done: boolean;
};
export type VerifyCodeState = { error: string | null; done: boolean };

const RATE_LIMITED = new Set(["over_email_send_rate_limit", "over_request_rate_limit"]);
const TOO_MANY = "Too many emails sent. Please wait a minute and try again.";

// ---------------------------------------------------------------------------
// Password reset (Krishna's public/reset-password.html, plus /reset-password/new)
// ---------------------------------------------------------------------------

// Step 1 (/reset-password): email a reset link.
//
// Uses a plain Supabase client in "implicit" mode instead of the usual cookie client.
// In the default mode the link only works in the browser that asked for it, which
// fails when a phone opens the email in Gmail's or Outlook's own browser. In implicit
// mode the link itself carries a short-lived sign-in (read by /reset-password/new),
// so it works anywhere. The link works once; how long it lasts is the "Email OTP
// expiration" setting in Supabase (the page says 15 minutes, so set it to 900 seconds).
export async function requestPasswordReset(
  _prev: EmailSentState,
  formData: FormData,
): Promise<EmailSentState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!isEmail(email)) {
    return { error: "Please enter a full email address, like name@example.com.", email, sentAt: null };
  }

  const env = getSupabaseEnv();
  if (!env) return { error: "Password reset isn't set up on this version of the site yet.", email, sentAt: null };
  const redirectTo = await siteUrl("/reset-password/new");
  if (!redirectTo) return { error: "Something went wrong. Please try again later.", email, sentAt: null };

  const supabase = createPlainClient(env.url, env.key, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error && RATE_LIMITED.has(error.code ?? "")) return { error: TOO_MANY, email, sentAt: null };
  if (error) console.error(`Password reset email failed: ${error.code ?? error.message}`);

  // Same answer whether or not the address has an account, so this form can't be
  // used to find out who is signed up.
  return { error: null, email, sentAt: Date.now() };
}

// /reset-password/new: sign in with the tokens from the reset link.
export async function startPasswordRecovery(accessToken: string, refreshToken: string): Promise<{ ok: boolean }> {
  if (!getSupabaseEnv()) return { ok: false };
  if (typeof accessToken !== "string" || typeof refreshToken !== "string") return { ok: false };
  if (accessToken.length > 4096 || refreshToken.length > 512) return { ok: false };

  const supabase = await createClient();
  try {
    // setSession checks the tokens with Supabase before saving them as cookies.
    const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error || !data.user) return { ok: false };
    (await cookies()).set(RECOVERY_COOKIE, data.user.id, shortCookie(RECOVERY_MAX_AGE));
    return { ok: true };
  } catch {
    // A garbled token makes the Supabase library throw instead of returning an error.
    return { ok: false };
  }
}

// /reset-password/new: save the new password (same rules as sign-up).
export async function updatePassword(_prev: NewPasswordState, formData: FormData): Promise<NewPasswordState> {
  const password = String(formData.get("password") ?? "");
  const fieldErrors = passwordErrors({ password, confirmPassword: String(formData.get("confirmPassword") ?? "") });
  if (Object.keys(fieldErrors).length > 0) return { error: null, fieldErrors, done: false };

  const expired = "Your reset link has expired. Please ask for a new one.";
  if (!getSupabaseEnv()) return { error: expired, fieldErrors: {}, done: false };

  const cookieStore = await cookies();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || cookieStore.get(RECOVERY_COOKIE)?.value !== user.id) {
    return { error: expired, fieldErrors: {}, done: false };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") {
      return { error: null, fieldErrors: { password: "Please choose a password you haven’t used before." }, done: false };
    }
    if (error.code === "weak_password") {
      return { error: null, fieldErrors: { password: "Your password doesn’t meet all the needs listed below yet." }, done: false };
    }
    return { error: "We couldn't save your new password. Please try again.", fieldErrors: {}, done: false };
  }

  cookieStore.delete(RECOVERY_COOKIE);
  // Sign out every other device, in case someone else had access to the account.
  await supabase.auth.signOut({ scope: "others" });
  await logAudit({
    action: "auth.password_reset",
    outcome: "success",
    actorId: user.id,
    actorRole: toRole(user.app_metadata?.role),
    headers: await headers(),
  });
  return { error: null, fieldErrors: {}, done: true };
}

// ---------------------------------------------------------------------------
// Email confirmation (Krishna's public/verify-email.html)
// ---------------------------------------------------------------------------

const NO_EMAIL = "We don't know which email to check. Please go back and sign up again.";

// Checks the 6-digit code from the sign-up email. On success Supabase confirms the
// email and signs the volunteer in. The email comes from the cookie sign-up set,
// never from the browser form.
export async function verifyEmailCode(_prev: VerifyCodeState, formData: FormData): Promise<VerifyCodeState> {
  const code = readCode(formData.get("code"));
  if (!code) return { error: "Please enter all 6 digits of the code.", done: false };

  const cookieStore = await cookies();
  const pending = readPendingEmail(cookieStore.get(PENDING_EMAIL_COOKIE)?.value);
  if (!pending) return { error: NO_EMAIL, done: false };
  if (!getSupabaseEnv()) return { error: "Sign-up isn't set up on this version of the site yet.", done: false };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: pending.email, token: code, type: "email" });
  if (error) {
    if (RATE_LIMITED.has(error.code ?? "")) return { error: "Too many tries. Please wait a minute and try again.", done: false };
    // Supabase uses the same error ("otp_expired") for a wrong code and an old one.
    return { error: "That code isn't right. Please try again.", done: false };
  }

  cookieStore.delete(PENDING_EMAIL_COOKIE);
  return { error: null, done: true };
}

// Sends the sign-up email (with a new code) again.
export async function resendConfirmationEmail(): Promise<EmailSentState> {
  const cookieStore = await cookies();
  const pending = readPendingEmail(cookieStore.get(PENDING_EMAIL_COOKIE)?.value);
  if (!pending) return { error: NO_EMAIL, email: "", sentAt: null };
  const { email } = pending;
  if (!getSupabaseEnv()) return { error: "Sign-up isn't set up on this version of the site yet.", email, sentAt: null };

  const emailRedirectTo = await siteUrl("/auth/callback?next=/account");
  if (!emailRedirectTo) return { error: "Something went wrong. Please try again later.", email, sentAt: null };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo } });
  if (error && RATE_LIMITED.has(error.code ?? "")) return { error: TOO_MANY, email, sentAt: null };
  if (error) console.error(`Confirmation resend failed: ${error.code ?? error.message}`);

  const sentAt = Date.now();
  cookieStore.set(PENDING_EMAIL_COOKIE, writePendingEmail(email, sentAt), shortCookie(PENDING_EMAIL_MAX_AGE));
  return { error: null, email, sentAt };
}

// ---------------------------------------------------------------------------

// A full link back to this site, for emails. Same rule as sign-up uses.
async function siteUrl(path: string): Promise<string | null> {
  const requestHeaders = await headers();
  const origin =
    requestHeaders.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  try {
    const url = new URL(path, origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
