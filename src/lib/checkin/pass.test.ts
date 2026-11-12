import { describe, expect, it } from "vitest";
import { createPass, parsePass, verifyPass } from "./pass";

const EVENT = "6f1c2d3e-4a5b-4c6d-8e7f-001122334455";
const OTHER_EVENT = "0a1b2c3d-4e5f-4a6b-8c7d-998877665544";
const SECRET = "a".repeat(64);
const NOW = 1_800_000_000_000;

describe("check-in pass", () => {
  it("is valid for the same event within 30 minutes", () => {
    const parsed = parsePass(createPass(EVENT, SECRET, NOW));
    expect(parsed).not.toBeNull();
    expect(parsed!.eventId).toBe(EVENT);
    expect(verifyPass(parsed!, SECRET, NOW + 29 * 60_000)).toBe(true);
  });

  it("expires after 30 minutes", () => {
    const parsed = parsePass(createPass(EVENT, SECRET, NOW))!;
    expect(verifyPass(parsed, SECRET, NOW + 31 * 60_000)).toBe(false);
  });

  it("is rejected with another event's secret", () => {
    const parsed = parsePass(createPass(EVENT, SECRET, NOW))!;
    expect(verifyPass(parsed, "b".repeat(64), NOW)).toBe(false);
  });

  it("is rejected when the event id is swapped", () => {
    const [, issued, sig] = createPass(EVENT, SECRET, NOW).split(".");
    const parsed = parsePass(`${OTHER_EVENT}.${issued}.${sig}`)!;
    expect(parsed).not.toBeNull();
    expect(verifyPass(parsed, SECRET, NOW)).toBe(false);
  });

  it("is rejected when the timestamp is edited", () => {
    const [id, issued, sig] = createPass(EVENT, SECRET, NOW).split(".");
    const parsed = parsePass(`${id}.${Number(issued) + 600}.${sig}`)!;
    expect(parsed).not.toBeNull();
    expect(verifyPass(parsed, SECRET, NOW + 30 * 60_000)).toBe(false);
  });

  it("is rejected when issued more than a minute in the future", () => {
    const parsed = parsePass(createPass(EVENT, SECRET, NOW + 5 * 60_000))!;
    expect(verifyPass(parsed, SECRET, NOW)).toBe(false);
  });

  it("parsePass rejects anything that isn't a pass", () => {
    expect(parsePass("x.y.z")).toBeNull();
    expect(parsePass(42)).toBeNull();
    expect(parsePass(null)).toBeNull();
    expect(parsePass(`${EVENT}.12.34.${"a".repeat(64)}`)).toBeNull();
    expect(parsePass(`${EVENT}.1.5.${"a".repeat(64)}`)).toBeNull();
    expect(parsePass(`${EVENT}.123.${"g".repeat(64)}`)).toBeNull();
  });
});
