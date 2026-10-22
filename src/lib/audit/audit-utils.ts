import { createHmac } from "node:crypto";

// Pure helpers for audit logging, kept separate from log.ts so they can be
// unit tested (log.ts imports "server-only", which tests can't load).

// Keys that must never reach the audit log, even inside metadata.
// Matching is case-insensitive and applies at every nesting level.
const BLOCKED_KEYS = new Set([
  "password",
  "token",
  "access_token",
  "refresh_token",
  "code",
  "secret",
  "url",
  "lat",
  "lng",
  "latitude",
  "longitude",
]);

// Removes blocked keys from metadata before it is stored.
export function scrubMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubMetadata);
  if (value && typeof value === "object") {
    const clean: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      if (!BLOCKED_KEYS.has(key.toLowerCase())) clean[key] = scrubMetadata(inner);
    }
    return clean;
  }
  return value;
}

// The client's IP as reported by Vercel's proxy (first entry of x-forwarded-for).
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip") || null;
}

// Keyed hash of an IP, so repeat offenders can be matched without storing raw
// IPs. Returns null when there is no IP or no key configured.
export function hashIp(ip: string | null | undefined, key: string | undefined): string | null {
  if (!ip || !key) return null;
  return createHmac("sha256", key).update(ip).digest("hex");
}