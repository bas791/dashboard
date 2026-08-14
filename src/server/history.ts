import { secondsBetween } from "@/lib/time";
import { loadServerConfig } from "./config";
import { mapStageNameToStatus } from "./datasource/ghl";
import type { EnquiryStatus } from "@/lib/types";

/**
 * Historical data, computed on demand straight from the GoHighLevel API —
 * no local database, so it works identically on any host and survives
 * restarts/redeploys. One fetch returns enquiry-level records; the
 * aggregate day-by-day view is derived from them.
 *
 * Response times use GHL's stage-change timestamp where present. Leads whose
 * record carries no usable timestamp count toward volume but not averages
 * (better no data than fake data).
 */

export interface HistoricEnquiry {
  id: string;
  /** "2026-08-14" day key in the dashboard timezone */
  date: string;
  contactName: string;
  phone: string;
  source: string;
  assignedTo: string | null;
  status: EnquiryStatus;
  receivedAt: string;
  /** Seconds to first response, when GHL recorded a usable timestamp */
  responseSeconds: number | null;
  responded: boolean;
}

export interface EnquiryWindow {
  ok: boolean;
  error?: string;
  timezone: string;
  enquiries: HistoricEnquiry[];
}

export interface DayHistory {
  date: string;
  /** "Fri 14 Aug" */
  label: string;
  total: number;
  responded: number;
  won: number;
  lost: number;
  avgResponseSeconds: number | null;
  /** e.g. "Facebook ×4" — the day's busiest source */
  topSource: string | null;
}

export interface HistoryResult {
  ok: boolean;
  error?: string;
  timezone: string;
  days: DayHistory[];
}

interface GhlPipeline {
  id: string;
  name: string;
  stages: Array<{ id: string; name: string }>;
}

