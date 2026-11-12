"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { checkIn, type CheckInLocation, type CheckInResult } from "@/lib/checkin/actions";
import { ErrorAlert, Icon } from "../page-chrome";
import { AlreadyCheckedIn, CheckedIn, checkInIcons, CodeExpired, EventBox, NotOpen } from "./screens";

// B: "One last step". Explains why we ask for the location first; the phone's own
// "Allow" popup only appears after the volunteer taps the button. "Check in without
// location" is always there. The server (the checkIn action) decides everything:
// whether the pass is still good, the distance, the flag and the points.

type Busy = "locating" | "sending" | null;

export function CheckInFlow({
  pass,
  event,
}: {
  pass: string;
  event: { title: string; location_name: string | null };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [locationError, setLocationError] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);

  // Their session ran out while on this screen: reload, which shows "Almost there".
  useEffect(() => {
    if (result?.kind === "signed_out") router.refresh();
  }, [result, router]);

  async function send(location: CheckInLocation | null) {
    setBusy("sending");
    setServerError(false);
    try {
      setResult(await checkIn(pass, location));
    } catch {
      setServerError(true);
      setBusy(null);
    }
  }

  function shareLocation() {
    setLocationError(false);
    if (!("geolocation" in navigator)) {
      setLocationError(true);
      return;
    }
    setBusy("locating");
    navigator.geolocation.getCurrentPosition(
      // Sent to the server only to work out the distance; it never stores them.
      (pos) => send({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => {
        setBusy(null);
        setLocationError(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  switch (result?.kind) {
    case "checked_in":
      return (
        <CheckedIn
          title={result.eventTitle}
          locationName={event.location_name}
          checkedInAt={result.checkedInAt}
          points={result.points}
        />
      );
    case "already":
      return <AlreadyCheckedIn title={result.eventTitle} checkedInAt={result.checkedInAt} points={result.points} />;
    case "not_open":
      return <NotOpen title={result.eventTitle} when={result.when} reason={result.reason} />;
    case "expired":
      return <CodeExpired />;
  }

  return (
    <div className="card auth-card">
      <div className="auth-head">
        <div className="auth-icon">
          <Icon large>{checkInIcons.pin}</Icon>
        </div>
        <h1>One last step</h1>
        <p className="lead">Share your location so we can confirm you&apos;re at the event.</p>
      </div>
      {locationError && <ErrorAlert>We couldn&apos;t get your location.</ErrorAlert>}
      {serverError && <ErrorAlert>Something went wrong. Please try again.</ErrorAlert>}
      <EventBox title={event.title}>We only keep how far you were from the event, never where you are.</EventBox>
      <button className="btn btn-primary btn-block" type="button" disabled={busy !== null} onClick={shareLocation}>
        {busy === "locating"
          ? "Getting your location…"
          : busy === "sending"
            ? "Checking in…"
            : "Share location and check in"}
      </button>
      <p className="center" style={{ margin: ".5rem 0 0" }}>
        <button className="btn-link" type="button" disabled={busy !== null} onClick={() => send(null)}>
          Check in without location
        </button>
      </p>
    </div>
  );
}
