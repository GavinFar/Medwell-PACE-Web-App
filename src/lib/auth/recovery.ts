// Helpers for the "choose a new password" page (/reset-password/new).
//
// The reset email's link goes to Supabase, which then sends the person to that page
// with a short-lived sign-in in the part of the URL after "#". Browsers never send
// that part to any server, so the page reads it in the browser and hands it to a
// Server Action. Because the link carries its own sign-in, it works in any browser,
// including the one built into Gmail or Outlook on a phone.

export type RecoveryLink =
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "expired" } // used, expired, or broken: they need a new link
  | { kind: "none" }; // page opened without a reset link

// `hash` and `search` are window.location.hash and window.location.search.
export function readRecoveryLink(hash: string, search: string): RecoveryLink {
  const fromHash = new URLSearchParams(hash.replace(/^#/, ""));
  const fromSearch = new URLSearchParams(search.replace(/^\?/, ""));

  if (fromHash.has("error") || fromSearch.has("error")) return { kind: "expired" };
  if (fromHash.get("type") !== "recovery") return { kind: "none" };

  const accessToken = fromHash.get("access_token");
  const refreshToken = fromHash.get("refresh_token");
  if (!accessToken || !refreshToken) return { kind: "expired" };
  return { kind: "tokens", accessToken, refreshToken };
}
