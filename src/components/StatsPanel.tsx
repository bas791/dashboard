import { formatDuration } from "@/lib/time";
import type { DailyStats } from "@/lib/types";

export function StatsPanel({ stats, warnMinutes }: { stats: DailyStats; warnMinutes: number }) {
  const fmt = (seconds: number | null) =>
    seconds !== null ? formatDuration(seconds) : "—";

  const slaTone =
    stats.slaPercent === null
      ? "text-slate-500"
      : stats.slaPercent >= 80
        ? "text-emerald-600"
        : stats.slaPercent >= 50
          ? "text-orange-600"
          : "text-red-600";

  return (
    <section className="shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-md shadow-slate-900/5">
      <h2 className="mb-3 text-2xl font-bold text-slate-900">Today’s Response Stats</h2>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <Stat label="Average response" value={fmt(stats.avgResponseSeconds)} tone="text-sky-600" />
        <Stat
          label={`SLA (≤ ${warnMinutes}m)`}
          value={stats.slaPercent !== null ? `${Math.round(stats.slaPercent)}%` : "—"}
          tone={slaTone}
        />
        <Stat label="Fastest" value={fmt(stats.fastestResponseSeconds)} tone="text-emerald-600" />
        <Stat label="Slowest" value={fmt(stats.slowestResponseSeconds)} tone="text-orange-600" />
        <Stat label={`Within ${warnMinutes} min`} value={String(stats.respondedWithinSlaCount)} tone="text-emerald-600" />
        <Stat
          label="Over SLA"
          value={String(stats.overSlaCount)}
          tone={stats.overSlaCount > 0 ? "text-red-600" : "text-slate-600"}
        />
      </div>
    </section>
  );
}

function Stat({ label, value, tone = "text-slate-900" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className={`text-3xl font-bold tabular-nums ${tone}`}>{value}</div>
      <div className="text-sm uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}
