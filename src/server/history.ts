import { secondsBetween } from "@/lib/time";
import { loadServerConfig } from "./config";
import { mapStageNameToStatus } from "./datasource/ghl";
import type { EnquiryStatus } from "@/lib/types";

/**
 * Day-by-day history, computed on demand straight from the GoHighLevel API —
 * no local database, so it works identically on any host and survives
 * restarts/redeploys. Each request fetches the tracked pipeline's
 * opportunities for the window and aggregates per calendar day in the
 * dashboard timezone.
 *
 * Response times use GHL's stage-change timestamp where present. Leads whose
 * record carries no usable timestamp are counted in volume but excluded from
 * the response-time average (better no data than fake data).
 */

export interface DayHistory {
  /** "2026-08-14" in the dashboard timezone */
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

interface GhlOpportunity {
  id: string;
  pipelineId?: string;
  pipelineStageId?: string;
  status?: string;
  source?: string;
  createdAt?: string;
  dateAdded?: string;
  lastStatusChangeAt?: string;
  lastStageChangeAt?: string;
}

const MAX_PAGES = 30; // 3000 opportunities — far above a normal window

export async function fetchHistory(daysBack: number): Promise<HistoryResult> {
  const config = loadServerConfig();
  const { apiKey, locationId, baseUrl, apiVersion, pipelineId } = config.ghl;
  const timezone = config.timezone;

  if (!apiKey || !locationId) {
    return {
      ok: false,
      error:
        "History needs the GoHighLevel connection — set GHL_API_KEY and GHL_LOCATION_ID (see README).",
      timezone,
      days: [],
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
      return { ok: false, error: "No GoHighLevel pipeline found.", timezone, days: [] };
    }
    const stageStatus = new Map<string, EnquiryStatus>(
      pipeline.stages.map((s) => [s.id, mapStageNameToStatus(s.name)])
    );

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

    // Group by calendar day in the dashboard timezone.
    const dayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const dayLabel = new Intl.DateTimeFormat("en-NZ", {
      timeZone: timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    // The window's day keys, today first.
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const wanted: Array<{ date: string; label: string }> = [];
    for (let i = 0; i < daysBack; i++) {
      const d = new Date(now - i * dayMs);
      wanted.push({ date: dayKey.format(d), label: dayLabel.format(d) });
    }
    const wantedSet = new Set(wanted.map((w) => w.date));

    interface Bucket {
      total: number;
      responded: number;
      won: number;
      lost: number;
      responseTimes: number[];
      sources: Map<string, number>;
    }
    const buckets = new Map<string, Bucket>();

    for (const opp of opportunities) {
      if (opp.pipelineId && opp.pipelineId !== pipeline.id) continue;
      const created = opp.createdAt ?? opp.dateAdded;
      if (!created) continue;
      const key = dayKey.format(new Date(created));
      if (!wantedSet.has(key)) continue;

      const empty: Bucket = { total: 0, responded: 0, won: 0, lost: 0, responseTimes: [], sources: new Map() };
      const bucket = buckets.get(key) ?? empty;
      bucket.total += 1;

      let status: EnquiryStatus =
        (opp.pipelineStageId && stageStatus.get(opp.pipelineStageId)) || "new";
      if (opp.status === "won") status = "won";
      if (opp.status === "lost" || opp.status === "abandoned") status = "lost";

      if (status !== "new") {
        bucket.responded += 1;
        const respondedAt = opp.lastStageChangeAt ?? opp.lastStatusChangeAt;
        if (respondedAt) {
          bucket.responseTimes.push(secondsBetween(created, respondedAt));
        }
      }
      if (status === "won") bucket.won += 1;
      if (status === "lost") bucket.lost += 1;

      const source = opp.source || "Unknown";
      bucket.sources.set(source, (bucket.sources.get(source) ?? 0) + 1);
      buckets.set(key, bucket);
    }

    const days: DayHistory[] = wanted.map(({ date, label }) => {
      const b = buckets.get(date);
      if (!b) {
        return { date, label, total: 0, responded: 0, won: 0, lost: 0, avgResponseSeconds: null, topSource: null };
      }
      const top = [...b.sources.entries()].sort((x, y) => y[1] - x[1])[0];
      return {
        date,
        label,
        total: b.total,
        responded: b.responded,
        won: b.won,
        lost: b.lost,
        avgResponseSeconds: b.responseTimes.length
          ? b.responseTimes.reduce((a, t) => a + t, 0) / b.responseTimes.length
          : null,
        topSource: top ? `${top[0]} ×${top[1]}` : null,
      };
    });

    return { ok: true, timezone, days };
  } catch (err) {
    return {
      ok: false,
      error: `Could not fetch history from GoHighLevel: ${err instanceof Error ? err.message : String(err)}`,
      timezone,
      days: [],
    };
  }
}
