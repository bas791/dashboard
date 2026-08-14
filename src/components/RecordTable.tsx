import Link from "next/link";
import { formatDuration, formatTimeShort } from "@/lib/time";
import type { HistoricEnquiry } from "@/server/history";
import { formatDayLabel } from "@/server/history";
import { StatusBadge } from "./StatusBadge";

/**
 * Read-only enquiry list for the drill-down pages (day, person, jobs won).
 * Server-rendered — no live updates here; the wallboard stays the live view.
 */
export function RecordTable({
  records,
  timezone,
  showDay = false,
  showAssigned = true,
}: {
  records: HistoricEnquiry[];
  timezone: string;
  showDay?: boolean;
  showAssigned?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-900/5">
      <table className="w-full text-left text-lg">
        <thead className="bg-slate-50 text-sm uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-6 py-3">{showDay ? "Day" : "Time"}</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Source</th>
            {showAssigned && <th className="px-4 py-3">Assigned</th>}
            <th className="px-4 py-3">Status</th>
            <th className="px-6 py-3 text-right">Response</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {records.length === 0 && (
            <tr>
              <td colSpan={showAssigned ? 7 : 6} className="px-6 py-10 text-center text-xl text-slate-400">
                Nothing here for this period.
              </td>
            </tr>
          )}
          {records.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap px-6 py-3 font-mono text-slate-500">
                {showDay
                  ? `${formatDayLabel(r.date, timezone)} · ${formatTimeShort(r.receivedAt, timezone)}`
                  : formatTimeShort(r.receivedAt, timezone)}
              </td>
              <td className="px-4 py-3 font-semibold text-slate-900">{r.contactName}</td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-500">{r.phone}</td>
              <td className="px-4 py-3 text-slate-600">{r.source}</td>
              {showAssigned && (
                <td className="px-4 py-3 text-slate-600">
                  {r.assignedTo ? (
                    <Link
                      href={`/p/${encodeURIComponent(r.assignedTo)}`}
                      className="text-sky-700 underline-offset-2 hover:underline"
                    >
                      {r.assignedTo}
                    </Link>
                  ) : (
                    <span className="italic text-slate-400">Unassigned</span>
                  )}
                </td>
              )}
              <td className="px-4 py-3">
                <StatusBadge status={r.status} />
              </td>
              <td className="px-6 py-3 text-right tabular-nums text-slate-600">
                {r.responseSeconds !== null
                  ? formatDuration(r.responseSeconds)
                  : r.responded
                    ? "✓"
                    : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Shared page chrome for the drill-down pages. */
export function DrillPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
            <p className="text-lg text-slate-500">{subtitle}</p>
          </div>
          <nav className="flex items-center gap-2 text-sm font-semibold">
            <Link
              href="/history"
              className="rounded-lg bg-white px-3 py-1.5 text-slate-500 ring-1 ring-inset ring-slate-200 transition hover:text-slate-700"
            >
              History
            </Link>
            <Link
              href="/"
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-white transition hover:bg-sky-700"
            >
              ← Live board
            </Link>
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}

export function NoticeCard({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-xl text-amber-800">
      {message}
    </div>
  );
}

export function SummaryTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 text-center shadow-sm shadow-slate-900/5 ${accent}`}>
      <div className="text-4xl font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-sm font-medium uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}
