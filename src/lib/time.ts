import type { SlaLevel } from "./types";

/** Seconds elapsed between an ISO timestamp and `now` (defaults to Date.now). */
export function secondsSince(iso: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
}

/** Seconds between two ISO timestamps. */
export function secondsBetween(fromIso: string, toIso: string): number {
  return Math.max(
    0,
    Math.floor((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000)
  );
}

/**
 * Format elapsed seconds as a counting timer: "00:15", "04:58", "1:04:58".
 * Hours only appear once the timer passes 60 minutes.
 */
export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Human-friendly duration: "3m 42s", "45s", "1h 12m". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const minutes = Math.floor(s / 60);
  if (minutes < 60) return `${minutes}m ${s % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/** Traffic-light level for a number of elapsed seconds against SLA thresholds. */
export function slaLevel(
  elapsedSeconds: number,
  warnMinutes: number,
  breachMinutes: number
): SlaLevel {
  if (elapsedSeconds >= breachMinutes * 60) return "breach";
  if (elapsedSeconds >= warnMinutes * 60) return "warning";
  return "healthy";
}

/** "14:32:07" style clock string in the dashboard timezone. */
export function formatClock(date: Date, timezone: string): string {
  return date.toLocaleTimeString("en-NZ", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: timezone,
  });
}

/** "Tuesday 5 August 2025" style date string in the dashboard timezone. */
export function formatDate(date: Date, timezone: string): string {
  return date.toLocaleDateString("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  });
}

/** "14:32" received-at cell in the dashboard timezone. */
export function formatTimeShort(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString("en-NZ", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

/** Start of "today" (midnight) in the given IANA timezone, as a Date. */
export function startOfTodayInZone(timezone: string, now: Date = new Date()): Date {
  // Get the wall-clock date components in the target zone, then find the UTC
  // instant of that zone's midnight by parsing the offset-adjusted string.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // e.g. "2025-08-05"
  // Walk back from `now` until the zone-local date string changes: cheap and
  // DST-safe for a once-per-poll calculation.
  const target = parts;
  let t = now.getTime();
  const step = 15 * 60 * 1000;
  while (
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(t - step)) === target
  ) {
    t -= step;
  }
  // t is now within 15 min after midnight; snap down minute-by-minute.
  const minute = 60 * 1000;
  while (
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(t - minute)) === target
  ) {
    t -= minute;
  }
  return new Date(t);
}
