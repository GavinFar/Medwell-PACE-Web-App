import type { Metadata } from "next";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth/session";
import { EVENT_DEFAULTS } from "@/lib/events/form-rules";
import { AppPage } from "../../app-chrome";
import { EventForm } from "../event-form";

export const metadata: Metadata = { title: "New event · PACE Platform" };

export default function NewEventPage() {
  return (
    <AppPage>
      <div className="form-page">
        <div className="dash-head">
          <h1>New event</h1>
          <p className="lead">Volunteers check in at the event with the QR code on your screen.</p>
        </div>
        <Suspense fallback={<p className="lead">Loading…</p>}>
          <NewEventForm />
        </Suspense>
      </div>
    </AppPage>
  );
}

async function NewEventForm() {
  // Organizers and admins only; everyone else is sent to their account page.
  await requireRole(["organizer", "admin"], "/events/new");
  return (
    <div className="panel">
      <EventForm
        initial={{
          title: "",
          description: "",
          locationName: "",
          latitude: "",
          longitude: "",
          radiusM: EVENT_DEFAULTS.radiusM,
          startsAt: "",
          endsAt: "",
          points: EVENT_DEFAULTS.points,
          status: "draft",
        }}
      />
    </div>
  );
}