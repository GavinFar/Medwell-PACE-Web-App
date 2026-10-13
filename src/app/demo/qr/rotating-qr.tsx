"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";

const WINDOW_MS = 30_000;

type Current = { url: string; expiresAt: number };

// Shows the current check-in QR code and fetches a new one each time it rotates.
export function RotatingQr() {
  const [current, setCurrent] = useState<Current | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);

  // Fetch the code, then schedule the next fetch for when it rotates.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function load() {
      try {
        const res = await fetch("/api/demo/qr", { cache: "no-store" });
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);

        // Use the server's countdown, not the server's clock, so a laptop
        // with the wrong time still rotates on schedule.
        const msLeft = body.secondsRemaining * 1000;
        setCurrent({ url: body.url, expiresAt: Date.now() + msLeft });
        setError(null);
        timer = setTimeout(load, msLeft + 250);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Couldn't load the code");
        timer = setTimeout(load, 5_000);
      }
    }

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // Tick the countdown bar.
  useEffect(() => {
    if (!current) return;
    const tick = () => setRemainingMs(Math.max(0, current.expiresAt - Date.now()));
    const interval = setInterval(tick, 200);
    tick();
    return () => clearInterval(interval);
  }, [current]);

  if (error && !current) {
    return <p className="text-sm text-red-600 dark:text-red-400">Can&apos;t show the code: {error}</p>;
  }
  if (!current) {
    return <div className="aspect-square w-full max-w-xs animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />;
  }

  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <div className="flex w-full max-w-xs flex-col gap-4">
      {/* QR codes need dark-on-light to scan reliably, even in dark mode. */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
        <QRCode value={current.url} size={256} className="h-auto w-full" />
      </div>
      <div className="flex flex-col gap-2">
        <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-green-500 transition-[width] duration-200 ease-linear"
            style={{ width: `${(remainingMs / WINDOW_MS) * 100}%` }}
          />
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">New code in {seconds}s</p>
      </div>
      <a href={current.url} className="text-sm text-zinc-500 underline underline-offset-4">
        Can&apos;t scan? Open the check-in link
      </a>
    </div>
  );
}
