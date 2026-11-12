import { describe, expect, it } from "vitest";
import { checkEventForm, localToUtc, utcToLocal, type EventFormValues } from "./form-rules";

const NOW = Date.parse("2026-11-12T12:00:00Z");

const valid: EventFormValues = {
  title: "Community Health Screening",
  description: "Greet visitors.",
  locationName: "Metro Wellness Pavilion",
  latitude: "32.7357",
  longitude: "-97.1081",
  radiusM: "100",
  startsAt: "2026-11-18T09:00",
  endsAt: "2026-11-18T12:00",
  points: "100",
  status: "published",
};

describe("localToUtc / utcToLocal (Texas time)", () => {
  it("converts standard time (UTC-6)", () => {
    expect(localToUtc("2026-11-18T09:00")).toBe("2026-11-18T15:00:00.000Z");
  });
  it("converts daylight time (UTC-5)", () => {
    expect(localToUtc("2026-07-04T09:00")).toBe("2026-07-04T14:00:00.000Z");
  });
  it("round-trips", () => {
    expect(utcToLocal("2026-11-18T15:00:00.000Z")).toBe("2026-11-18T09:00");
    expect(utcToLocal(localToUtc("2026-03-20T18:30")!)).toBe("2026-03-20T18:30");
  });
  it("rejects bad input", () => {
    expect(localToUtc("")).toBeNull();
    expect(localToUtc("2026-02-30T09:00")).toBeNull();
    expect(localToUtc("tomorrow")).toBeNull();
  });
});

describe("checkEventForm", () => {
  it("accepts a valid event and converts it to database columns", () => {
    const { record, errors } = checkEventForm(valid, { isNew: true, nowMs: NOW });
    expect(errors).toBeNull();
    expect(record).toMatchObject({
      title: "Community Health Screening",
      latitude: 32.7357,
      longitude: -97.1081,
      radius_m: 100,
      points: 100,
      starts_at: "2026-11-18T15:00:00.000Z",
      ends_at: "2026-11-18T18:00:00.000Z",
      status: "published",
    });
  });

  it("stores empty optional text as null", () => {
    const { record } = checkEventForm({ ...valid, description: "", locationName: "" }, { isNew: true, nowMs: NOW });
    expect(record?.description).toBeNull();
    expect(record?.location_name).toBeNull();
  });

  it("requires a title", () => {
    expect(checkEventForm({ ...valid, title: "" }, { isNew: true, nowMs: NOW }).errors?.title).toBeDefined();
  });

  it("rejects an end time before or equal to the start time", () => {
    const r = checkEventForm({ ...valid, endsAt: "2026-11-18T09:00" }, { isNew: true, nowMs: NOW });
    expect(r.errors?.endsAt).toBeDefined();
  });

  it("rejects a new event that starts in the past, but allows editing one", () => {
    const past = { ...valid, startsAt: "2026-11-01T09:00", endsAt: "2026-11-01T12:00" };
    expect(checkEventForm(past, { isNew: true, nowMs: NOW }).errors?.startsAt).toBeDefined();
    expect(checkEventForm(past, { isNew: false, nowMs: NOW }).errors).toBeNull();
  });

  it("enforces the database's limits on points, radius and coordinates", () => {
    const bad = checkEventForm(
      { ...valid, points: "1001", radiusM: "5", latitude: "91", longitude: "-181" },
      { isNew: true, nowMs: NOW },
    );
    expect(bad.errors).toMatchObject({
      points: expect.any(String),
      radiusM: expect.any(String),
      latitude: expect.any(String),
      longitude: expect.any(String),
    });
  });

  it("rejects decimals and negative numbers for points and radius", () => {
    const bad = checkEventForm({ ...valid, points: "-5", radiusM: "50.5" }, { isNew: true, nowMs: NOW });
    expect(bad.errors?.points).toBeDefined();
    expect(bad.errors?.radiusM).toBeDefined();
  });
});