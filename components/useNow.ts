"use client";

import { useEffect, useState } from "react";

/** The current time, refreshed every `intervalMs`, so time-based states (e.g. a judge timeout) update by themselves. */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
