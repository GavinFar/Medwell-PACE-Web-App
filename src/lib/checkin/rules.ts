import type { Role } from "@/lib/auth/roles";

// Check-in rules that don't need the database: distance, review flags, whether an
// event is open, and who may run an event's QR screen.

// Why a check-in is marked for review. Points are still awarded; an admin can
// reverse them later. If more than one applies, the first in this list wins.
export type FlagReason = "no_location" | "outside_radius" | "low_accuracy";

// GPS accuracy worse than this (in meters) means the distance can't be trusted.
export const LOW_ACCURACY_M = 200;

const EARTH_RADIUS_M = 6_371_000;

// Great-circle distance between two points (haversine formula), in meters.
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function flagReason(
  loc: { distanceM: number; accuracyM: number } | null,
  radiusM: number,
): FlagReason | null {
  if (!loc) return "no_location";
  if (loc.distanceM > radiusM) return "outside_radius";
  if (loc.accuracyM > LOW_ACCURACY_M) return "low_accuracy";
  return null;
}

export type EventState = "open" | "not_started" | "ended" | "unavailable";

// Check-in is open from starts_at up to (not including) ends_at, for published events only.
// The database function record_qr_check_in checks the same rule again.
export function eventState(
  e: { status: string; starts_at: string; ends_at: string },
  nowMs: number,
): EventState {
  if (e.status !== "published") return "unavailable";
  if (nowMs < Date.parse(e.starts_at)) return "not_started";
  if (nowMs >= Date.parse(e.ends_at)) return "ended";
  return "open";
}

// The event's own organizer, or any admin.
export function canManageEvent(
  user: { id: string; role: Role },
  e: { organizer_id: string },
): boolean {
  if (user.role === "admin") return true;
  return user.role === "organizer" && user.id === e.organizer_id;
}
