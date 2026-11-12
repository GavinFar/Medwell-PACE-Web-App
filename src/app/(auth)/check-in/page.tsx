import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { logAudit } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/session";
import { formatEventRuns, formatEventWhen } from "@/lib/checkin/display";
import { getEvent, getEventSecret, hasCheckedIn, type CheckInEvent } from "@/lib/checkin/events";
import { createPass, parsePass, verifyPass } from "@/lib/checkin/pass";
import { eventState } from "@/lib/checkin/rules";
import { verifyCode } from "@/lib/qr/rotating-code";
import { AuthPage } from "../page-chrome";
import { CheckInFlow } from "./check-in-flow";
import { AlmostThere, AlreadyCheckedIn, CodeExpired, NotOpen } from "./screens";

export const metadata: Metadata = { title: "Check in – Medwell PACE" };

// Where a volunteer's phone lands after scanning the organizer's QR code.
//
//   /check-in?e=<event id>&c=<code>   straight from the QR code. The code changes every
//                                     30 seconds, so it's swapped right away for a pass
//                                     that lasts 30 minutes (see src/lib/checkin/pass.ts).
//   /check-in?pass=<pass>             the pass. It survives logging in or signing up, so
//                                     nobody has to scan again.
export default function CheckInPage({ searchParams }: PageProps<"/check-in">) {
  return (
    <AuthPage back="home">
      <Suspense fallback={<div className="card auth-card" style={{ minHeight: 420 }} />}>
        <CheckInGate searchParams={searchParams} />
      </Suspense>
    </AuthPage>
  );
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

// What to show. The checks below are plain functions (not components) because they
// read the clock, which is fine on the server once per request.
type Screen =
  | { kind: "expired" }
  | { kind: "not_open"; title: string; when: string; reason: "not_started" | "ended" | "unavailable" }
  | { kind: "pass"; pass: string }
  | { kind: "almost_there"; title: string; when: string; here: string }
  | { kind: "already"; title: string; checkedInAt: string; points: number }
  | { kind: "location"; pass: string; title: string; locationName: string | null };

async function CheckInGate({ searchParams }: Pick<PageProps<"/check-in">, "searchParams">) {
  const params = await searchParams;
  const eventId = one(params.e);
  const code = one(params.c);
  const pass = one(params.pass);

  const screen: Screen =
    eventId && code ? await checkScan(eventId, code) : pass ? await checkPass(pass) : { kind: "expired" };

  switch (screen.kind) {
    case "pass":
      redirect(`/check-in?pass=${screen.pass}`);
    case "expired":
      return <CodeExpired />;
    case "not_open":
      return <NotOpen title={screen.title} when={screen.when} reason={screen.reason} />;
    case "almost_there":
      return (
        <AlmostThere
          title={screen.title}
          when={screen.when}
          loginHref={`/login?next=${encodeURIComponent(screen.here)}`}
          signupHref={`/signup?next=${encodeURIComponent(screen.here)}`}
        />
      );
    case "already":
      return <AlreadyCheckedIn title={screen.title} checkedInAt={screen.checkedInAt} points={screen.points} />;
    case "location":
      return <CheckInFlow pass={screen.pass} event={{ title: screen.title, location_name: screen.locationName }} />;
  }
}

function notOpen(event: CheckInEvent): Screen | null {
  const state = eventState(event, Date.now());
  if (state === "open") return null;
  return { kind: "not_open", title: event.title, when: formatEventRuns(event.starts_at, event.ends_at), reason: state };
}

// A fresh scan: check the QR code, then hand out a pass.
async function checkScan(eventId: string, code: string): Promise<Screen> {
  const [event, secret] = await Promise.all([getEvent(eventId), getEventSecret(eventId)]);

  if (!event || !secret || code.length > 64 || !verifyCode(secret, code, Date.now())) {
    const user = await getCurrentUser();
    await logAudit({
      action: "checkin.attempt",
      outcome: "failure",
      reasonCode: "CODE_INVALID",
      actorId: user?.id ?? null,
      actorRole: user?.role ?? null,
      targetType: "event",
      targetId: event?.id,
      headers: await headers(),
    });
    return { kind: "expired" };
  }

  return notOpen(event) ?? { kind: "pass", pass: createPass(event.id, secret, Date.now()) };
}

// Has a pass: log in if needed, then the location screen.
async function checkPass(pass: string): Promise<Screen> {
  const parsed = parsePass(pass);
  if (!parsed) return { kind: "expired" };
  const [event, secret] = await Promise.all([getEvent(parsed.eventId), getEventSecret(parsed.eventId)]);
  if (!event || !secret || !verifyPass(parsed, secret, Date.now())) return { kind: "expired" };

  const user = await getCurrentUser();
  if (!user) {
    return {
      kind: "almost_there",
      title: event.title,
      when: formatEventWhen(event.starts_at, event.ends_at),
      here: `/check-in?pass=${pass}`,
    };
  }

  const existing = await hasCheckedIn(user.id, event.id);
  if (existing) {
    return { kind: "already", title: event.title, checkedInAt: existing.checked_in_at, points: existing.points_awarded };
  }

  // The event may have ended while they were logging in or signing up.
  return notOpen(event) ?? { kind: "location", pass, title: event.title, locationName: event.location_name };
}
