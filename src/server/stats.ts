import { secondsBetween, secondsSince } from "@/lib/time";
import type {
  DailyStats,
  Enquiry,
  EnquiryStatus,
  LeaderboardRow,
  StatusCounts,
} from "@/lib/types";

/**
 * Pure aggregation functions over today's enquiries. Data-source agnostic:
 * both the mock simulator and the GoHighLevel poller feed the same shapes in.
 */

export function computeStatusCounts(enquiries: Enquiry[]): StatusCounts {
  const counts: StatusCounts = {
    new: 0,
    contacted: 0,
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

const SALE_STATUSES: EnquiryStatus[] = ["won"];
const BOOKED_STATUSES: EnquiryStatus[] = ["booked", "won"];

export function computeLeaderboard(enquiries: Enquiry[]): LeaderboardRow[] {
  const byPerson = new Map<string, Enquiry[]>();
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
