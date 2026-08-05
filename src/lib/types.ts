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

/** Runtime settings the client needs (thresholds drive timer colours). */
export interface DashboardConfig {
  slaWarnMinutes: number;
  slaBreachMinutes: number;
  timezone: string;
  /** Which backend produced the data — shown subtly so mock mode is obvious */
  dataSource: "mock" | "ghl";
}

/**
 * Everything the dashboard renders, computed server-side and pushed to
 * clients over SSE. Timers are derived client-side from receivedAt so they
 * tick every second without server round-trips.
 */
export interface DashboardSnapshot {
  generatedAt: string;
  config: DashboardConfig;
  enquiries: Enquiry[];
  statusCounts: StatusCounts;
  stats: DailyStats;
  activity: ActivityEvent[];
  leaderboard: LeaderboardRow[];
}
