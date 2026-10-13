import type { Metadata } from "next";
import { Suspense } from "react";
import { isDemoConfigured, verifyDemoCode } from "@/lib/qr/demo";
import { DemoBadge } from "../demo-badge";

export const metadata: Metadata = { title: "Check-in · PACE Platform" };

// Where a volunteer's phone lands after scanning the QR code.
// The real version will require sign-in and save the check-in and points in one transaction.
export default function DemoCheckInPage({ searchParams }: PageProps<"/demo/check-in">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-12">
      <DemoBadge />
      <Suspense fallback={<p className="text-zinc-600 dark:text-zinc-400">Checking your code…</p>}>
        <CheckInResult searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

type Outcome = "verified" | "expired" | "missing" | "not-configured";

async function CheckInResult({ searchParams }: Pick<PageProps<"/demo/check-in">, "searchParams">) {
  const { code } = await searchParams;

  let outcome: Outcome;
  if (!isDemoConfigured()) outcome = "not-configured";
  else if (typeof code !== "string" || code === "") outcome = "missing";
  else outcome = verifyDemoCode(code) ? "verified" : "expired";

  const { icon, title, body, good } = MESSAGES[outcome];
  return (
    <div className="flex flex-col gap-4">
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-full text-3xl font-bold text-white ${
          good ? "bg-green-500" : "bg-red-500"
        }`}
        aria-hidden
      >
        {icon}
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{body}</p>
    </div>
  );
}

const MESSAGES: Record<Outcome, { icon: string; title: string; body: string; good: boolean }> = {
  verified: {
    icon: "✓",
    title: "Code verified",
    body: "You scanned a valid, current code. In the finished app, this records your check-in and awards your PACE points.",
    good: true,
  },
  expired: {
    icon: "✕",
    title: "Code expired",
    body: "This code is more than a minute old or isn't valid. Scan the QR code on the event screen again.",
    good: false,
  },
  missing: {
    icon: "?",
    title: "No code found",
    body: "Scan the QR code on the event screen to check in.",
    good: false,
  },
  "not-configured": {
    icon: "!",
    title: "Demo not set up",
    body: "The QR demo secret isn't configured on this deployment.",
    good: false,
  },
};
