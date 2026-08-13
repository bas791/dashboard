"use client";

import {
  formatDuration,
  formatTimer,
  secondsBetween,
  secondsSince,
  slaLevel,
} from "@/lib/time";
import type { Enquiry, SlaLevel } from "@/lib/types";

const LEVEL_STYLES: Record<SlaLevel, string> = {
  healthy: "bg-emerald-100 text-emerald-700 ring-emerald-300",
  warning: "bg-orange-100 text-orange-700 ring-orange-400 animate-sla-pulse",
  breach: "bg-red-100 text-red-700 ring-red-400 animate-sla-pulse-fast",
};

interface ResponseTimerProps {
  enquiry: Enquiry;
  now: number;
  warnMinutes: number;
  breachMinutes: number;
}

/**
 * The response countdown timer cell. Counts up from 00:00 while an enquiry
 * is waiting; goes orange past the warn threshold and red + pulsing past the
 * breach threshold. Once responded it freezes and shows the final time.
 */
export function ResponseTimer({ enquiry, now, warnMinutes, breachMinutes }: ResponseTimerProps) {
  if (enquiry.respondedAt) {
    const took = secondsBetween(enquiry.receivedAt, enquiry.respondedAt);
    const level = slaLevel(took, warnMinutes, breachMinutes);
    const tone =
      level === "healthy"
        ? "text-emerald-600"
        : level === "warning"
          ? "text-orange-600"
          : "text-red-600";
    return (
      <div className="flex flex-col items-start leading-tight">
        <span className="flex items-center gap-1.5 text-lg font-semibold text-emerald-600">
          <span aria-hidden>✓</span> Responded
        </span>
        <span className={`text-base ${tone}`}>in {formatDuration(took)}</span>
      </div>
    );
  }

  const elapsed = secondsSince(enquiry.receivedAt, now);
  const level = slaLevel(elapsed, warnMinutes, breachMinutes);
  return (
    <span
      className={`inline-flex min-w-[6.5rem] items-center justify-center rounded-xl px-3 py-1.5 font-mono text-2xl font-bold tabular-nums ring-1 ring-inset ${LEVEL_STYLES[level]}`}
    >
      {formatTimer(elapsed)}
    </span>
  );
}

/** Small SLA dot for the dedicated SLA column. */
export function SlaDot({ enquiry, now, warnMinutes, breachMinutes }: ResponseTimerProps) {
  const seconds = enquiry.respondedAt
    ? secondsBetween(enquiry.receivedAt, enquiry.respondedAt)
    : secondsSince(enquiry.receivedAt, now);
  const level = slaLevel(seconds, warnMinutes, breachMinutes);
  const style =
    level === "healthy"
      ? "bg-emerald-500"
      : level === "warning"
        ? "bg-orange-400"
        : "bg-red-500";
  const label =
    level === "healthy" ? "On track" : level === "warning" ? "Due soon" : "Overdue";
  return (
    <span className="flex items-center gap-2">
      <span className={`h-4 w-4 rounded-full ${style} ${level !== "healthy" && !enquiry.respondedAt ? "animate-sla-pulse-fast" : ""}`} />
      <span className="text-lg text-slate-500">{label}</span>
    </span>
  );
}
