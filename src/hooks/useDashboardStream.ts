"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardSnapshot } from "@/lib/types";

export type ConnectionState = "connecting" | "live" | "reconnecting";

interface DashboardStream {
  snapshot: DashboardSnapshot | null;
  connection: ConnectionState;
  /** IDs of enquiries that arrived after the dashboard loaded (for alerts). */
  newEnquiryIds: string[];
}

const FALLBACK_POLL_MS = 15_000;

/**
 * Subscribes to /api/stream (SSE). EventSource reconnects automatically; if
 * the stream stays down, a polling fallback keeps the board alive. Detects
 * brand-new enquiries by diffing IDs between snapshots — the very first
 * snapshot never triggers alerts (those enquiries aren't "new arrivals").
 */
export function useDashboardStream(): DashboardStream {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [newEnquiryIds, setNewEnquiryIds] = useState<string[]>([]);
  const seenIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    let disposed = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const ingest = (next: DashboardSnapshot) => {
      if (disposed) return;
      if (seenIds.current === null) {
        // First load: remember everything, alert on nothing.
        seenIds.current = new Set(next.enquiries.map((e) => e.id));
      } else {
        const fresh = next.enquiries
          .filter((e) => !seenIds.current!.has(e.id))
          .map((e) => e.id);
        if (fresh.length > 0) {
          for (const id of fresh) seenIds.current.add(id);
          setNewEnquiryIds((prev) => [...prev, ...fresh].slice(-30));
        }
      }
      setSnapshot(next);
    };

    const source = new EventSource("/api/stream");

    source.addEventListener("snapshot", (event) => {
      setConnection("live");
      try {
        ingest(JSON.parse((event as MessageEvent).data) as DashboardSnapshot);
      } catch (err) {
        console.error("Bad snapshot payload", err);
      }
    });

    source.onerror = () => {
      // EventSource retries by itself; flag the state so the UI shows it.
      setConnection("reconnecting");
    };

    // Belt and braces for environments where SSE is blocked: poll while not live.
    pollTimer = setInterval(async () => {
      if (source.readyState === EventSource.OPEN) return;
      try {
        const res = await fetch("/api/snapshot", { cache: "no-store" });
        if (res.ok) ingest((await res.json()) as DashboardSnapshot);
      } catch {
        // Still down — EventSource keeps retrying in parallel.
      }
    }, FALLBACK_POLL_MS);

    return () => {
      disposed = true;
      source.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  return { snapshot, connection, newEnquiryIds };
}
