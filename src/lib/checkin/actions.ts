"use server";

import { headers } from "next/headers";
import { logAudit, type AuditOutcome } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatEventRuns } from "./display";
import { getEvent, getEventSecret } from "./events";
import { parsePass, verifyPass } from "./pass";
import { distanceMeters, eventState, flagReason, type FlagReason } from "./rules";

// The volunteer's "check in" button. Everything that matters is decided here on the
// server, never by the browser: whether the pass is valid, whether the event is open,
// the distance and the review flag. The points come from the event, in the database.
//
// The browser sends its coordinates, but they are used only to work out the distance
// and are then dropped: they never reach the database, the audit log or the console.

export type CheckInLocation = { latitude: number; longitude: number; accuracy: number };

export type CheckInResult =
  | { kind: "checked_in"; eventTitle: string; checkedInAt: string; points: number; total: number }
  | { kind: "already"; eventTitle: string; checkedInAt: string; points: number }
  | { kind: "expired" }
  // `when`: "Sat, Nov 21 from 9:00 AM to 12:00 PM". `reason` picks the screen's last sentence.
  | { kind: "not_open"; eventTitle: string; when: string; reason: "not_started" | "ended" | "unavailable" }
  | { kind: "signed_out" };

type RecordRow = {
  check_in_id: string;
  already_checked_in: boolean;
  checked_in_at: string;
  points_awarded: number;
  total_points: number | string;
};

// check_ins.distance_m and accuracy_m are numeric(8, 1), so 9,999,999.9 m is the most
// they can hold. Someone checking in from another continent shouldn't crash the insert.
const MAX_METERS = 9_999_999.9;
const round1 = (m: number) => Math.min(MAX_METERS, Math.round(m * 10) / 10);

// Anything that isn't a real reading counts as "no location".
function validLocation(loc: unknown): CheckInLocation | null {
  if (typeof loc !== "object" || loc === null) return null;
  const { latitude, longitude, accuracy } = loc as Record<string, unknown>;
  if (typeof latitude !== "number" || typeof longitude !== "number" || typeof accuracy !== "number") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy < 0) return null;
  return { latitude, longitude, accuracy };
}

export async function checkIn(pass: string, location: CheckInLocation | null): Promise<CheckInResult> {
  const user = await getCurrentUser();
  if (!user) return { kind: "signed_out" };

  const requestHeaders = await headers();
  const audit = (
    outcome: AuditOutcome,
    reasonCode: string | undefined,
    targetId: string | undefined,
    metadata: { distance_m: number | null; flag_reason: FlagReason | null },
  ) =>
    logAudit({
      action: "checkin.attempt",
      outcome,
      reasonCode,
      actorId: user.id,
      actorRole: user.role,
      targetType: "event",
      targetId,
      metadata,
      headers: requestHeaders,
    });

  const parsed = parsePass(pass);
  const [event, secret] = parsed
    ? await Promise.all([getEvent(parsed.eventId), getEventSecret(parsed.eventId)])
    : [null, null];
  if (!parsed || !event || !secret || !verifyPass(parsed, secret, Date.now())) {
    await audit("failure", "PASS_INVALID", parsed?.eventId, { distance_m: null, flag_reason: null });
    return { kind: "expired" };
  }

  const notOpen = (): CheckInResult => {
    const state = eventState(event, Date.now());
    return {
      kind: "not_open",
      eventTitle: event.title,
      when: formatEventRuns(event.starts_at, event.ends_at),
      // The database said no but our clock says open: it has just ended.
      reason: state === "open" ? "ended" : state,
    };
  };
  if (eventState(event, Date.now()) !== "open") {
    await audit("failure", "EVENT_NOT_OPEN", event.id, { distance_m: null, flag_reason: null });
    return notOpen();
  }

  // Work out the distance, then forget the coordinates.
  const loc = validLocation(location);
  const reading = loc
    ? {
        distanceM: round1(distanceMeters({ lat: loc.latitude, lng: loc.longitude }, { lat: event.latitude, lng: event.longitude })),
        accuracyM: round1(loc.accuracy),
      }
    : null;
  const flag = flagReason(reading, event.radius_m);
  const metadata = { distance_m: reading?.distanceM ?? null, flag_reason: flag };

  const { data, error } = await createAdminClient().rpc("record_qr_check_in", {
    p_user_id: user.id,
    p_event_id: event.id,
    p_distance_m: reading?.distanceM ?? null,
    p_accuracy_m: reading?.accuracyM ?? null,
    p_flag_reason: flag,
  });

  if (error) {
    if (error.code === "PC001") {
      await audit("failure", "EVENT_NOT_OPEN", event.id, metadata);
      return notOpen();
    }
    await audit("failure", "SERVER_ERROR", event.id, metadata);
    console.error(`record_qr_check_in failed: ${error.message}`);
    throw new Error("Check-in failed");
  }

  const row = (Array.isArray(data) ? data[0] : data) as RecordRow | undefined;
  if (!row) {
    await audit("failure", "SERVER_ERROR", event.id, metadata);
    throw new Error("Check-in failed");
  }

  if (row.already_checked_in) {
    await audit("failure", "ALREADY_CHECKED_IN", event.id, metadata);
    return { kind: "already", eventTitle: event.title, checkedInAt: row.checked_in_at, points: row.points_awarded };
  }

  await audit(flag ? "flagged" : "success", flag ? flag.toUpperCase() : undefined, event.id, metadata);
  return {
    kind: "checked_in",
    eventTitle: event.title,
    checkedInAt: row.checked_in_at,
    points: row.points_awarded,
    total: Number(row.total_points),
  };
}
