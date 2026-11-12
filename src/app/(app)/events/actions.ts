"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit/log";
import { requireRole } from "@/lib/auth/session";
import { getEvent } from "@/lib/checkin/events";
import { canManageEvent } from "@/lib/checkin/rules";
import { checkEventForm, readEventForm, type EventFormErrors, type EventFormValues } from "@/lib/events/form-rules";
import { createClient } from "@/lib/supabase/server";

// Create, edit and cancel events. Writes use the signed-in user's own session, so the
// database's access rules (events_insert_organizer, events_update_own, events_update_admin)
// are enforced again on top of the checks here: organizers can only create events in
// their own name and only change their own events; admins can change any event.

export type EventFormState = {
  error: string | null;
  fieldErrors: EventFormErrors;
  values: EventFormValues | null; // what was typed, so the form keeps it after an error
  attempt: number; // changes on every failed submit, so the form re-fills itself
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveEvent(prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const eventId = String(formData.get("eventId") ?? "");
  const isNew = eventId === "";
  if (!isNew && !UUID.test(eventId)) redirect("/account?denied=1");
  const user = await requireRole(["organizer", "admin"], isNew ? "/events/new" : `/events/${eventId}/edit`);

  const values = readEventForm(formData);
  const fail = (error: string | null, fieldErrors: EventFormErrors = {}): EventFormState => ({
    error,
    fieldErrors,
    values,
    attempt: prev.attempt + 1,
  });

  const checked = checkEventForm(values, { isNew, nowMs: Date.now() });
  if (checked.errors) return fail(null, checked.errors);

  const supabase = await createClient();
  const requestHeaders = await headers();
  const audit = { actorId: user.id, actorRole: user.role, targetType: "event", headers: requestHeaders };

  if (isNew) {
    const { data, error } = await supabase
      .from("events")
      .insert({ ...checked.record, organizer_id: user.id })
      .select("id")
      .single();
    if (error || !data) {
      await logAudit({ ...audit, action: "event.create", outcome: "failure", reasonCode: error?.code ?? "UNKNOWN" });
      return fail("We couldn't create the event. Please check the details and try again.");
    }
    await logAudit({ ...audit, action: "event.create", outcome: "success", targetId: data.id as string });
    redirect("/account?event=created");
  }

  // Same answer for "no such event" and "not yours", so event ids can't be probed.
  const existing = await getEvent(eventId);
  if (!existing || !canManageEvent(user, existing)) {
    await logAudit({ ...audit, action: "event.update", outcome: "failure", targetId: eventId, reasonCode: "NOT_ALLOWED" });
    redirect("/account?denied=1");
  }
  if (existing.status === "cancelled") return fail("This event was cancelled, so it can't be edited.");

  const { data, error } = await supabase.from("events").update(checked.record).eq("id", eventId).select("id");
  if (error || !data || data.length === 0) {
    await logAudit({ ...audit, action: "event.update", outcome: "failure", targetId: eventId, reasonCode: error?.code ?? "NO_ROWS" });
    return fail("We couldn't save your changes. Please try again.");
  }
  await logAudit({ ...audit, action: "event.update", outcome: "success", targetId: eventId });
  redirect("/account?event=updated");
}

// Organizers can't delete events (only admins can, in the database); cancelling keeps
// the event and its check-in history, and stops new check-ins and registrations.
export async function cancelEvent(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  if (!UUID.test(eventId)) redirect("/account?denied=1");
  const user = await requireRole(["organizer", "admin"], `/events/${eventId}/edit`);

  const existing = await getEvent(eventId);
  if (!existing || !canManageEvent(user, existing)) redirect("/account?denied=1");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ status: "cancelled" })
    .eq("id", eventId)
    .select("id");
  const audit = {
    action: "event.cancel",
    actorId: user.id,
    actorRole: user.role,
    targetType: "event",
    targetId: eventId,
    headers: await headers(),
  };
  if (error || !data || data.length === 0) {
    await logAudit({ ...audit, outcome: "failure", reasonCode: error?.code ?? "NO_ROWS" });
    redirect(`/events/${eventId}/edit?error=cancel`);
  }
  await logAudit({ ...audit, outcome: "success" });
  redirect("/account?event=cancelled");
}