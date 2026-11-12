"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "Register" button on the dashboard. The database's access rule
// (registrations_insert_self) only allows volunteers to register themselves
// for published events that haven't ended, so this can't be used to register
// someone else or join a past or draft event.
export async function registerForEvent(formData: FormData) {
  const user = await requireRole(["participant"], "/dashboard");
  const eventId = String(formData.get("eventId") ?? "");
  if (!UUID.test(eventId)) redirect("/dashboard?error=register");

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_registrations")
    .insert({ event_id: eventId, user_id: user.id });

  // 23505 = already registered, which is fine.
  if (error && error.code !== "23505") {
    console.error("Event registration failed:", error.code ?? "UNKNOWN");
    redirect("/dashboard?error=register");
  }
  redirect("/dashboard?registered=1");
}

// "Cancel" next to a registered event. The access rule (registrations_delete_self)
// only lets volunteers delete their own registrations.
export async function cancelRegistration(formData: FormData) {
  const user = await requireRole(["participant"], "/dashboard");
  const eventId = String(formData.get("eventId") ?? "");
  if (!UUID.test(eventId)) redirect("/dashboard?error=cancel");

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_registrations")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Cancelling registration failed:", error.code ?? "UNKNOWN");
    redirect("/dashboard?error=cancel");
  }
  redirect("/dashboard?cancelled=1");
}