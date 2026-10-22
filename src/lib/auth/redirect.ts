// Where to send someone after they log in. The `next` value comes from the URL,
// so anyone can craft it; only same-site paths are allowed, otherwise a link like
// /login?next=https://evil.example would bounce users to another site.

export const DEFAULT_AFTER_LOGIN = "/account";

export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_AFTER_LOGIN;
  // Must be a single-slash path: "//host" and "/\host" are treated as other sites by browsers.
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return DEFAULT_AFTER_LOGIN;
  }
  if (value === "/login" || value.startsWith("/login?")) return DEFAULT_AFTER_LOGIN;
  return value;
}

export function loginUrl(nextPath?: string): string {
  const next = safeNextPath(nextPath);
  return next === DEFAULT_AFTER_LOGIN ? "/login" : `/login?next=${encodeURIComponent(next)}`;
}
