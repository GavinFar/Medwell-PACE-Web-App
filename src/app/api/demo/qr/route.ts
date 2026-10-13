import { NextResponse, type NextRequest } from "next/server";
import { currentDemoCode, isDemoConfigured } from "@/lib/qr/demo";

// Returns the current check-in URL for the demo QR page.
// Demo only: the real version will require a signed-in organizer and use the event's own secret.
export function GET(request: NextRequest) {
  if (!isDemoConfigured()) {
    return NextResponse.json({ error: "QR_DEMO_SECRET is not set" }, { status: 503 });
  }

  const { code, secondsRemaining } = currentDemoCode();
  const url = new URL("/demo/check-in", request.nextUrl.origin);
  url.searchParams.set("code", code);

  return NextResponse.json(
    { url: url.toString(), secondsRemaining },
    { headers: { "Cache-Control": "no-store" } },
  );
}
