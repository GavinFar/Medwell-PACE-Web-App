import "server-only";
import { connection } from "next/server";
import type { CurrentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseEnv } from "@/lib/supabase/env";

// Event lookups for the QR check-in, read with the service-role key.
// The service-role key BYPASSES row-level security, so every caller must do its own
// access check first (canManageEvent for organizer screens, a valid QR code or pass
// for volunteers). Nothing here is ever sent to the browser as-is.
//
// Each function waits for a real request (connection()), so none of this runs during
// the build. Without Supabase settings (PR previews) they act as if nothing exists
// instead of crashing the page.

export type CheckInEvent = {
  id: string;
  organizer_id: string;
  title: string;
  location_name: string | null;
  latitude: number;
  longitude: number;
  radius_m: number;
  starts_at: string;
  ends_at: string;
  points: number;
  status: string;
};

const EVENT_COLUMNS =
  "id, organizer_id, title, location_name, latitude, longitude, radius_m, starts_at, ends_at, points, status";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function admin() {
  await connection();
  if (!getSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createAdminClient();
}

export async function getEvent(eventId: string): Promise<CheckInEvent | null> {
  const db = await admin();
  if (!db || !UUID.test(eventId)) return null;
  const { data, error } = await db.from("events").select(EVENT_COLUMNS).eq("id", eventId).maybeSingle();
  if (error) throw new Error(`Couldn't load event: ${error.message}`);
  return data as CheckInEvent | null;
}

// The event's QR secret. Never send it to the browser or log it.
export async function getEventSecret(eventId: string): Promise<string | null> {
  const db = await admin();
  if (!db || !UUID.test(eventId)) return null;
  const { data, error } = await db
    .from("event_qr_secrets")
    .select("secret")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load event secret: ${error.message}`);
  return (data?.secret as string | undefined) ?? null;
}

// Events that haven't ended yet, soonest first: all of them for admins, their own for
// organizers, none for anyone else.
export async function listManagedEvents(user: CurrentUser): Promise<CheckInEvent[]> {
  if (user.role !== "admin" && user.role !== "organizer") return [];
  const db = await admin();
  if (!db) return [];
  let query = db
    .from("events")
    .select(EVENT_COLUMNS)
    .gt("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  if (user.role === "organizer") query = query.eq("organizer_id", user.id);
  const { data, error } = await query;
  if (error) throw new Error(`Couldn't load events: ${error.message}`);
  return (data ?? []) as CheckInEvent[];
}

// How many people have checked in, and the latest 4 with their display names
// (raw; the caller shortens them with shortName).
export async function checkInSummary(
  eventId: string,
): Promise<{ count: number; recent: { name: string; at: string }[] }> {
  const db = await admin();
  if (!db || !UUID.test(eventId)) return { count: 0, recent: [] };

  const { data, count, error } = await db
    .from("check_ins")
    .select("user_id, checked_in_at", { count: "exact" })
    .eq("event_id", eventId)
    .order("checked_in_at", { ascending: false })
    .limit(4);
  if (error) throw new Error(`Couldn't load check-ins: ${error.message}`);
  const rows = (data ?? []) as { user_id: string; checked_in_at: string }[];

  const names = new Map<string, string>();
  if (rows.length > 0) {
    const { data: profiles, error: profileError } = await db
      .from("profiles")
      .select("id, display_name")
      .in("id", rows.map((r) => r.user_id));
    if (profileError) throw new Error(`Couldn't load names: ${profileError.message}`);
    for (const p of (profiles ?? []) as { id: string; display_name: string | null }[]) {
      names.set(p.id, p.display_name ?? "");
    }
  }

  return {
    count: count ?? rows.length,
    recent: rows.map((r) => ({ name: names.get(r.user_id) ?? "", at: r.checked_in_at })),
  };
}

export async function hasCheckedIn(
  userId: string,
  eventId: string,
): Promise<{ checked_in_at: string; points_awarded: number } | null> {
  const db = await admin();
  if (!db || !UUID.test(eventId)) return null;
  const { data, error } = await db
    .from("check_ins")
    .select("checked_in_at, points_awarded")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load check-in: ${error.message}`);
  return data as { checked_in_at: string; points_awarded: number } | null;
}
