import { getLocation, locationForMember } from "@/config/team";
import { formatDuration } from "@/lib/time";
import type { LeaderboardRow } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];

/** Cap the wallboard at the top performers so the layout never overflows. */
const MAX_ROWS = 5;

interface LeaderboardProps {
  rows: LeaderboardRow[];
  /** On the NZ-wide board, tag each person with their office */
  showLocations?: boolean;
}

export function Leaderboard({ rows: allRows, showLocations = false }: LeaderboardProps) {
  const rows = allRows.slice(0, MAX_ROWS);
  return (
    <section className="h-full rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-900/5">
      <h2 className="border-b border-slate-200 bg-gradient-to-r from-amber-50 to-white px-6 py-3 text-2xl font-bold text-slate-900">
        Today’s Leaderboard
      </h2>
      <table className="w-full text-left text-lg">
        <thead className="text-sm uppercase tracking-wider text-slate-500">
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
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                Leaderboard builds as enquiries are assigned.
              </td>
            </tr>
          )}
          {rows.map((row, index) => (
            <tr key={row.name}>
              <td className="px-6 py-2 font-semibold text-slate-900">
                <span className="mr-2" aria-hidden>
                  {MEDALS[index] ?? ""}
                </span>
                {row.name}
                {showLocations && <LocationTag name={row.name} />}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-slate-600">{row.assigned}</td>
              <td className="px-4 py-2 text-right tabular-nums text-slate-600">{row.responded}</td>
              <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                {row.avgResponseSeconds !== null ? formatDuration(row.avgResponseSeconds) : "—"}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-amber-600">{row.booked}</td>
              <td className="px-4 py-2 text-right tabular-nums font-bold text-emerald-600">{row.sales}</td>
              <td className="px-6 py-2 text-right tabular-nums text-slate-600">
                {Math.round(row.conversionPercent)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function LocationTag({ name }: { name: string }) {
  const locationId = locationForMember(name);
  const location = locationId ? getLocation(locationId) : undefined;
  if (!location) return null;
  return (
    <span className="ml-2.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-sm font-medium uppercase tracking-wide text-slate-500">
      {location.shortName}
    </span>
  );
}
