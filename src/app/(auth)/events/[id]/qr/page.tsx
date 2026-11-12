import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { formatTodayOrWhen } from "@/lib/checkin/display";
import { getEvent } from "@/lib/checkin/events";
import { getQrStatus } from "@/lib/checkin/qr-status";
import { canManageEvent } from "@/lib/checkin/rules";
import { AuthPage } from "../../../page-chrome";
import { OrganizerQr } from "./organizer-qr";

export const metadata: Metadata = { title: "Check-in QR code – Medwell PACE" };

// The organizer's screen at the event (a laptop or tablet left on a table), from the
// check-in mockups approved on 2026-11-11. Only the event's organizer or an admin may open it.
export default function OrganizerQrPage({ params }: PageProps<"/events/[id]/qr">) {
  return (
    <AuthPage back="organizer">
      <Suspense fallback={<div className="org-grid" style={{ minHeight: 560 }} />}>
        <OrganizerQrGate params={params} />
      </Suspense>
    </AuthPage>
  );
}

async function OrganizerQrGate({ params }: Pick<PageProps<"/events/[id]/qr">, "params">) {
  const { id } = await params;
  const user = await requireUser(`/events/${id}/qr`);
  const event = await getEvent(id);
  // A missing event gets the same answer as someone else's, so ids can't be probed.
  if (!event || !canManageEvent(user, event)) redirect("/account?denied=1");

  const initial = await firstStatus(event);
  return <OrganizerQr eventId={event.id} title={event.title} meta={initial.meta} points={event.points} initial={initial.status} />;
}

// Not a component: reads the clock and the request's address for the first paint.
async function firstStatus(event: NonNullable<Awaited<ReturnType<typeof getEvent>>>) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const now = Date.now();
  const meta = [formatTodayOrWhen(event.starts_at, event.ends_at, now), event.location_name].filter(Boolean).join(" · ");
  return { meta, status: await getQrStatus(event, `${proto}://${host}`, now) };
}
