"use client";

import { useEffect, useMemo, useRef } from "react";
import { useChime } from "@/hooks/useChime";
import { useDashboardStream } from "@/hooks/useDashboardStream";
import { useNow } from "@/hooks/useNow";
import { ActivityFeed } from "./ActivityFeed";
import { DashboardHeader } from "./DashboardHeader";
import { EnquiryTable } from "./EnquiryTable";
import { KpiCards } from "./KpiCards";
import { Leaderboard } from "./Leaderboard";
import { StatsPanel } from "./StatsPanel";

/**
 * Client root: wires the SSE stream, the shared 1-second tick, the chime and
 * the fullscreen TV mode together, then lays the panels out for a 16:9 TV.
 *
 * Keyboard: press F (or double-click anywhere) to toggle fullscreen.
 */
export function Dashboard() {
  const { snapshot, connection, newEnquiryIds } = useDashboardStream();
  const now = useNow();
  const { soundEnabled, enableSound, playChime } = useChime();

  // Play the bell exactly once per new enquiry, even across re-renders.
  const chimedIds = useRef(new Set<string>());
  useEffect(() => {
    let shouldChime = false;
    for (const id of newEnquiryIds) {
      if (!chimedIds.current.has(id)) {
        chimedIds.current.add(id);
        shouldChime = true;
      }
    }
    if (shouldChime) playChime();
  }, [newEnquiryIds, playChime]);

  // Fullscreen TV mode: F key or double-click. No mouse needed once running.
  useEffect(() => {
    const toggleFullscreen = () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void document.documentElement.requestFullscreen().catch(() => {
          // Some TV browsers refuse the API — the page is fullscreen-friendly anyway.
        });
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "f") toggleFullscreen();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("dblclick", toggleFullscreen);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("dblclick", toggleFullscreen);
    };
  }, []);

  const recentIds = useMemo(() => new Set(newEnquiryIds), [newEnquiryIds]);

  if (!snapshot) {
    return (
      <main className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="text-center">
          <div className="mb-4 text-6xl" aria-hidden>📡</div>
          <p className="text-3xl font-semibold text-zinc-300">Connecting to dashboard…</p>
        </div>
      </main>
    );
  }

  const { config, enquiries, statusCounts, stats, activity, leaderboard } = snapshot;

  return (
    <main className="flex h-screen flex-col gap-4 overflow-hidden bg-zinc-950 p-4">
      {!soundEnabled && (
        <button
          onClick={enableSound}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/15 px-4 py-2 text-lg font-semibold text-amber-300 shadow-lg backdrop-blur transition hover:bg-amber-500/25"
        >
          🔔 Tap to enable sound alerts
        </button>
      )}

      <DashboardHeader
        now={now}
        timezone={config.timezone}
        stats={stats}
        connection={connection}
        dataSource={config.dataSource}
      />

      <KpiCards
        counts={statusCounts}
        total={stats.totalEnquiries}
        waiting={stats.waitingCount}
      />

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-4">
        <div className="col-span-2 flex min-h-0 flex-col">
          <EnquiryTable
            enquiries={enquiries}
            now={now}
            timezone={config.timezone}
            warnMinutes={config.slaWarnMinutes}
            breachMinutes={config.slaBreachMinutes}
            recentIds={recentIds}
          />
        </div>
        <div className="flex min-h-0 flex-col gap-4">
          <StatsPanel stats={stats} warnMinutes={config.slaWarnMinutes} />
          <ActivityFeed activity={activity} timezone={config.timezone} />
        </div>
      </div>

      <Leaderboard rows={leaderboard} />
    </main>
  );
}
