import { describe, expect, it } from "vitest";
import { readPendingEmail, writePendingEmail } from "./auth-cookies";

describe("pending email cookie", () => {
  it("round-trips the email and when the confirmation was sent", () => {
    const value = writePendingEmail("pat@example.com", 1_700_000_000_000);
    expect(readPendingEmail(value)).toEqual({ email: "pat@example.com", sentAt: 1_700_000_000_000, next: null });
  });

  it("remembers where to go after confirming (a waiting check-in), same-site paths only", () => {
    const pass = "/check-in?pass=6f1c2d3e-4a5b-4c6d-8e7f-001122334455.1800000000.abc";
    expect(readPendingEmail(writePendingEmail("pat@example.com", 1, pass))?.next).toBe(pass);
    expect(readPendingEmail(writePendingEmail("pat@example.com", 1, "https://evil.example"))?.next).toBeNull();
    expect(readPendingEmail(writePendingEmail("pat@example.com", 1, "//evil.example"))?.next).toBeNull();
    expect(readPendingEmail(JSON.stringify({ email: "a@b.co", sentAt: 1, next: "https://evil.example" }))?.next).toBeNull();
    expect(readPendingEmail(JSON.stringify({ email: "a@b.co", sentAt: 1, next: 42 }))).toEqual({ email: "a@b.co", sentAt: 1, next: null });
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
