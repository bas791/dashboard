/**
 * Core domain types shared by the server (data sources, stats) and the client
 * (components). Keep this file dependency-free so it can be imported anywhere.
 */

/** Pipeline stages an enquiry moves through. Mirrors the GoHighLevel pipeline. */
export type EnquiryStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "booked"
  | "won"
  | "lost";

export const ENQUIRY_STATUSES: EnquiryStatus[] = [
  "new",
  "contacted",
  "qualified",
  "booked",
  "won",
  "lost",
];

/** SLA traffic-light state for a response timer. */
export type SlaLevel = "healthy" | "warning" | "breach";

export interface Enquiry {
  id: string;
  contactName: string;
  phone: string;
  /** Lead source, e.g. "Website Form", "Facebook Ads", "Google Ads", "Phone" */
  source: string;
  /** Display name of the assigned salesperson, or null if unassigned */
  assignedTo: string | null;
  /** Which office/branch this enquiry belongs to (see src/config/team.ts) */
  locationId: string;
  status: EnquiryStatus;
  /** ISO timestamp the enquiry was received */
  receivedAt: string;
  /**
   * ISO timestamp of the first response (call/SMS/stage move), or null while
   * the enquiry is still waiting. When set, the response timer stops.
   */
  respondedAt: string | null;
}

export type ActivityType =
  | "enquiry_received"
  | "contacted"
  | "qualified"
  | "booked"
  | "won"
  | "lost"
  | "assigned";

export interface ActivityEvent {
  id: string;
  /** ISO timestamp */
  at: string;
  type: ActivityType;
  message: string;
  /** Location the event happened at; omitted for company-wide events */
  locationId?: string;
}

export interface DailyStats {
  totalEnquiries: number;
  respondedCount: number;
  waitingCount: number;
  avgResponseSeconds: number | null;
  fastestResponseSeconds: number | null;
  slowestResponseSeconds: number | null;
  /** Percentage (0–100) of responded enquiries answered within the SLA window */
  slaPercent: number | null;
  respondedWithinSlaCount: number;
  /** Responded late OR still waiting past the SLA threshold */
  overSlaCount: number;
}

export interface LeaderboardRow {
  name: string;
  assigned: number;
  responded: number;
  avgResponseSeconds: number | null;
  booked: number;
  sales: number;
  /** Won ÷ assigned, percentage 0–100 */
  conversionPercent: number;
}

export type StatusCounts = Record<EnquiryStatus, number>;

/** One row of the "where today's leads came from" breakdown. */
export interface SourceRow {
  source: string;
  /** Enquiries received today from this source */
  total: number;
  /** Of those, how many have closed as won */
  won: number;
}

/** Runtime settings the client needs (thresholds drive timer colours). */
export interface DashboardConfig {
  slaWarnMinutes: number;
  slaBreachMinutes: number;
  timezone: string;
  /** Which backend produced the data — shown subtly so mock mode is obvious */
  dataSource: "mock" | "ghl";
}

/**
 * The raw data pushed to clients over SSE. Stats, KPI counts and the
 * leaderboard are derived CLIENT-side (src/lib/stats.ts) so each view — a
 * single location's TV or the NZ-wide board — can filter enquiries and
 * compute its own numbers from one shared stream. Timers likewise tick
 * client-side from receivedAt with zero network traffic.
 */
export interface DashboardSnapshot {
  generatedAt: string;
  config: DashboardConfig;
  enquiries: Enquiry[];
  activity: ActivityEvent[];
}
