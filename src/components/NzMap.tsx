"use client";

import Link from "next/link";
import { LOCATIONS } from "@/config/team";
import { formatDuration, secondsBetween, secondsSince, slaLevel } from "@/lib/time";
import type { Enquiry, SlaLevel } from "@/lib/types";

/**
 * Stylised map of New Zealand with a live status dot per office location.
 * Dot colour = the worst response-timer state at that location right now
 * (green: all healthy, orange: response due soon, red: SLA breached,
 * grey: no enquiries yet). Dots link to each location's own dashboard.
 *
 * The coastline is drawn from coarse lat/lng points pushed through the same
 * projection as the location dots, so markers always sit correctly.
 */

// [lat, lng] outlines, coarse on purpose — this is a wallboard glyph, not GIS.
const NORTH_ISLAND: Array<[number, number]> = [
  [-34.43, 172.68], [-34.4, 173.05], [-34.9, 173.5], [-35.2, 174.2],
  [-35.75, 174.35], [-36.4, 174.8], [-36.85, 174.85], [-37.05, 175.35],
  [-36.5, 175.45], [-37.2, 175.85], [-37.65, 176.2], [-37.6, 177.1],
  [-37.85, 177.9], [-37.7, 178.55], [-38.65, 178.05], [-39.1, 177.9],
  [-39.5, 176.9], [-40.15, 176.6], [-41.2, 175.6], [-41.6, 175.3],
  [-41.3, 174.78], [-40.85, 175.0], [-39.93, 175.0], [-39.28, 173.75],
  [-39.06, 174.08], [-38.07, 174.75], [-37.05, 174.55], [-36.4, 174.2],
  [-35.5, 173.4], [-34.75, 172.9],
];

const SOUTH_ISLAND: Array<[number, number]> = [
  [-40.52, 172.75], [-40.75, 173.0], [-41.1, 173.3], [-40.85, 173.85],
  [-41.1, 174.3], [-41.73, 174.27], [-42.4, 173.68], [-43.1, 172.9],
  [-43.6, 172.75], [-43.85, 172.95], [-43.9, 172.6], [-44.4, 171.25],
  [-45.1, 170.97], [-45.9, 170.65], [-46.45, 169.8], [-46.6, 168.35],
  [-46.2, 167.5], [-45.9, 166.7], [-45.3, 167.0], [-44.6, 167.8],
  [-43.85, 169.0], [-43.1, 170.25], [-42.7, 170.95], [-42.45, 171.2],
  [-41.75, 171.6], [-41.25, 172.1], [-40.65, 172.55],
];

const STEWART_ISLAND: Array<[number, number]> = [
  [-46.75, 168.05], [-46.9, 168.15], [-47.15, 167.9], [-47.25, 167.55],
  [-47.0, 167.4], [-46.8, 167.75],
];

// Equirectangular-ish projection tuned for NZ's latitude (lat squished ~1.3×
// less than it would be if degrees were equal-length in both axes).
const LAT_MIN = -47.6, LAT_MAX = -34.2, LNG_MIN = 166.2, LNG_MAX = 178.9;
const PX_PER_LNG = 20;
const PX_PER_LAT = 26;
export const MAP_W = (LNG_MAX - LNG_MIN) * PX_PER_LNG; // 254
export const MAP_H = (LAT_MAX - LAT_MIN) * PX_PER_LAT; // ~348

function project(lat: number, lng: number): [number, number] {
  return [(lng - LNG_MIN) * PX_PER_LNG, (LAT_MAX - lat) * PX_PER_LAT];
}

