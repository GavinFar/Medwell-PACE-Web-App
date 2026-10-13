import type { Metadata } from "next";
import { DemoBadge } from "../demo-badge";
import { RotatingQr } from "./rotating-qr";

export const metadata: Metadata = { title: "QR check-in demo · PACE Platform" };

// What an organizer would show on a screen at the event.
export default function DemoQrPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-4 py-12">
      <div className="flex w-full flex-col gap-2">
        <DemoBadge />
        <h1 className="text-2xl font-semibold tracking-tight">Event check-in</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Volunteers scan this with their phone camera. The code changes every 30 seconds, so a
          photo or screenshot stops working within a minute.
        </p>
      </div>
      <RotatingQr />
    </main>
  );
}
