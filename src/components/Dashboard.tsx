"use client";

import { useEffect, useMemo, useRef } from "react";
import { getLocation, TEAM } from "@/config/team";
import { useChime } from "@/hooks/useChime";
import { useDashboardStream } from "@/hooks/useDashboardStream";
import { useNow } from "@/hooks/useNow";
import { computeDailyStats, computeLeaderboard, computeStatusCounts } from "@/lib/stats";
import { ActivityFeed } from "./ActivityFeed";
import { DashboardHeader } from "./DashboardHeader";
import { EnquiryTable } from "./EnquiryTable";
import { KpiCards } from "./KpiCards";
import { Leaderboard } from "./Leaderboard";
import { NzMap } from "./NzMap";
import { StatsPanel } from "./StatsPanel";

/**
 * Client root: wires the SSE stream, the shared 1-second tick, the chime and
 * the fullscreen TV mode together, then lays the panels out for a 16:9 TV.
 *
 * One shared stream carries every location's data; each view filters it:
 *  - `/`            NZ-wide board with the locations map
 *  - `/l/<id>`      a single office's board (its own stats panel, its own
 *                   alerts — a TV in Hamilton only chimes for Hamilton leads)
 *
 * Keyboard: press F (or double-click anywhere) to toggle fullscreen.
 */
export function Dashboard({ locationId }: { locationId?: string }) {
  const { snapshot, connection, newEnquiryIds } = useDashboardStream();
  const now = useNow();
  const { soundEnabled, enableSound, playChime } = useChime();

  const location = locationId ? getLocation(locationId) : undefined;

  // This view's slice of the company-wide data.
  const enquiries = useMemo(() => {
    const all = snapshot?.enquiries ?? [];
    return location ? all.filter((e) => e.locationId === location.id) : all;
  }, [snapshot, location]);

  const activity = useMemo(() => {
    const all = snapshot?.activity ?? [];
    return location
      ? all.filter((e) => !e.locationId || e.locationId === location.id)
      : all;
  }, [snapshot, location]);

  // New arrivals for THIS view only — drives both the chime and row highlights.
  const recentIds = useMemo(() => {
    const inView = new Set(enquiries.map((e) => e.id));
    return new Set(newEnquiryIds.filter((id) => inView.has(id)));
  }, [newEnquiryIds, enquiries]);

  // Play the bell exactly once per new enquiry, even across re-renders.
  const chimedIds = useRef(new Set<string>());
  useEffect(() => {
    let shouldChime = false;
    for (const id of recentIds) {
      if (!chimedIds.current.has(id)) {
        chimedIds.current.add(id);
        shouldChime = true;
      }
    }
    if (shouldChime) playChime();
  }, [recentIds, playChime]);

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

  // Derived numbers for this view, recomputed each tick so "over SLA" counts
  // stay live. Pure functions over ≤ a day of enquiries — cheap.
  const config = snapshot?.config;
  const stats = useMemo(
    () => computeDailyStats(enquiries, config?.slaWarnMinutes ?? 5, now),
    [enquiries, config?.slaWarnMinutes, now]
  );
  const statusCounts = useMemo(() => computeStatusCounts(enquiries), [enquiries]);
  const leaderboard = useMemo(() => {
    const team = location ? TEAM.filter((m) => m.locationId === location.id) : TEAM;
    return computeLeaderboard(enquiries, team.map((m) => m.name));
  }, [enquiries, location]);

  if (!snapshot || !config) {
    return (
      <main className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="text-center">
          <div className="mb-4 text-6xl" aria-hidden>📡</div>
          <p className="text-3xl font-semibold text-zinc-300">Connecting to dashboard…</p>
        </div>
      </main>
    );
  }

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
        currentLocation={location}
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
            showLocations={!location}
          />
        </div>
        <div className="flex min-h-0 flex-col gap-4">
          {location ? (
            // Single-office TV: that office's response stats up top.
            <StatsPanel stats={stats} warnMinutes={config.slaWarnMinutes} />
          ) : (
            // NZ-wide board: the live locations map instead (nationwide stats
            // already headline the header and KPI row).
            <NzMap
              enquiries={enquiries}
              now={now}
              warnMinutes={config.slaWarnMinutes}
              breachMinutes={config.slaBreachMinutes}
            />
          )}
          <ActivityFeed activity={activity} timezone={config.timezone} />
        </div>
      </div>

      <Leaderboard rows={leaderboard} showLocations={!location} />
    </main>
  );
}
