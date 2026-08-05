"use client";

import { useEffect, useState } from "react";

/**
 * A shared once-per-second tick. Drives the header clock and every response
 * timer so the whole board updates in the same frame.
 */
export function useNow(intervalMs: number = 1000): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(handle);
  }, [intervalMs]);
  return now;
}