interface GhlUser {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

interface GhlOpportunity {
  id: string;
  name?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  assignedTo?: string | null;
  status?: string;
  source?: string;
  createdAt?: string;
  dateAdded?: string;
  lastStatusChangeAt?: string;
  lastStageChangeAt?: string;
  contact?: { name?: string; phone?: string };
}

const MAX_PAGES = 30; // 3000 opportunities — far above a normal window

function dayKeyFormatter(timezone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** "Fri 14 Aug" for a "2026-08-14" day key. */
export function formatDayLabel(dateKey: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${dateKey}T12:00:00`));
}

/** Fetch enquiry-level records for the last `daysBack` days. */
export async function fetchEnquiryWindow(daysBack: number): Promise<EnquiryWindow> {
  const config = loadServerConfig();
  const { apiKey, locationId, baseUrl, apiVersion, pipelineId } = config.ghl;
  const timezone = config.timezone;

  if (!apiKey || !locationId) {
    return {
      ok: false,
      error:
        "This view needs the GoHighLevel connection — set GHL_API_KEY and GHL_LOCATION_ID (see README).",
      timezone,
      enquiries: [],
    };
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Version: apiVersion,
    Accept: "application/json",
  };

  const get = async <T>(path: string, params: Record<string, string>): Promise<T> => {
    const url = new URL(path, baseUrl);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) throw new Error(`GHL API ${res.status} for ${path}`);
    return (await res.json()) as T;
  };

  try {
    const { pipelines = [] } = await get<{ pipelines: GhlPipeline[] }>(
      "/opportunities/pipelines",
      { locationId }
    );
    const pipeline = pipelineId
      ? pipelines.find((p) => p.id === pipelineId)
      : pipelines[0];
    if (!pipeline) {
      return { ok: false, error: "No GoHighLevel pipeline found.", timezone, enquiries: [] };
    }
    const stageStatus = new Map<string, EnquiryStatus>(
      pipeline.stages.map((s) => [s.id, mapStageNameToStatus(s.name)])
    );

    // User id → display name (tolerant: missing scope just means "Unknown").
    const userNames = new Map<string, string>();
    try {
      const { users = [] } = await get<{ users: GhlUser[] }>("/users/", { locationId });
      for (const u of users) {
        const name = u.name ?? [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
        if (name) userNames.set(u.id, name);
      }
    } catch {
      // Leaderboard-style name resolution degrades gracefully.
    }

    const opportunities: GhlOpportunity[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const data = await get<{ opportunities: GhlOpportunity[] }>(
        "/opportunities/search",
        {
          location_id: locationId,
          pipeline_id: pipeline.id,
          limit: "100",
          page: String(page),
        }
      );
      opportunities.push(...(data.opportunities ?? []));
      if (!data.opportunities || data.opportunities.length < 100) break;
    }

    const dayKey = dayKeyFormatter(timezone);
    const dayMs = 24 * 60 * 60 * 1000;
    const wanted = new Set<string>();
    const now = Date.now();
    for (let i = 0; i < daysBack; i++) {
      wanted.add(dayKey.format(new Date(now - i * dayMs)));
    }

    const enquiries: HistoricEnquiry[] = [];
    for (const opp of opportunities) {
      if (opp.pipelineId && opp.pipelineId !== pipeline.id) continue;
      const created = opp.createdAt ?? opp.dateAdded;
      if (!created) continue;
      const date = dayKey.format(new Date(created));
      if (!wanted.has(date)) continue;

      let status: EnquiryStatus =
        (opp.pipelineStageId && stageStatus.get(opp.pipelineStageId)) || "new";
      if (opp.status === "won") status = "won";
      if (opp.status === "lost" || opp.status === "abandoned") status = "lost";

      const respondedStamp = opp.lastStageChangeAt ?? opp.lastStatusChangeAt;
      enquiries.push({
        id: opp.id,
        date,
        contactName: opp.contact?.name ?? opp.name ?? "Unknown contact",
        phone: opp.contact?.phone ?? "—",
        source: opp.source || "Unknown",
        assignedTo: opp.assignedTo ? userNames.get(opp.assignedTo) ?? "Unknown" : null,
        status,
        receivedAt: created,
        responseSeconds:
          status !== "new" && respondedStamp ? secondsBetween(created, respondedStamp) : null,
        responded: status !== "new",
      });
    }

    enquiries.sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );
    return { ok: true, timezone, enquiries };
  } catch (err) {
    return {
      ok: false,
      error: `Could not fetch from GoHighLevel: ${err instanceof Error ? err.message : String(err)}`,
      timezone,
      enquiries: [],
    };
  }
}

/** Day-by-day aggregates for the last `daysBack` days, today first. */
export async function fetchHistory(daysBack: number): Promise<HistoryResult> {
  const window = await fetchEnquiryWindow(daysBack);
  if (!window.ok) {
    return { ok: false, error: window.error, timezone: window.timezone, days: [] };
  }

  const byDate = new Map<string, HistoricEnquiry[]>();
  for (const e of window.enquiries) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }

  const dayKey = dayKeyFormatter(window.timezone);
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const days: DayHistory[] = [];
  for (let i = 0; i < daysBack; i++) {
    const date = dayKey.format(new Date(now - i * dayMs));
    const list = byDate.get(date) ?? [];
    const times = list
      .map((e) => e.responseSeconds)
      .filter((t): t is number => t !== null);
    const sources = new Map<string, number>();
    for (const e of list) sources.set(e.source, (sources.get(e.source) ?? 0) + 1);
    const top = [...sources.entries()].sort((x, y) => y[1] - x[1])[0];
    days.push({
      date,
      label: formatDayLabel(date, window.timezone),
      total: list.length,
      responded: list.filter((e) => e.responded).length,
      won: list.filter((e) => e.status === "won").length,
      lost: list.filter((e) => e.status === "lost").length,
      avgResponseSeconds: times.length
        ? times.reduce((a, t) => a + t, 0) / times.length
        : null,
      topSource: top ? `${top[0]} ×${top[1]}` : null,
    });
  }

  return { ok: true, timezone: window.timezone, days };
}
