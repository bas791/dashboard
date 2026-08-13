import type { SourceRow } from "@/lib/types";

const MAX_ROWS = 4;

/**
 * Where today's leads came from: one bar per source, busiest first, with the
 * number of leads and how many of them have closed. Single-hue bars — the
 * label carries identity, colour only encodes "this is volume". Kept compact
 * (and shrinkable) so it shares the side column with the map/stats and the
 * activity feed without pushing them off a 1080p TV.
 */
export function SourcesPanel({ rows }: { rows: SourceRow[] }) {
  const top = rows.slice(0, MAX_ROWS);
  const overflow = rows.length - top.length;
  const max = Math.max(1, ...top.map((r) => r.total));

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-lg shadow-black/30">
      <h2 className="mb-2 shrink-0 text-xl font-bold text-zinc-100">Lead Sources Today</h2>
      {top.length === 0 ? (
        <p className="py-1 text-lg text-zinc-500">No enquiries yet today.</p>
      ) : (
        <ul className="min-h-0 space-y-2 overflow-hidden">
          {top.map((row) => (
            <li key={row.source}>
              <div className="mb-0.5 flex items-baseline justify-between gap-3 text-base leading-tight">
                <span className="truncate text-zinc-200">{row.source}</span>
                <span className="shrink-0 tabular-nums text-zinc-100">
                  <span className="font-bold">{row.total}</span>
                  <span className="text-zinc-500"> lead{row.total === 1 ? "" : "s"}</span>
                  {row.won > 0 && (
                    <span className="text-emerald-300"> · {row.won} closed</span>
                  )}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-sky-400"
                  style={{ width: `${(row.total / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
          {overflow > 0 && (
            <li className="text-sm text-zinc-500">
              + {overflow} more source{overflow === 1 ? "" : "s"}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
