import { EVENT_TIME_ZONE } from "@/lib/checkin/display";

// Checks the create/edit event form. The limits match the events table's constraints
// (supabase/migrations/..._core_schema.sql), so the database never has to reject a value
// the form accepted. Times are entered in Texas time, like they're shown everywhere else.

export type EventStatus = "draft" | "published";

export type EventFormValues = {
  title: string;
  description: string;
  locationName: string;
  latitude: string;
  longitude: string;
  radiusM: string;
  startsAt: string; // "YYYY-MM-DDTHH:mm" in Texas time (a datetime-local input)
  endsAt: string;
  points: string;
  status: EventStatus;
};

export type EventFormField = keyof EventFormValues;
export type EventFormErrors = Partial<Record<EventFormField, string>>;

// What gets saved: the columns of public.events.
export type EventRecord = {
  title: string;
  description: string | null;
  location_name: string | null;
  latitude: number;
  longitude: number;
  radius_m: number;
  starts_at: string; // ISO, UTC
  ends_at: string;
  points: number;
  status: EventStatus;
};

export const EVENT_DEFAULTS = { radiusM: "100", points: "10" } as const;

export function readEventForm(formData: FormData): EventFormValues {
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  return {
    title: text("title"),
    description: text("description"),
    locationName: text("locationName"),
    latitude: text("latitude"),
    longitude: text("longitude"),
    radiusM: text("radiusM"),
    startsAt: text("startsAt"),
    endsAt: text("endsAt"),
    points: text("points"),
    status: formData.get("status") === "published" ? "published" : "draft",
  };
}

const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

// "2026-11-18T09:00" in Texas time -> "2026-11-18T15:00:00.000Z". Returns null if invalid.
export function localToUtc(local: string, timeZone: string = EVENT_TIME_ZONE): string | null {
  const m = LOCAL_DATETIME.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const asIfUtc = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(asIfUtc)) return null;
  // Guess with the zone's offset at that moment, then correct once (handles daylight saving).
  let utc = asIfUtc - zoneOffsetMs(asIfUtc, timeZone);
  utc = asIfUtc - zoneOffsetMs(utc, timeZone);
  const result = new Date(utc);
  // Reject dates that don't exist, like Feb 30.
  if (utcToLocal(result.toISOString(), timeZone).slice(0, 10) !== local.slice(0, 10)) return null;
  return result.toISOString();
}

// "2026-11-18T15:00:00Z" -> "2026-11-18T09:00" in Texas time (for the edit form).
export function utcToLocal(iso: string, timeZone: string = EVENT_TIME_ZONE): string {
  const p = zoneParts(Date.parse(iso), timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

function zoneParts(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((x) => x.type === type)?.value ?? "00";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

// How far the zone's clock is ahead of UTC at a moment, in ms (Texas: -5h or -6h).
function zoneOffsetMs(ms: number, timeZone: string): number {
  const p = zoneParts(ms, timeZone);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

function wholeNumber(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

function decimal(value: string, min: number, max: number): number | null {
  if (!/^-?\d+(\.\d+)?$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

// Returns either the row to save, or a message for each field that's wrong.
// `nowMs` is only used for new events: they can't start in the past.
export function checkEventForm(
  v: EventFormValues,
  { isNew, nowMs }: { isNew: boolean; nowMs: number },
): { record: EventRecord; errors: null } | { record: null; errors: EventFormErrors } {
  const errors: EventFormErrors = {};

  if (v.title.length < 1) errors.title = "Enter a title.";
  else if (v.title.length > 120) errors.title = "Use 120 characters or fewer.";
  if (v.description.length > 5000) errors.description = "Use 5,000 characters or fewer.";
  if (v.locationName.length > 200) errors.locationName = "Use 200 characters or fewer.";

  const latitude = decimal(v.latitude, -90, 90);
  if (latitude === null) errors.latitude = "Enter a latitude between -90 and 90, or use your current location.";
  const longitude = decimal(v.longitude, -180, 180);
  if (longitude === null) errors.longitude = "Enter a longitude between -180 and 180.";

  const radius = wholeNumber(v.radiusM, 10, 1000);
  if (radius === null) errors.radiusM = "Enter a whole number of meters from 10 to 1,000.";
  const points = wholeNumber(v.points, 0, 1000);
  if (points === null) errors.points = "Enter a whole number of points from 0 to 1,000.";

  const startsAt = localToUtc(v.startsAt);
  const endsAt = localToUtc(v.endsAt);
  if (!startsAt) errors.startsAt = "Enter a start date and time.";
  else if (isNew && Date.parse(startsAt) < nowMs - 5 * 60_000) errors.startsAt = "The start time is in the past.";
  if (!endsAt) errors.endsAt = "Enter an end date and time.";
  else if (startsAt && Date.parse(endsAt) <= Date.parse(startsAt)) errors.endsAt = "The end time must be after the start time.";

  if (Object.keys(errors).length > 0) return { record: null, errors };
  return {
    record: {
      title: v.title,
      description: v.description || null,
      location_name: v.locationName || null,
      latitude: latitude!,
      longitude: longitude!,
      radius_m: radius!,
      starts_at: startsAt!,
      ends_at: endsAt!,
      points: points!,
      status: v.status,
    },
    errors: null,
  };
}