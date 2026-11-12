import { describe, expect, it } from "vitest";
import { canManageEvent, distanceMeters, eventState, flagReason } from "./rules";

describe("distanceMeters", () => {
  it("measures 0.0009 degrees of latitude as about 100 m", () => {
    const d = distanceMeters({ lat: 32.73, lng: -97.11 }, { lat: 32.7309, lng: -97.11 });
    expect(Math.abs(d - 100)).toBeLessThanOrEqual(1);
  });

  it("is zero for the same point", () => {
    expect(distanceMeters({ lat: 32.73, lng: -97.11 }, { lat: 32.73, lng: -97.11 })).toBe(0);
  });
});

describe("flagReason", () => {
  it("flags a missing location", () => {
    expect(flagReason(null, 150)).toBe("no_location");
  });

  it("flags a location outside the radius", () => {
    expect(flagReason({ distanceM: 200, accuracyM: 20 }, 150)).toBe("outside_radius");
  });

  it("prefers outside_radius over low_accuracy", () => {
    expect(flagReason({ distanceM: 900, accuracyM: 500 }, 150)).toBe("outside_radius");
  });

  it("flags low accuracy", () => {
    expect(flagReason({ distanceM: 80, accuracyM: 350 }, 150)).toBe("low_accuracy");
  });

  it("does not flag a good location inside the radius", () => {
    expect(flagReason({ distanceM: 80, accuracyM: 20 }, 150)).toBeNull();
    expect(flagReason({ distanceM: 150, accuracyM: 200 }, 150)).toBeNull();
  });
});

describe("eventState", () => {
  const event = {
    status: "published",
    starts_at: "2026-11-21T15:00:00Z",
    ends_at: "2026-11-21T18:00:00Z",
  };
  const at = (iso: string) => Date.parse(iso);

  it("is open between the start and the end", () => {
    expect(eventState(event, at("2026-11-21T15:00:00Z"))).toBe("open");
    expect(eventState(event, at("2026-11-21T17:59:59Z"))).toBe("open");
  });

  it("is not_started before the start", () => {
    expect(eventState(event, at("2026-11-21T14:59:59Z"))).toBe("not_started");
  });

  it("is ended at the end time", () => {
    expect(eventState(event, at("2026-11-21T18:00:00Z"))).toBe("ended");
  });

  it("is unavailable for draft and cancelled events", () => {
    const now = at("2026-11-21T16:00:00Z");
    expect(eventState({ ...event, status: "draft" }, now)).toBe("unavailable");
    expect(eventState({ ...event, status: "cancelled" }, now)).toBe("unavailable");
  });
});

describe("canManageEvent", () => {
  const event = { organizer_id: "org-1" };

  it("allows the event's organizer and admins", () => {
    expect(canManageEvent({ id: "org-1", role: "organizer" }, event)).toBe(true);
    expect(canManageEvent({ id: "someone", role: "admin" }, event)).toBe(true);
  });

  it("refuses other organizers and participants", () => {
    expect(canManageEvent({ id: "org-2", role: "organizer" }, event)).toBe(false);
    expect(canManageEvent({ id: "org-1", role: "participant" }, event)).toBe(false);
  });
});
