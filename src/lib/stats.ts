import { secondsBetween, secondsSince } from "@/lib/time";
import type {
  DailyStats,
  Enquiry,
  EnquiryStatus,
  LeaderboardRow,
  SourceRow,
  StatusCounts,
} from "@/lib/types";

/**
 * Pure aggregation functions over today's enquiries. They run CLIENT-side on
 * whatever slice of enquiries a view shows (one location, or all of NZ), so
 * every board derives its own stats from the single shared SSE stream.
 */

export function computeStatusCounts(enquiries: Enquiry[]): StatusCounts {
  const counts: StatusCounts = {
    new: 0,
    contacted: 0,
    chasing: 0,
    qualified: 0,
    booked: 0,
    won: 0,
    lost: 0,
  };
  for (const e of enquiries) counts[e.status] += 1;
  return counts;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computeDailyStats(
  enquiries: Enquiry[],
  slaWarnMinutes: number,
  now: number = Date.now()
): DailyStats {
  const responseTimes = enquiries
    .filter((e): e is Enquiry & { respondedAt: string } => e.respondedAt !== null)
    .map((e) => secondsBetween(e.receivedAt, e.respondedAt));

  const slaSeconds = slaWarnMinutes * 60;
  const respondedWithinSla = responseTimes.filter((t) => t <= slaSeconds).length;
  const respondedLate = responseTimes.length - respondedWithinSla;
  const waiting = enquiries.filter((e) => e.respondedAt === null);
  const waitingOverSla = waiting.filter(
    (e) => secondsSince(e.receivedAt, now) > slaSeconds
  ).length;

  const avg = average(responseTimes);

  return {
    totalEnquiries: enquiries.length,
    respondedCount: responseTimes.length,
    waitingCount: waiting.length,
    avgResponseSeconds: avg,
    fastestResponseSeconds: responseTimes.length
      ? Math.min(...responseTimes)
      : null,
    slowestResponseSeconds: responseTimes.length
      ? Math.max(...responseTimes)
      : null,
    slaPercent: responseTimes.length
      ? (respondedWithinSla / responseTimes.length) * 100
      : null,
    respondedWithinSlaCount: respondedWithinSla,
    overSlaCount: respondedLate + waitingOverSla,
  };
}

/** Volume and wins per lead source, busiest sources first. */
export function computeSourceBreakdown(enquiries: Enquiry[]): SourceRow[] {
  const bySource = new Map<string, SourceRow>();
  for (const e of enquiries) {
    const source = e.source || "Unknown";
    const row = bySource.get(source) ?? { source, total: 0, won: 0 };
    row.total += 1;
    if (e.status === "won") row.won += 1;
    bySource.set(source, row);
  }
  return [...bySource.values()].sort(
    (a, b) => b.total - a.total || b.won - a.won || a.source.localeCompare(b.source)
  );
}

const SALE_STATUSES: EnquiryStatus[] = ["won"];
const BOOKED_STATUSES: EnquiryStatus[] = ["booked", "won"];

/**
 * Per-salesperson performance. `alwaysInclude` lists configured team members
 * (src/config/team.ts) so new employees appear on the board with zeros from
 * day one, before their first enquiry is assigned.
 */
export function computeLeaderboard(
  enquiries: Enquiry[],
  alwaysInclude: string[] = []
): LeaderboardRow[] {
  const byPerson = new Map<string, Enquiry[]>();
  for (const name of alwaysInclude) byPerson.set(name, []);
  for (const e of enquiries) {
    if (!e.assignedTo) continue;
    const list = byPerson.get(e.assignedTo) ?? [];
    list.push(e);
    byPerson.set(e.assignedTo, list);
  }

  const rows: LeaderboardRow[] = [];
  for (const [name, assigned] of byPerson) {
    const responseTimes = assigned
      .filter((e): e is Enquiry & { respondedAt: string } => e.respondedAt !== null)
      .map((e) => secondsBetween(e.receivedAt, e.respondedAt));
    const sales = assigned.filter((e) => SALE_STATUSES.includes(e.status)).length;
    rows.push({
      name,
      assigned: assigned.length,
      responded: responseTimes.length,
      avgResponseSeconds: average(responseTimes),
      booked: assigned.filter((e) => BOOKED_STATUSES.includes(e.status)).length,
      sales,
      conversionPercent: assigned.length ? (sales / assigned.length) * 100 : 0,
    });
  }

  // Best performers first: most sales, then most responses, then fastest.
  rows.sort(
    (a, b) =>
      b.sales - a.sales ||
      b.responded - a.responded ||
      (a.avgResponseSeconds ?? Infinity) - (b.avgResponseSeconds ?? Infinity)
  );
  return rows;
}
