"use client";

import { formatClock, formatDate, formatDuration } from "@/lib/time";
import type { DailyStats } from "@/lib/types";
import type { ConnectionState } from "@/hooks/useDashboardStream";

interface DashboardHeaderProps {
  now: number;
  timezone: string;
  stats: DailyStats;
  connection: ConnectionState;
  dataSource: "mock" | "ghl";
}

export function DashboardHeader({ now, timezone, stats, connection, dataSource }: DashboardHeaderProps) {
  const date = new Date(now);
  return (
    <header className="flex items-center justify-between gap-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-8 py-5 shadow-lg shadow-black/30">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
          Sales Command Centre
        </h1>
        <p className="text-xl text-zinc-400">{formatDate(date, timezone)}</p>
      </div>

      <div className="flex items-center gap-10">
        <HeaderStat
          label="Enquiries today"
          value={String(stats.totalEnquiries)}
          tone="text-sky-300"
        />
        <HeaderStat
          label="Avg first response"
          value={
            stats.avgResponseSeconds !== null
              ? formatDuration(stats.avgResponseSeconds)
              : "—"
          }
          tone="text-emerald-300"
        />
        <HeaderStat
          label="Awaiting response"
          value={String(stats.waitingCount)}
          tone={stats.waitingCount > 0 ? "text-orange-300" : "text-zinc-300"}
        />
      </div>

      <div className="flex flex-col items-end gap-1">
        <div className="font-mono text-5xl font-bold tabular-nums text-zinc-100">
          {formatClock(date, timezone)}
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              connection === "live"
                ? "bg-emerald-400"
                : connection === "connecting"
                  ? "bg-amber-400"
                  : "bg-red-500 animate-sla-pulse-fast"
            }`}
          />
          {connection === "live"
            ? dataSource === "mock"
              ? "Live · demo data"
              : "Live · GoHighLevel"
            : connection === "connecting"
              ? "Connecting…"
              : "Reconnecting…"}
        </div>
      </div>
    </header>
  );
}

function HeaderStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="text-center">
      <div className={`text-4xl font-bold tabular-nums ${tone}`}>{value}</div>
      <div className="text-base uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}