function toPath(points: Array<[number, number]>): string {
  return (
    points
      .map(([lat, lng], i) => {
        const [x, y] = project(lat, lng);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ") + " Z"
  );
}

const ISLAND_PATHS = [NORTH_ISLAND, SOUTH_ISLAND, STEWART_ISLAND].map(toPath);

const DOT_COLOURS: Record<SlaLevel | "idle", string> = {
  healthy: "fill-emerald-400",
  warning: "fill-orange-400",
  breach: "fill-red-500",
  idle: "fill-zinc-600",
};

interface LocationLive {
  total: number;
  waiting: number;
  worst: SlaLevel | "idle";
  avgResponseSeconds: number | null;
}

function summarise(
  enquiries: Enquiry[],
  now: number,
  warnMinutes: number,
  breachMinutes: number
): LocationLive {
  const waiting = enquiries.filter((e) => e.respondedAt === null);
  let worst: SlaLevel | "idle" = enquiries.length === 0 ? "idle" : "healthy";
  const rank: Record<SlaLevel, number> = { healthy: 0, warning: 1, breach: 2 };
  for (const e of waiting) {
    const level = slaLevel(secondsSince(e.receivedAt, now), warnMinutes, breachMinutes);
    if (worst === "idle" || rank[level] > rank[worst as SlaLevel]) worst = level;
  }
  const times = enquiries
    .filter((e): e is Enquiry & { respondedAt: string } => e.respondedAt !== null)
    .map((e) => secondsBetween(e.receivedAt, e.respondedAt));
  return {
    total: enquiries.length,
    waiting: waiting.length,
    worst,
    avgResponseSeconds: times.length
      ? times.reduce((a, b) => a + b, 0) / times.length
      : null,
  };
}

interface NzMapProps {
  enquiries: Enquiry[];
  now: number;
  warnMinutes: number;
  breachMinutes: number;
}

export function NzMap({ enquiries, now, warnMinutes, breachMinutes }: NzMapProps) {
  const perLocation = LOCATIONS.map((location) => ({
    location,
    live: summarise(
      enquiries.filter((e) => e.locationId === location.id),
      now,
      warnMinutes,
      breachMinutes
    ),
  }));

  return (
    <section className="flex shrink-0 gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-lg shadow-black/30">
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="h-60 w-auto shrink-0"
        role="img"
        aria-label="Map of New Zealand office locations"
      >
        {ISLAND_PATHS.map((d) => (
          <path
            key={d}
            d={d}
            className="fill-zinc-800/90 stroke-zinc-600"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        ))}
        {perLocation.map(({ location, live }) => {
          const [x, y] = project(location.lat, location.lng);
          return (
            <Link key={location.id} href={`/l/${location.id}`}>
              <g className={live.worst === "breach" ? "animate-sla-pulse-fast" : ""}>
                <circle cx={x} cy={y} r={11} className={`${DOT_COLOURS[live.worst]} opacity-25`} />
                <circle cx={x} cy={y} r={6} className={DOT_COLOURS[live.worst]} />
                <text
                  x={x + 12}
                  y={y + 4}
                  className="fill-zinc-300 text-[11px] font-bold"
                >
                  {location.shortName}
                  {live.waiting > 0 ? ` · ${live.waiting}` : ""}
                </text>
              </g>
            </Link>
          );
        })}
      </svg>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <h2 className="mb-1 text-xl font-bold text-zinc-100">Locations</h2>
        {perLocation.map(({ location, live }) => (
          <Link
            key={location.id}
            href={`/l/${location.id}`}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1 transition hover:bg-zinc-800/70"
          >
            <span
              className={`h-3.5 w-3.5 shrink-0 rounded-full ${
                live.worst === "breach"
                  ? "bg-red-500 animate-sla-pulse-fast"
                  : live.worst === "warning"
                    ? "bg-orange-400"
                    : live.worst === "idle"
                      ? "bg-zinc-600"
                      : "bg-emerald-400"
              }`}
            />
            <span className="truncate text-lg font-semibold text-zinc-200">
              {location.name}
            </span>
            <span className="ml-auto whitespace-nowrap text-base tabular-nums text-zinc-400">
              {live.total} enq
              {live.waiting > 0 && (
                <span className="ml-1.5 font-bold text-orange-300">
                  {live.waiting} waiting
                </span>
              )}
              {live.waiting === 0 && live.avgResponseSeconds !== null && (
                <span className="ml-1.5 text-zinc-500">
                  avg {formatDuration(live.avgResponseSeconds)}
                </span>
              )}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
