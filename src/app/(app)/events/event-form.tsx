"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { ErrorAlert, FieldError } from "../../(auth)/page-chrome";
import type { EventFormField, EventFormValues } from "@/lib/events/form-rules";
import { saveEvent, type EventFormState } from "./actions";

// The create/edit event form. Times are in Texas time, like everywhere else on the site.
export function EventForm({ eventId, initial }: { eventId?: string; initial: EventFormValues }) {
  const [state, formAction, pending] = useActionState<EventFormState, FormData>(saveEvent, {
    error: null,
    fieldErrors: {},
    values: null,
    attempt: 0,
  });
  const v = state.values ?? initial;
  const errors = state.fieldErrors;

  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);
  const [locating, setLocating] = useState(false);
  const [locationMsg, setLocationMsg] = useState<string | null>(null);

  function fillMyLocation() {
    if (!navigator.geolocation) {
      setLocationMsg("Your browser can't share its location. Enter the coordinates instead.");
      return;
    }
    setLocating(true);
    setLocationMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (latRef.current) latRef.current.value = pos.coords.latitude.toFixed(6);
        if (lngRef.current) lngRef.current.value = pos.coords.longitude.toFixed(6);
        setLocating(false);
        setLocationMsg(`Location filled in (accurate to about ${Math.round(pos.coords.accuracy)} m).`);
      },
      () => {
        setLocating(false);
        setLocationMsg("We couldn't get your location. Enter the coordinates instead.");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const err = (name: EventFormField) =>
    errors[name] ? { "aria-invalid": true as const, "aria-describedby": `${name}-error` } : {};

  return (
    // key: re-mount after a failed submit so the fields show what was typed.
    <form key={state.attempt} action={formAction} noValidate className="event-form">
      {state.error && <ErrorAlert>{state.error}</ErrorAlert>}
      {eventId && <input type="hidden" name="eventId" value={eventId} />}

      <fieldset>
        <legend>Event details</legend>
        <div className="field">
          <label htmlFor="title">Title</label>
          <input id="title" name="title" className="input" maxLength={120} defaultValue={v.title} required {...err("title")} />
          <FieldError id="title-error" message={errors.title} />
        </div>
        <div className="field">
          <label htmlFor="description">
            Description <span className="optional">(optional)</span>
          </label>
          <textarea id="description" name="description" className="input textarea" rows={4} maxLength={5000} defaultValue={v.description} {...err("description")} />
          <FieldError id="description-error" message={errors.description} />
        </div>
      </fieldset>

      <fieldset>
        <legend>When (Texas time)</legend>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="startsAt">Starts</label>
            <input id="startsAt" name="startsAt" type="datetime-local" className="input" defaultValue={v.startsAt} required {...err("startsAt")} />
            <FieldError id="startsAt-error" message={errors.startsAt} />
          </div>
          <div className="field">
            <label htmlFor="endsAt">Ends</label>
            <input id="endsAt" name="endsAt" type="datetime-local" className="input" defaultValue={v.endsAt} required {...err("endsAt")} />
            <FieldError id="endsAt-error" message={errors.endsAt} />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Where</legend>
        <div className="field">
          <label htmlFor="locationName">
            Place name <span className="optional">(optional)</span>
          </label>
          <span className="hint">Shown to volunteers, for example &ldquo;UTA Health Center&rdquo;.</span>
          <input id="locationName" name="locationName" className="input" maxLength={200} defaultValue={v.locationName} {...err("locationName")} />
          <FieldError id="locationName-error" message={errors.locationName} />
        </div>
        <p className="hint">
          Check-ins farther than the check-in radius from this point are flagged for review.
        </p>
        <button type="button" className="btn btn-secondary btn-small" onClick={fillMyLocation} disabled={locating}>
          {locating ? "Getting your location…" : "Use my current location"}
        </button>
        <p className="status-msg left" role="status">
          {locationMsg}
        </p>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="latitude">Latitude</label>
            <input id="latitude" name="latitude" ref={latRef} className="input" inputMode="decimal" defaultValue={v.latitude} required {...err("latitude")} />
            <FieldError id="latitude-error" message={errors.latitude} />
          </div>
          <div className="field">
            <label htmlFor="longitude">Longitude</label>
            <input id="longitude" name="longitude" ref={lngRef} className="input" inputMode="decimal" defaultValue={v.longitude} required {...err("longitude")} />
            <FieldError id="longitude-error" message={errors.longitude} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="radiusM">Check-in radius (meters)</label>
          <span className="hint">10 to 1,000. 100 m covers most buildings.</span>
          <input id="radiusM" name="radiusM" type="number" min={10} max={1000} step={1} className="input short" defaultValue={v.radiusM} required {...err("radiusM")} />
          <FieldError id="radiusM-error" message={errors.radiusM} />
        </div>
      </fieldset>

      <fieldset>
        <legend>Points and visibility</legend>
        <div className="field">
          <label htmlFor="points">PACE points for attending</label>
          <input id="points" name="points" type="number" min={0} max={1000} step={1} className="input short" defaultValue={v.points} required {...err("points")} />
          <FieldError id="points-error" message={errors.points} />
        </div>
        <div className="check-group">
          <label className="check">
            <input type="radio" name="status" value="published" defaultChecked={v.status === "published"} />
            <span>
              <strong>Published</strong>: volunteers can see it, register and check in
            </span>
          </label>
          <label className="check">
            <input type="radio" name="status" value="draft" defaultChecked={v.status !== "published"} />
            <span>
              <strong>Draft</strong>: only you (and admins) can see it
            </span>
          </label>
        </div>
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : eventId ? "Save changes" : "Create event"}
        </button>
        <Link className="btn btn-secondary" href="/account">
          Back
        </Link>
      </div>
    </form>
  );
}