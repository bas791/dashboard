import { formatDuration } from "@/lib/time";
import { DrillPage, NoticeCard, RecordTable, SummaryTile } from "@/components/RecordTable";
import { fetchEnquiryWindow } from "@/server/history";

export const dynamic = "force-dynamic";

/**
 * One salesperson's page: their enquiries and results over the window.
 * Linked from the leaderboard and every "Assigned" cell.
 */
export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { name: rawName } = await params;
  const { days: daysParam } = await searchParams;
  const name = decodeURIComponent(rawName);
  const raw = Number.parseInt(daysParam ?? "14", 10);
  const daysBack = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 60) : 14;

  const window = await fetchEnquiryWindow(daysBack);
  if (!window.ok) {
    return (
      <DrillPage title={name} subtitle="Salesperson">
        <NoticeCard message={window.error ?? "Could not load."} />
      </DrillPage>
    );
  }

  const records = window.enquiries.filter(
    (e) => e.assignedTo?.toLowerCase() === name.toLowerCase()
  );
  const responded = records.filter((e) => e.responded);
  const times = records
    .map((e) => e.responseSeconds)
    .filter((t): t is number => t !== null);
  const quotes = records.filter((e) => e.status === "qualified").length;
  const won = records.filter((e) => e.status === "won").length;

  return (
    <DrillPage title={name} subtitle={`Last ${daysBack} days · ${records.length} leads handled`}>
      <section className="mb-6 grid grid-cols-5 gap-4">
        <SummaryTile label="Assigned" value={String(records.length)} accent="bg-sky-50 text-sky-700 border-sky-200" />
        <SummaryTile label="Responded" value={String(responded.length)} accent="bg-blue-50 text-blue-700 border-blue-200" />
        <SummaryTile
          label="Avg response"
          value={times.length ? formatDuration(times.reduce((a, t) => a + t, 0) / times.length) : "—"}
          accent="bg-violet-50 text-violet-700 border-violet-200"
        />
        <SummaryTile label="Quotes sent" value={String(quotes)} accent="bg-amber-50 text-amber-700 border-amber-200" />
        <SummaryTile label="Jobs won" value={String(won)} accent="bg-emerald-50 text-emerald-700 border-emerald-200" />
      </section>
      <RecordTable records={records} timezone={window.timezone} showDay showAssigned={false} />
    </DrillPage>
  );
}
