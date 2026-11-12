import { describe, expect, it } from "vitest";
import { readPendingEmail, writePendingEmail } from "./auth-cookies";

describe("pending email cookie", () => {
  it("round-trips the email and when the confirmation was sent", () => {
    const value = writePendingEmail("pat@example.com", 1_700_000_000_000);
    expect(readPendingEmail(value)).toEqual({ email: "pat@example.com", sentAt: 1_700_000_000_000 });
  });

  it("returns null for a missing or tampered cookie", () => {
    expect(readPendingEmail(undefined)).toBeNull();
    expect(readPendingEmail("not json")).toBeNull();
    expect(readPendingEmail(JSON.stringify({ email: 42, sentAt: 1 }))).toBeNull();
    expect(readPendingEmail(JSON.stringify({ email: "a@b.co", sentAt: "soon" }))).toBeNull();
  });

  it("rejects an address too long to be real", () => {
    expect(readPendingEmail(JSON.stringify({ email: `${"a".repeat(250)}@b.co`, sentAt: 1 }))).toBeNull();
  });
});
