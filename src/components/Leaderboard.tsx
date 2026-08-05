import { formatDuration } from "@/lib/time";
import type { LeaderboardRow } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];

/** Cap the wallboard at the top performers so the layout never overflows. */
const MAX_ROWS = 5;

export function Leaderboard({ rows: allRows }: { rows: LeaderboardRow[] }) {
  const rows = allRows.slice(0, MAX_ROWS);
  return (
    <section className="shrink-0 rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg shadow-black/30">
      <h2 className="border-b border-zinc-800 px-6 py-3 text-2xl font-bold text-zinc-100">
        Today’s Leaderboard
      </h2>
      <table className="w-full text-left text-lg">
        <thead className="text-sm uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="px-6 py-2">Salesperson</th>
            <th className="px-4 py-2 text-right">Assigned</th>
            <th className="px-4 py-2 text-right">Responded</th>
            <th className="px-4 py-2 text-right">Avg response</th>
            <th className="px-4 py-2 text-right">Booked</th>
            <th className="px-4 py-2 text-right">Sales</th>
            <th className="px-6 py-2 text-right">Conversion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-6 py-8 text-center text-zinc-500">
                Leaderboard builds as enquiries are assigned.
              </td>
            </tr>
          )}
          {rows.map((row, index) => (
            <tr key={row.name}>
              <td className="px-6 py-2 font-semibold text-zinc-100">
                <span className="mr-2" aria-hidden>
                  {MEDALS[index] ?? ""}
                </span>
                {row.name}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-zinc-300">{row.assigned}</td>
              <td className="px-4 py-2 text-right tabular-nums text-zinc-300">{row.responded}</td>
              <td className="px-4 py-2 text-right tabular-nums text-zinc-300">
                {row.avgResponseSeconds !== null ? formatDuration(row.avgResponseSeconds) : "—"}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-amber-300">{row.booked}</td>
              <td className="px-4 py-2 text-right tabular-nums font-bold text-emerald-300">{row.sales}</td>
              <td className="px-6 py-2 text-right tabular-nums text-zinc-300">
                {Math.round(row.conversionPercent)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
