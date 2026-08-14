import { DrillPage, NoticeCard, RecordTable, SummaryTile } from "@/components/RecordTable";
import { fetchEnquiryWindow } from "@/server/history";

export const dynamic = "force-dynamic";

/** Every job won in the window — linked from the "Job Won" card. */
export default async function WonPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const raw = Number.parseInt(daysParam ?? "14", 10);
  const daysBack = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 60) : 14;

  const window = await fetchEnquiryWindow(daysBack);
  if (!window.ok) {
    return (
      <DrillPage title="Jobs Won" subtitle={`Last ${daysBack} days`}>
        <NoticeCard message={window.error ?? "Could not load."} />
      </DrillPage>
    );
  }

  const won = window.enquiries.filter((e) => e.status === "won");
  const bySalesperson = new Map<string, number>();
  for (const e of won) {
    const who = e.assignedTo ?? "Unassigned";
    bySalesperson.set(who, (bySalesperson.get(who) ?? 0) + 1);
  }
  const top = [...bySalesperson.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <DrillPage title="Jobs Won 🏆" subtitle={`Last ${daysBack} days · newest first`}>
      <section className="mb-6 grid grid-cols-2 gap-4">
        <SummaryTile label="Jobs won" value={String(won.length)} accent="bg-emerald-50 text-emerald-700 border-emerald-200" />
        <SummaryTile
          label="Top closer"
          value={top ? `${top[0]} (${top[1]})` : "—"}
          accent="bg-amber-50 text-amber-700 border-amber-200"
        />
      </section>
      <RecordTable records={won} timezone={window.timezone} showDay />
    </DrillPage>
  );
}
