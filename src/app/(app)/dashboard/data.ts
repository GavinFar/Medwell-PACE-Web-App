import "server-only";
import { createClient } from "@/lib/supabase/server";

// Everything the volunteer dashboard shows, read with the volunteer's own session,
// so the database's access rules (RLS) decide what they can see.

export type UpcomingEvent = {
  id: string;
  title: string;
  description: string | null;
  locationName: string | null;
  startsAt: string;
  endsAt: string;
  points: number;
  registered: boolean;
};

export type CheckInRow = {
  id: string;
  eventTitle: string;
  checkedInAt: string;
  status: "accepted" | "flagged" | "rejected_on_review";
  pointsAwarded: number;
  flagged: boolean; // marked for admin review (no location, too far away, or inaccurate)
};

export type DashboardData = {
  firstName: string | null;
  points: number;
  eventsAttended: number;
  registeredCount: number;
  nextEvent: UpcomingEvent | null; // the soonest event they're registered for
  upcoming: UpcomingEvent[];
  checkIns: CheckInRow[];
  loadError: boolean; // true if any part couldn't be loaded
};

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location_name: string | null;
  starts_at: string;
  ends_at: string;
  points: number | null;
};
type EventRowRef = EventRow | EventRow[] | null;
type TitleRef = { title?: string } | { title?: string }[] | null;

const EVENT_COLUMNS = "id, title, description, location_name, starts_at, ends_at, points";

function toEvent(e: EventRow, registered: boolean): UpcomingEvent {
  return {
    id: e.id,
    title: e.title,
    description: e.description ?? null,
    locationName: e.location_name ?? null,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    points: Number(e.points ?? 0),
    registered,
  };
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [profile, balance, attended, events, registrations, checkIns] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.rpc("get_pace_points_balance", { p_user_id: userId }),
    supabase
      .from("check_ins")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "accepted"),
    supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .eq("status", "published")
      .gt("ends_at", now)
      .order("starts_at", { ascending: true })
      .limit(10),
    // Only registrations for events that haven't ended yet, with the event's details.
    supabase
      .from("event_registrations")
      .select(`event_id, events!inner(${EVENT_COLUMNS})`)
      .eq("user_id", userId)
      .gt("events.ends_at", now),
    supabase
      .from("check_ins")
      .select("id, checked_in_at, status, points_awarded, flag_reason, events(title)")
      .eq("user_id", userId)
      .order("checked_in_at", { ascending: false })
      .limit(20),
  ]);

  const failed = [profile, balance, attended, events, registrations, checkIns].filter((r) => r.error);
  // Log only error codes: messages can contain user data.
  for (const r of failed) console.error("Dashboard query failed:", r.error?.code ?? "UNKNOWN");

  const registeredEvents = (registrations.data ?? [])
    .map((r) => {
      const ev = r.events as EventRowRef;
      return Array.isArray(ev) ? ev[0] : ev;
    })
    .filter((e): e is EventRow => Boolean(e))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const registeredIds = new Set(registeredEvents.map((e) => e.id));
  const displayName = (profile.data?.display_name as string | null | undefined)?.trim();

  return {
    firstName: displayName ? displayName.split(/\s+/)[0] : null,
    points: Number(balance.data ?? 0),
    eventsAttended: attended.count ?? 0,
    registeredCount: registeredIds.size,
    nextEvent: registeredEvents[0] ? toEvent(registeredEvents[0], true) : null,
    upcoming: ((events.data ?? []) as EventRow[]).map((e) => toEvent(e, registeredIds.has(e.id))),
    checkIns: (checkIns.data ?? []).map((c) => {
      const ev = c.events as TitleRef;
      const title = (Array.isArray(ev) ? ev[0]?.title : ev?.title) ?? "Event";
      return {
        id: c.id as string,
        eventTitle: title,
        checkedInAt: c.checked_in_at as string,
        status: c.status as CheckInRow["status"],
        pointsAwarded: Number(c.points_awarded ?? 0),
        flagged: c.flag_reason != null,
      };
    }),
    loadError: failed.length > 0,
  };
}
