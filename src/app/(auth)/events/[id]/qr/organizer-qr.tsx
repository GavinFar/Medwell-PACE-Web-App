"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import type { QrStatus } from "@/lib/checkin/qr-status";

// The QR code (it changes every 30 seconds) and the "Checked in" panel.
// Asks the server for the latest every 5 seconds, and right away when the code runs out.
// If a request fails, the last code stays up and it tries again 5 seconds later.

const POLL_MS = 5_000;
const WINDOW_SECONDS = 30;

export function OrganizerQr({
  eventId,
  title,
  meta,
  points,
  initial,
}: {
  eventId: string;
  title: string;
  meta: string; // "Today · 9:00 AM – 12:00 PM · UTA Central Library"
  points: number;
  initial: QrStatus;
}) {
  const [status, setStatus] = useState(initial);
  // When the shown code runs out, by this browser's clock (the server sends a countdown,
  // not a time, so a laptop with the wrong time still rotates on schedule).
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const loading = useRef(false);
  const reload = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (loading.current) return;
      loading.current = true;
      try {
        const res = await fetch(`/api/events/${eventId}/qr`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const next = (await res.json()) as QrStatus;
        if (cancelled) return;
        setStatus(next);
        setExpiresAt(next.secondsRemaining === null ? null : Date.now() + next.secondsRemaining * 1000);
      } catch {
        // Keep showing the last code; the next poll tries again.
      } finally {
        loading.current = false;
      }
    }

    reload.current = load;
    load();
    const poll = setInterval(load, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [eventId]);

  const msLeft = expiresAt !== null && now !== null ? Math.max(0, expiresAt - now) : null;
  const secondsLeft = msLeft !== null ? Math.ceil(msLeft / 1000) : Math.ceil(status.secondsRemaining ?? 0);

  // The code just ran out: fetch the new one now rather than waiting for the next poll.
  useEffect(() => {
    if (msLeft === 0) reload.current();
  }, [msLeft]);

  return (
    <div className="org-grid">
      <div className="card qr-card">
        <h1>{title}</h1>
        <p className="qr-meta">{meta}</p>
        {status.state === "open" && status.url ? (
          <>
            {/* QR codes need dark-on-light to scan reliably. */}
            <div className="qr-box" data-value={status.url}>
              <QRCode value={status.url} size={330} fgColor="#001643" bgColor="#ffffff" title="Check-in QR code" />
            </div>
            <p className="qr-caption">Scan with your phone camera to check in</p>
            <p className="qr-sub">No app needed.{points > 0 ? ` Earn ${points} PACE points.` : ""}</p>
            <div className="refresh">
              <div className="refresh-bar">
                <span style={{ width: `${Math.min(100, (secondsLeft / WINDOW_SECONDS) * 100)}%` }} />
              </div>
              <p>
                New code in {secondsLeft} {secondsLeft === 1 ? "second" : "seconds"}
              </p>
            </div>
          </>
        ) : (
          <p className="qr-caption">
            {status.state === "not_started"
              ? `Check-in opens at ${status.opensAt}`
              : status.state === "ended"
                ? "Check-in has closed"
                : "Check-in isn't available for this event"}
          </p>
        )}
      </div>

      <div className="card count-card">
        <h2>Checked in</h2>
        <div className="count" aria-live="polite">
          {status.count}
        </div>
        <p className="count-sub">{status.count === 1 ? "volunteer so far" : "volunteers so far"}</p>
        {status.recent.length > 0 && (
          <ul className="recent">
            {status.recent.map((r, i) => (
              <li key={`${r.time}-${i}`}>
                <span>{r.name}</span>
                <span>{r.time}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="end-row">
          <span className="qr-sub">Updates by itself</span>
        </div>
      </div>
    </div>
  );
}
