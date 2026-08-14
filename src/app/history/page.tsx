import Link from "next/link";
import { formatDuration } from "@/lib/time";
import { fetchHistory, type DayHistory } from "@/server/history";

export const dynamic = "force-dynamic";

/**
 * Day-by-day history for the last few weeks, straight from GoHighLevel.
 * Reachable from the "History" chip on the live board, or /history?days=30.
 */
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const raw = Number.parseInt(daysParam ?? "14", 10);
  const daysBack = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 60) : 14;
  const history = await fetchHistory(daysBack);

  const totals = history.days.reduce(
    (acc, d) => ({
      total: acc.total + d.total,
      responded: acc.responded + d.responded,
      won: acc.won + d.won,
      lost: acc.lost + d.lost,
    }),
    { total: 0, responded: 0, won: 0, lost: 0 }
  );
  const maxTotal = Math.max(1, ...history.days.map((d) => d.total));

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Enquiry History</h1>
            <p className="text-lg text-slate-500">
              Day by day, last {daysBack} days · timezone {history.timezone}
            </p>
          </div>
          <nav className="flex items-center gap-2 text-sm font-semibold">
            <RangeChip days={7} active={daysBack === 7} />
            <RangeChip days={14} active={daysBack === 14} />
            <RangeChip days={30} active={daysBack === 30} />
            <Link
              href="/"
              className="ml-2 rounded-lg bg-sky-600 px-3 py-1.5 text-white transition hover:bg-sky-700"
            >
              ← Live board
            </Link>
          </nav>
        </header>

        {!history.ok ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-xl text-amber-800">
            {history.error}
          </div>
        ) : (
          <>
            <section className="mb-6 grid grid-cols-4 gap-4">
              <Summary label="Enquiries" value={totals.total} accent="bg-sky-50 text-sky-700 border-sky-200" />
              <Summary label="Responded" value={totals.responded} accent="bg-blue-50 text-blue-700 border-blue-200" />
              <Summary label="Won" value={totals.won} accent="bg-emerald-50 text-emerald-700 border-emerald-200" />
              <Summary label="Lost" value={totals.lost} accent="bg-rose-50 text-rose-700 border-rose-200" />
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-900/5">
              <table className="w-full text-left text-lg">
                <thead className="bg-slate-50 text-sm uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Day</th>
                    <th className="px-4 py-3">Volume</th>
                    <th className="px-4 py-3 text-right">Enquiries</th>
                    <th className="px-4 py-3 text-right">Responded</th>
                    <th className="px-4 py-3 text-right">Avg response</th>
                    <th className="px-4 py-3 text-right">Won</th>
                    <th className="px-4 py-3 text-right">Lost</th>
                    <th className="px-6 py-3">Top source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.days.map((day) => (
                    <DayRow key={day.date} day={day} maxTotal={maxTotal} />
                  ))}
                </tbody>
              </table>
            </section>

            <p className="mt-4 text-sm text-slate-400">
              Click a day to see its individual enquiries. Response times come
              from GoHighLevel’s stage-change records; leads without a usable
              record count toward volume but not the average.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function DayRow({ day, maxTotal }: { day: DayHistory; maxTotal: number }) {
  const quiet = day.total === 0;
  return (
    <tr className={quiet ? "opacity-50" : "transition hover:bg-sky-50"}>
      <td className="whitespace-nowrap px-6 py-3 font-semibold text-slate-800">
        {quiet ? (
          day.label
        ) : (
          <Link
            href={`/history/${day.date}`}
            className="text-sky-700 underline-offset-2 hover:underline"
          >
            {day.label}
          </Link>
        )}
      </td>
      <td className="w-48 px-4 py-3">
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-sky-500"
            style={{ width: `${(day.total / maxTotal) * 100}%` }}
          />
        </div>
      </td>
      <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900">{day.total}</td>
      <td className="px-4 py-3 text-right tabular-nums text-blue-700">{day.responded}</td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-600">
        {day.avgResponseSeconds !== null ? formatDuration(day.avgResponseSeconds) : "—"}
      </td>
      <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-600">{day.won}</td>
      <td className="px-4 py-3 text-right tabular-nums text-rose-600">{day.lost}</td>
      <td className="px-6 py-3 text-slate-500">{day.topSource ?? "—"}</td>
    </tr>
  );
}

function RangeChip({ days, active }: { days: number; active: boolean }) {
  return (
    <Link
      href={`/history?days=${days}`}
      className={`rounded-lg px-3 py-1.5 transition ${
        active
          ? "bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-300"
          : "bg-white text-slate-500 ring-1 ring-inset ring-slate-200 hover:text-slate-700"
      }`}
    >
      {days} days
    </Link>
  );
}

function Summary({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 text-center shadow-sm shadow-slate-900/5 ${accent}`}>
      <div className="text-4xl font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-sm font-medium uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}
