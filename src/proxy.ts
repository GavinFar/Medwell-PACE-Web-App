import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 renamed "middleware" to "proxy". Runs before every matched request.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static files and images so they load without an auth round-trip.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
