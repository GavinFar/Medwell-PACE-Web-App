import { createHmac, timingSafeEqual } from "node:crypto";

// A check-in pass: proof that someone scanned a valid QR code for an event.
// The QR code itself changes every 30 seconds, which is too short to log in or sign up.
// So after a good scan the server hands out a pass that lasts 30 minutes and works
// only for that event. It travels in the URL (/check-in?pass=...), so it survives
// the trip through /login or /signup and back.
//
// Format: <event id>.<issued-at seconds>.<HMAC-SHA256(event secret, "pass:<event id>.<issued-at>")>
// It's signed with the event's own QR secret, so there's no new secret to manage,
// and a pass for one event can't be used for another.
// Server-only: node:crypto doesn't run in the browser.

export const PASS_TTL_MS = 30 * 60 * 1000;
// Allow a little clock difference between servers, but no passes from the future.
const MAX_FUTURE_MS = 60 * 1000;

export type ParsedPass = { eventId: string; issuedAtSeconds: number; signature: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECONDS = /^\d{1,12}$/;
const HEX_64 = /^[0-9a-f]{64}$/;

function sign(eventId: string, issuedAtSeconds: number, secret: string): string {
  return createHmac("sha256", secret).update(`pass:${eventId}.${issuedAtSeconds}`).digest("hex");
}

export function createPass(eventId: string, secret: string, nowMs: number): string {
  const issuedAtSeconds = Math.floor(nowMs / 1000);
  return `${eventId}.${issuedAtSeconds}.${sign(eventId, issuedAtSeconds, secret)}`;
}

// Checks only the shape. Use verifyPass (with the event's secret) before trusting it.
export function parsePass(pass: unknown): ParsedPass | null {
  if (typeof pass !== "string" || pass.length > 200) return null;
  const parts = pass.split(".");
  if (parts.length !== 3) return null;
  const [eventId, issued, signature] = parts;
  if (!UUID.test(eventId) || !SECONDS.test(issued) || !HEX_64.test(signature)) return null;
  return { eventId: eventId.toLowerCase(), issuedAtSeconds: Number(issued), signature };
}

export function verifyPass(parsed: ParsedPass, secret: string, nowMs: number): boolean {
  const issuedMs = parsed.issuedAtSeconds * 1000;
  if (nowMs - issuedMs > PASS_TTL_MS) return false;
  if (issuedMs - nowMs > MAX_FUTURE_MS) return false;
  // Constant-time comparison, so response timing can't reveal how much of a guess was right.
  const expected = Buffer.from(sign(parsed.eventId, parsed.issuedAtSeconds, secret));
  const given = Buffer.from(parsed.signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
