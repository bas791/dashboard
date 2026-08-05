import { formatDuration } from "@/lib/time";
import type { DailyStats } from "@/lib/types";

export function StatsPanel({ stats, warnMinutes }: { stats: DailyStats; warnMinutes: number }) {
  const fmt = (seconds: number | null) =>
    seconds !== null ? formatDuration(seconds) : "—";

  const slaTone =
    stats.slaPercent === null
      ? "text-zinc-300"
      : stats.slaPercent >= 80
        ? "text-emerald-300"
        : stats.slaPercent >= 50
          ? "text-orange-300"
          : "text-red-300";

  return (
    <section className="shrink-0 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-lg shadow-black/30">
      <h2 className="mb-3 text-2xl font-bold text-zinc-100">Today’s Response Stats</h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <Stat label="Average response" value={fmt(stats.avgResponseSeconds)} />
        <Stat
          label={`SLA (≤ ${warnMinutes}m)`}
          value={stats.slaPercent !== null ? `${Math.round(stats.slaPercent)}%` : "—"}
          tone={slaTone}
        />
        <Stat label="Fastest" value={fmt(stats.fastestResponseSeconds)} tone="text-emerald-300" />
        <Stat label="Slowest" value={fmt(stats.slowestResponseSeconds)} tone="text-orange-300" />
        <Stat label={`Within ${warnMinutes} min`} value={String(stats.respondedWithinSlaCount)} tone="text-emerald-300" />
        <Stat
          label="Over SLA"
          value={String(stats.overSlaCount)}
          tone={stats.overSlaCount > 0 ? "text-red-300" : "text-zinc-300"}
        />
      </div>
    </section>
  );
}

function Stat({ label, value, tone = "text-zinc-100" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className={`text-3xl font-bold tabular-nums ${tone}`}>{value}</div>
      <div className="text-sm uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}
