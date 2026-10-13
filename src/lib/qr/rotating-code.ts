import { createHmac, timingSafeEqual } from "node:crypto";

// Rotating check-in codes, similar to TOTP (RFC 6238).
// A code is an HMAC of the current 30-second time window, keyed by the event's secret.
// Only the server knows the secret, so only the server can create or check codes.
// Server-only: node:crypto doesn't run in the browser.

export const WINDOW_SECONDS = 30;
const WINDOW_MS = WINDOW_SECONDS * 1000;
// 16 hex characters = 64 bits, far too many to guess within one window.
const CODE_LENGTH = 16;

export function windowAt(timeMs: number): number {
  return Math.floor(timeMs / WINDOW_MS);
}

export function codeForWindow(secret: string, window: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(window));
  return createHmac("sha256", secret).update(counter).digest("hex").slice(0, CODE_LENGTH);
}

export function currentCode(secret: string, nowMs: number) {
  const window = windowAt(nowMs);
  const rotatesAtMs = (window + 1) * WINDOW_MS;
  return {
    code: codeForWindow(secret, window),
    secondsRemaining: (rotatesAtMs - nowMs) / 1000,
  };
}

// Accepts the current window's code or the one just before it, so a scan made
// right as the code rotates still succeeds. Anything older is rejected.
export function verifyCode(secret: string, code: string, nowMs: number): boolean {
  const window = windowAt(nowMs);
  return [window, window - 1].some((w) => safeEqual(code, codeForWindow(secret, w)));
}

// Constant-time comparison, so response timing can't reveal how much of a guess was right.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
