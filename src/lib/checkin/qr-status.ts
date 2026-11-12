import "server-only";
import { currentCode } from "@/lib/qr/rotating-code";
import { formatTime, shortName } from "./display";
import { checkInSummary, getEventSecret, type CheckInEvent } from "./events";
import { eventState, type EventState } from "./rules";

// What the organizer's QR screen shows right now. Used by GET /api/events/[id]/qr (polled
// every 5 seconds) and by the page itself for the first paint.
// Callers must check canManageEvent first: this reads with the service-role key.

export type QrStatus = {
  state: EventState;
  url: string | null; // the check-in URL in the QR code; only while the event is open
  secondsRemaining: number | null; // until the code changes
  count: number;
  recent: { name: string; time: string }[]; // "Pat V.", "9:04 AM"
  opensAt: string; // "9:00 AM"
  closesAt: string;
};

export async function getQrStatus(event: CheckInEvent, origin: string, nowMs: number): Promise<QrStatus> {
  const state = eventState(event, nowMs);
  const [secret, summary] = await Promise.all([
    state === "open" ? getEventSecret(event.id) : Promise.resolve(null),
    checkInSummary(event.id),
  ]);

  let url: string | null = null;
  let secondsRemaining: number | null = null;
  if (secret) {
    const current = currentCode(secret, nowMs);
    const link = new URL("/check-in", origin);
    link.searchParams.set("e", event.id);
    link.searchParams.set("c", current.code);
    url = link.toString();
    secondsRemaining = current.secondsRemaining;
  }

  return {
    state,
    url,
    secondsRemaining,
    count: summary.count,
    recent: summary.recent.map((r) => ({ name: shortName(r.name), time: formatTime(r.at) })),
    opensAt: formatTime(event.starts_at),
    closesAt: formatTime(event.ends_at),
  };
}
