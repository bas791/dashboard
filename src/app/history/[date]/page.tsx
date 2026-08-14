import { DrillPage, NoticeCard, RecordTable, SummaryTile } from "@/components/RecordTable";
import { fetchEnquiryWindow, formatDayLabel } from "@/server/history";

export const dynamic = "force-dynamic";

/** All enquiries for one calendar day — linked from the History table. */
export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return (
      <DrillPage title="Day view" subtitle="Unknown day">
        <NoticeCard message="That day address doesn't look right — go back to History and click a day." />
      </DrillPage>
    );
  }

  // Window size: enough days to cover the requested date (capped at 60).
  const dayMs = 24 * 60 * 60 * 1000;
  const daysAgo = Math.ceil((Date.now() - new Date(`${date}T00:00:00`).getTime()) / dayMs);
  const window = await fetchEnquiryWindow(Math.min(Math.max(daysAgo + 1, 1), 60));

  if (!window.ok) {
    return (
      <DrillPage title="Day view" subtitle={date}>
        <NoticeCard message={window.error ?? "Could not load."} />
      </DrillPage>
    );
  }

  const records = window.enquiries.filter((e) => e.date === date);
  const won = records.filter((e) => e.status === "won").length;
  const responded = records.filter((e) => e.responded).length;

  return (
    <DrillPage
      title={formatDayLabel(date, window.timezone)}
      subtitle={`Every enquiry received this day · ${window.timezone}`}
    >
      <section className="mb-6 grid grid-cols-3 gap-4">
        <SummaryTile label="Enquiries" value={String(records.length)} accent="bg-sky-50 text-sky-700 border-sky-200" />
        <SummaryTile label="Responded" value={String(responded)} accent="bg-blue-50 text-blue-700 border-blue-200" />
        <SummaryTile label="Jobs won" value={String(won)} accent="bg-emerald-50 text-emerald-700 border-emerald-200" />
      </section>
      <RecordTable records={records} timezone={window.timezone} />
    </DrillPage>
  );
}
