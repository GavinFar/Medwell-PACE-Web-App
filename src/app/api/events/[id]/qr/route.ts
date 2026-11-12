import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getEvent } from "@/lib/checkin/events";
import { getQrStatus } from "@/lib/checkin/qr-status";
import { canManageEvent } from "@/lib/checkin/rules";

// The organizer's QR screen polls this every 5 seconds: the current check-in URL
// (the QR code), seconds until it changes, and the check-in count with the latest names.
// Only the event's organizer or an admin may call it.
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest, ctx: RouteContext<"/api/events/[id]/qr">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401, headers: noStore });

  const event = await getEvent(id);
  // Same answer for "no such event" and "not yours" to non-managers, so ids can't be probed.
  if (!event) {
    const status = user.role === "admin" ? 404 : 403;
    return NextResponse.json({ error: status === 404 ? "No such event" : "Forbidden" }, { status, headers: noStore });
  }
  if (!canManageEvent(user, event)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: noStore });
  }

  const status = await getQrStatus(event, request.nextUrl.origin, Date.now());
  return NextResponse.json(status, { headers: noStore });
}
