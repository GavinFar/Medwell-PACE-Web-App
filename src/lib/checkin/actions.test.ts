import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("./events", () => ({ getEvent: vi.fn(), getEventSecret: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn(async () => true) }));

import { logAudit } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIn } from "./actions";
import { getEvent, getEventSecret } from "./events";
import { createPass } from "./pass";

const EVENT_ID = "6f1c2d3e-4a5b-4c6d-8e7f-001122334455";
const SECRET = "c".repeat(64);
const HOUR = 60 * 60 * 1000;

const event = (startOffsetMs: number, endOffsetMs: number) => ({
  id: EVENT_ID,
  organizer_id: "organizer-1",
  title: "Campus Cleanup",
  location_name: "UTA Green",
  latitude: 32.73,
  longitude: -97.11,
  radius_m: 150,
  starts_at: new Date(Date.now() + startOffsetMs).toISOString(),
  ends_at: new Date(Date.now() + endOffsetMs).toISOString(),
  points: 10,
  status: "published",
});

const rpc = vi.fn();

function rpcReturns(row: Record<string, unknown>) {
  rpc.mockResolvedValue({ data: [row], error: null });
}

const NEW_ROW = {
  check_in_id: "11111111-2222-4333-8444-555555555555",
  already_checked_in: false,
  checked_in_at: "2026-11-21T15:04:00Z",
  points_awarded: 10,
  total_points: 40,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1", email: "pat@example.com", role: "participant" });
  vi.mocked(getEventSecret).mockResolvedValue(SECRET);
  vi.mocked(getEvent).mockResolvedValue(event(-HOUR, HOUR));
  vi.mocked(createAdminClient).mockReturnValue({ rpc } as never);
  rpcReturns(NEW_ROW);
});

const goodPass = () => createPass(EVENT_ID, SECRET, Date.now());

describe("checkIn", () => {
  it("asks signed-out visitors to log in, without touching the database", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect(await checkIn(goodPass(), null)).toEqual({ kind: "signed_out" });
    expect(rpc).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it("refuses an expired pass", async () => {
    const old = createPass(EVENT_ID, SECRET, Date.now() - 31 * 60 * 1000);
    expect(await checkIn(old, null)).toEqual({ kind: "expired" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a tampered or malformed pass", async () => {
    expect(await checkIn(createPass(EVENT_ID, "d".repeat(64), Date.now()), null)).toEqual({ kind: "expired" });
    expect(await checkIn("not-a-pass", null)).toEqual({ kind: "expired" });
    expect(await checkIn(42 as unknown as string, null)).toEqual({ kind: "expired" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("says check-in isn't open once the event has ended, without calling the database", async () => {
    vi.mocked(getEvent).mockResolvedValue(event(-3 * HOUR, -HOUR));
    const result = await checkIn(goodPass(), null);
    expect(result).toMatchObject({ kind: "not_open", eventTitle: "Campus Cleanup", reason: "ended" });
    expect(result.kind === "not_open" && result.when).toMatch(/ from .* to /);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("says check-in hasn't opened yet before the start", async () => {
    vi.mocked(getEvent).mockResolvedValue(event(HOUR, 2 * HOUR));
    expect(await checkIn(goodPass(), null)).toMatchObject({ kind: "not_open", reason: "not_started" });
  });

  it("checks in with the distance and flags a location outside the radius", async () => {
    // 0.0018 degrees of latitude north of the event: about 200 m.
    const result = await checkIn(goodPass(), { latitude: 32.7318, longitude: -97.11, accuracy: 12.345 });
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("record_qr_check_in");
    expect(args).toMatchObject({
      p_user_id: "user-1",
      p_event_id: EVENT_ID,
      p_flag_reason: "outside_radius",
      p_accuracy_m: 12.3,
    });
    expect(args.p_distance_m).toBeCloseTo(200.2, 0);
    expect(Math.round(args.p_distance_m * 10)).toBe(args.p_distance_m * 10);
    expect(result).toEqual({
      kind: "checked_in",
      eventTitle: "Campus Cleanup",
      checkedInAt: NEW_ROW.checked_in_at,
      points: 10,
      total: 40,
    });
  });

  it("never passes the coordinates to the database or the audit log", async () => {
    await checkIn(goodPass(), { latitude: 32.7318123, longitude: -97.1104567, accuracy: 8 });
    const everything = JSON.stringify([
      rpc.mock.calls,
      vi.mocked(logAudit).mock.calls,
      vi.mocked(getEvent).mock.calls,
      vi.mocked(getEventSecret).mock.calls,
    ]);
    expect(everything).not.toContain("32.7318");
    expect(everything).not.toContain("97.1104");
    expect(vi.mocked(logAudit)).toHaveBeenCalledWith(
      expect.objectContaining({ action: "checkin.attempt", targetType: "event", targetId: EVENT_ID }),
    );
  });

  it("checks in without a location and flags it", async () => {
    await checkIn(goodPass(), null);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_distance_m: null, p_accuracy_m: null, p_flag_reason: "no_location" });
  });

  it("treats an impossible location as no location", async () => {
    await checkIn(goodPass(), { latitude: 123, longitude: Number.NaN, accuracy: -1 });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_distance_m: null, p_flag_reason: "no_location" });
  });

  it("caps huge distances so the database column can't overflow", async () => {
    await checkIn(goodPass(), { latitude: -32.73, longitude: 82.89, accuracy: 50_000_000 });
    const args = rpc.mock.calls[0][1];
    expect(args.p_distance_m).toBeLessThanOrEqual(9_999_999.9);
    expect(args.p_accuracy_m).toBeLessThanOrEqual(9_999_999.9);
  });

  it("reports an existing check-in as already checked in", async () => {
    rpcReturns({ ...NEW_ROW, already_checked_in: true });
    expect(await checkIn(goodPass(), null)).toEqual({
      kind: "already",
      eventTitle: "Campus Cleanup",
      checkedInAt: NEW_ROW.checked_in_at,
      points: 10,
    });
  });

  it("says check-in isn't open when the database finds the event closed", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PC001", message: "event_not_open" } });
    expect(await checkIn(goodPass(), null)).toMatchObject({ kind: "not_open", eventTitle: "Campus Cleanup", reason: "ended" });
  });
});
