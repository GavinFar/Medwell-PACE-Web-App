import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { canManageEvent } from "@/lib/checkin/rules";
import { utcToLocal } from "@/lib/events/form-rules";
import { createClient } from "@/lib/supabase/server";
import { ErrorAlert } from "../../../../(auth)/page-chrome";
import { AppPage } from "../../../app-chrome";
import { cancelEvent } from "../../actions";
import { EventForm } from "../../event-form";

export const metadata: Metadata = { title: "Edit event · PACE Platform" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditEventPage({ params, searchParams }: Props) {
  return (
    <AppPage>
      <div className="form-page">
        <div className="dash-head">
          <h1>Edit event</h1>
          <p className="lead">Changes apply right away. Points already earned don&apos;t change.</p>
        </div>
        <Suspense fallback={<p className="lead">Loading…</p>}>
          <EditEvent params={params} searchParams={searchParams} />
        </Suspense>
      </div>
    </AppPage>
  );
}

async function EditEvent({ params, searchParams }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) redirect("/account?denied=1");
  const user = await requireRole(["organizer", "admin"], `/events/${id}/edit`);

  // Read with the user's own session (RLS). Published events are visible to everyone,
  // so also check that this person may manage it. Missing and "not yours" look the same.
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, organizer_id, title, description, location_name, latitude, longitude, radius_m, starts_at, ends_at, points, status")
    .eq("id", id)
    .maybeSingle();
  if (!event || !canManageEvent(user, { organizer_id: event.organizer_id as string })) redirect("/account?denied=1");

  const { error } = await searchParams;

  if (event.status === "cancelled") {
    return (
      <div className="panel">
        <p className="empty">This event was cancelled, so it can&apos;t be edited.</p>
      </div>
    );
  }

  return (
    <>
      {error === "cancel" && <ErrorAlert>We couldn&apos;t cancel the event. Please try again.</ErrorAlert>}
      <div className="panel">
        <EventForm
          eventId={event.id as string}
          initial={{
            title: event.title as string,
            description: (event.description as string | null) ?? "",
            locationName: (event.location_name as string | null) ?? "",
            latitude: String(event.latitude),
            longitude: String(event.longitude),
            radiusM: String(event.radius_m),
            startsAt: utcToLocal(event.starts_at as string),
            endsAt: utcToLocal(event.ends_at as string),
            points: String(event.points),
            status: event.status === "published" ? "published" : "draft",
          }}
        />
      </div>

      <section className="panel danger-zone" aria-labelledby="cancel-heading">
        <h2 id="cancel-heading">Cancel this event</h2>
        <p>
          Volunteers won&apos;t be able to register or check in. Check-ins and points already earned are kept.
          This can&apos;t be undone.
        </p>
        <form action={cancelEvent}>
          <input type="hidden" name="eventId" value={event.id as string} />
          <button type="submit" className="btn btn-secondary">
            Cancel event
          </button>
        </form>
      </section>
    </>
  );
}