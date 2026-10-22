import { describe, expect, it } from "vitest";
import { clientIp, hashIp, scrubMetadata } from "./audit-utils";

describe("scrubMetadata", () => {
  it("removes codes, tokens, passwords and coordinates at any depth", () => {
    const input = {
      distance_m: 412,
      code: "abcd1234abcd1234",
      Password: "hunter2",
      nested: { lat: 32.73, lng: -97.11, keep: "yes", access_token: "x" },
      list: [{ url: "/check-in?code=abc", step: 1 }],
    };
    expect(scrubMetadata(input)).toEqual({
      distance_m: 412,
      nested: { keep: "yes" },
      list: [{ step: 1 }],
    });
  });

  it("leaves plain values unchanged", () => {
    expect(scrubMetadata("text")).toBe("text");
    expect(scrubMetadata(5)).toBe(5);
    expect(scrubMetadata(null)).toBe(null);
  });
});

describe("clientIp", () => {
  it("uses the first x-forwarded-for entry", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then null", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("hashIp", () => {
  const KEY = "test-key-do-not-use-in-production";

  it("is stable for the same IP and key, and never returns the raw IP", () => {
    const hash = hashIp("203.0.113.7", KEY);
    expect(hash).toBe(hashIp("203.0.113.7", KEY));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("203.0.113.7");
  });

  it("differs for different keys, so hashes can't be matched without the key", () => {
    expect(hashIp("203.0.113.7", KEY)).not.toBe(hashIp("203.0.113.7", "another-key"));
  });

  it("returns null when the IP or key is missing", () => {
    expect(hashIp(null, KEY)).toBeNull();
    expect(hashIp("203.0.113.7", undefined)).toBeNull();
  });
});