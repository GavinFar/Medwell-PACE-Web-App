import "server-only";
import { currentCode, verifyCode } from "./rotating-code";

// QR check-in demo. Uses one secret from the environment; the real feature will
// give each event its own secret, stored in the database. Never send it to the browser.

function getDemoSecret(): string | null {
  return process.env.QR_DEMO_SECRET || null;
}

export function isDemoConfigured(): boolean {
  return getDemoSecret() !== null;
}

// Throws if the demo secret isn't set; check isDemoConfigured() first.
export function currentDemoCode() {
  return currentCode(requireSecret(), Date.now());
}

export function verifyDemoCode(code: string): boolean {
  return verifyCode(requireSecret(), code, Date.now());
}

function requireSecret(): string {
  const secret = getDemoSecret();
  if (!secret) throw new Error("QR_DEMO_SECRET is not set");
  return secret;
}
