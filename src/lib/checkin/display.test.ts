import { describe, expect, it } from "vitest";
import { formatEventRuns, formatEventWhen, formatTime, formatTodayOrWhen, shortName } from "./display";

describe("shortName", () => {
  it("gives the first name and the last initial", () => {
    expect(shortName("Pat Volunteer")).toBe("Pat V.");
  });

  it("trims, capitalizes and takes the initial from the last word", () => {
    expect(shortName("  ana  maria lopez ")).toBe("Ana L.");
  });

  it("keeps a single name as it is", () => {
    expect(shortName("Pat")).toBe("Pat");
  });

  it("falls back to Volunteer", () => {
    expect(shortName(null)).toBe("Volunteer");
    expect(shortName("")).toBe("Volunteer");
    expect(shortName("   ")).toBe("Volunteer");
  });
});

describe("event times (Texas time)", () => {
  it("formats the event's day and time range", () => {
    expect(formatEventWhen("2026-11-21T15:00:00Z", "2026-11-21T18:00:00Z")).toBe(
      "Sat, Nov 21 · 9:00 AM – 12:00 PM",
    );
  });

  it("words the event's times for a sentence", () => {
    expect(formatEventRuns("2026-11-21T15:00:00Z", "2026-11-21T18:00:00Z")).toBe(
      "Sat, Nov 21 from 9:00 AM to 12:00 PM",
    );
  });

  it("says Today instead of the date on the day of the event (Texas time)", () => {
    const start = "2026-11-21T15:00:00Z";
    const end = "2026-11-21T18:00:00Z";
    // 11:30 PM on Nov 20 in Texas is already Nov 21 in UTC.
    expect(formatTodayOrWhen(start, end, Date.parse("2026-11-21T05:30:00Z"))).toBe("Sat, Nov 21 · 9:00 AM – 12:00 PM");
    expect(formatTodayOrWhen(start, end, Date.parse("2026-11-21T06:30:00Z"))).toBe("Today · 9:00 AM – 12:00 PM");
    expect(formatTodayOrWhen(start, end, Date.parse("2026-11-21T17:00:00Z"))).toBe("Today · 9:00 AM – 12:00 PM");
  });

  it("formats a time of day", () => {
    expect(formatTime("2026-11-21T15:04:00Z")).toBe("9:04 AM");
  });
});
