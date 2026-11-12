import { DEFAULT_AFTER_LOGIN, safeNextPath } from "./redirect";

// Short-lived cookies used by the sign-up and password reset pages.
// Both are httpOnly (browser scripts can't read them) and expire on their own.

// The email someone just signed up with, so /verify-email can show it and resend
// the confirmation without putting the address in the URL (and the server logs).
export const PENDING_EMAIL_COOKIE = "pace-pending-email";
export const PENDING_EMAIL_MAX_AGE = 60 * 60; // 1 hour, the same as the confirmation link

// Stores the address and when its confirmation email was sent (for the Resend countdown).
// `next` is where to go once the email is confirmed, e.g. a check-in that's waiting
// (/check-in?pass=...), so a volunteer who signs up at an event doesn't have to scan again.
export function writePendingEmail(email: string, sentAt: number, next?: string | null): string {
  return JSON.stringify({ email, sentAt, next: cleanNext(next) });
}

export type PendingEmail = { email: string; sentAt: number; next: string | null };

export function readPendingEmail(value: string | undefined): PendingEmail | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { email, sentAt, next } = parsed as Record<string, unknown>;
    if (typeof email !== "string" || email.length > 254 || typeof sentAt !== "number") return null;
    return { email, sentAt, next: cleanNext(next) };
  } catch {
    return null;
  }
}

// Same-site paths only (see safeNextPath); the default /account counts as "nothing waiting".
function cleanNext(next: unknown): string | null {
  const path = safeNextPath(next);
  return path === DEFAULT_AFTER_LOGIN ? null : path;
}

// Set after someone opens a valid password reset link: the id of the account the
// link was for. Saving a new password requires it, so the "choose a new password"
// form only works right after opening a reset link, not for any signed-in visitor.
export const RECOVERY_COOKIE = "pace-recovery";
export const RECOVERY_MAX_AGE = 15 * 60; // 15 minutes to choose a new password

export function shortCookie(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
