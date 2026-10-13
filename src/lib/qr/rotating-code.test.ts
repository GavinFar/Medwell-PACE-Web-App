import { describe, expect, it } from "vitest";
import {
  WINDOW_SECONDS,
  codeForWindow,
  currentCode,
  verifyCode,
  windowAt,
} from "./rotating-code";

const SECRET = "test-secret-do-not-use-in-production";
const WINDOW_MS = WINDOW_SECONDS * 1000;
// A fixed moment 10 seconds into a window, so tests don't depend on the real clock.
const NOW = 1_800_000_000_000 - (1_800_000_000_000 % WINDOW_MS) + 10_000;

describe("codeForWindow", () => {
  it("is the same for the same secret and window", () => {
    expect(codeForWindow(SECRET, 42)).toBe(codeForWindow(SECRET, 42));
  });

  it("changes from one window to the next", () => {
    expect(codeForWindow(SECRET, 42)).not.toBe(codeForWindow(SECRET, 43));
  });

  it("differs between events with different secrets", () => {
    expect(codeForWindow(SECRET, 42)).not.toBe(codeForWindow("another-event-secret", 42));
  });

  it("is 16 lowercase hex characters", () => {
    expect(codeForWindow(SECRET, 42)).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("currentCode", () => {
  it("returns the code for the current window and the seconds until it rotates", () => {
    const { code, secondsRemaining } = currentCode(SECRET, NOW);
    expect(code).toBe(codeForWindow(SECRET, windowAt(NOW)));
    expect(secondsRemaining).toBe(WINDOW_SECONDS - 10);
  });
});

describe("verifyCode", () => {
  const current = codeForWindow(SECRET, windowAt(NOW));

  it("accepts the current code", () => {
    expect(verifyCode(SECRET, current, NOW)).toBe(true);
  });

  it("accepts the previous window's code, for scans made just as the code rotates", () => {
    expect(verifyCode(SECRET, current, NOW + WINDOW_MS)).toBe(true);
  });

  it("rejects a code two windows old, such as a screenshot", () => {
    expect(verifyCode(SECRET, current, NOW + 2 * WINDOW_MS)).toBe(false);
  });

  it("rejects a code from a future window", () => {
    const next = codeForWindow(SECRET, windowAt(NOW) + 1);
    expect(verifyCode(SECRET, next, NOW)).toBe(false);
  });

  it("rejects a code made with a different event's secret", () => {
    const other = codeForWindow("another-event-secret", windowAt(NOW));
    expect(verifyCode(SECRET, other, NOW)).toBe(false);
  });

  it("rejects malformed codes", () => {
    expect(verifyCode(SECRET, "", NOW)).toBe(false);
    expect(verifyCode(SECRET, current.slice(0, 8), NOW)).toBe(false);
    expect(verifyCode(SECRET, current.toUpperCase(), NOW)).toBe(false);
    expect(verifyCode(SECRET, `${current}0`, NOW)).toBe(false);
  });
});
