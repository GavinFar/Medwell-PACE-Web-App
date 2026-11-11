"use client";

import { useEffect, useState } from "react";

// The "Send again in 60 seconds" timer from Krishna's pages (PACE.countdown in
// public/app.js): counts down once a second until 0. Call start(seconds) to restart.
export function useCountdown(initialSeconds: number) {
  const [left, setLeft] = useState(initialSeconds);

  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  return { left, start: setLeft };
}
