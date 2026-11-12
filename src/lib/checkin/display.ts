// How check-in screens show names and times.

// Events have no time zone column yet, so times are shown in Texas time for now.
export const EVENT_TIME_ZONE = "America/Chicago";

// "Pat Volunteer" -> "Pat V.": first name plus last initial, so the organizer screen
// (often on a projector) doesn't show full names.
export function shortName(displayName: string | null): string {
  const words = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "Volunteer";
  const first = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  if (words.length === 1) return first;
  return `${first} ${words[words.length - 1].charAt(0).toUpperCase()}.`;
}

const dayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

// Newer versions of Node put a narrow no-break space before "AM"/"PM"; use a plain space.
const plainSpaces = (s: string) => s.replace(/[  ]/g, " ");

// "9:04 AM"
export function formatTime(iso: string): string {
  return plainSpaces(timeFormat.format(new Date(iso)));
}

// "Sat, Nov 21 · 9:00 AM – 12:00 PM"
export function formatEventWhen(startsAt: string, endsAt: string): string {
  const day = plainSpaces(dayFormat.format(new Date(startsAt)));
  return `${day} · ${formatTime(startsAt)} – ${formatTime(endsAt)}`;
}
