import { LOCATIONS, locationForMember } from "@/config/team";
import { startOfTodayInZone } from "@/lib/time";
import type { ActivityEvent, Enquiry, EnquiryStatus } from "@/lib/types";
import type { ServerConfig } from "../config";
import type { DataSource } from "./types";

/**
 * GoHighLevel data source.
 *
 * Polls the GHL v2 API (services.leadconnectorhq.com) for today's
 * opportunities and maps pipeline stages onto dashboard statuses. Uses a
 * Private Integration token (Authorization: Bearer) plus the mandatory
 * Version header.
 *
 * Endpoints used:
 *  - GET /opportunities/search      today's opportunities for the location
 *  - GET /opportunities/pipelines   stage id → stage name mapping
 *  - GET /users/                    user id → salesperson name mapping
 *
 * Stage mapping: stage names are matched case-insensitively against keywords
 * (new/contacted/qualified/booked/won/lost). Rename-safe: unknown stages fall
 * back to "new" so a misconfigured pipeline shows leads as waiting rather
 * than hiding them.
 */

interface GhlPipelineStage {
  id: string;
  name: string;
}

interface GhlPipeline {
  id: string;
  name: string;
  stages: GhlPipelineStage[];
}

interface GhlOpportunity {
  id: string;
  name?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  assignedTo?: string | null;
  status?: string; // open | won | lost | abandoned
  source?: string;
  createdAt?: string;
  dateAdded?: string;
  lastStatusChangeAt?: string;
  lastStageChangeAt?: string;
  contact?: {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
  };
}

interface GhlUser {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

const STAGE_KEYWORDS: Array<{ keywords: string[]; status: EnquiryStatus }> = [
  { keywords: ["won", "sold", "closed won", "sale"], status: "won" },
  { keywords: ["lost", "closed lost", "dead", "abandoned"], status: "lost" },
  { keywords: ["booked", "appointment", "meeting", "scheduled"], status: "booked" },
  { keywords: ["qualified", "hot", "quoted", "proposal"], status: "qualified" },
  { keywords: ["contacted", "responded", "in progress", "follow"], status: "contacted" },
  { keywords: ["new", "lead", "enquiry", "inquiry", "incoming"], status: "new" },
];

export function mapStageNameToStatus(stageName: string): EnquiryStatus {
  const lower = stageName.toLowerCase();
  for (const { keywords, status } of STAGE_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) return status;
  }
  return "new";
}

export class GhlDataSource implements DataSource {
  readonly kind = "ghl" as const;

  private enquiries: Enquiry[] = [];
  private activity: ActivityEvent[] = [];
  private listeners = new Set<() => void>();
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private stageMap = new Map<string, EnquiryStatus>();
  private userMap = new Map<string, string>();
  private metadataLoaded = false;
  private consecutiveFailures = 0;
  private activityCounter = 0;

  constructor(private readonly config: ServerConfig) {}

  start(): void {
    if (this.pollHandle) return;
    void this.poll();
    this.pollHandle = setInterval(
      () => void this.poll(),
      this.config.ghl.pollIntervalMs
    );
  }

  stop(): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
    this.pollHandle = null;
  }

  getEnquiries(): Enquiry[] {
    return [...this.enquiries].sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );
  }

  getActivity(): ActivityEvent[] {
    return this.activity.slice(0, 50);
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── HTTP plumbing ─────────────────────────────────────────────────────────

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, this.config.ghl.baseUrl);
    for (const [key, value] of Object.entries(params ?? {})) {
      url.searchParams.set(key, value);
    }
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.ghl.apiKey}`,
        Version: this.config.ghl.apiVersion,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`GHL API ${res.status} ${res.statusText} for ${path}`);
    }
    return (await res.json()) as T;
  }

  /** Pipeline stages and users change rarely — fetch once, refresh on failure. */
  private async loadMetadata(): Promise<void> {
    if (this.metadataLoaded) return;

    const pipelines = await this.request<{ pipelines: GhlPipeline[] }>(
      "/opportunities/pipelines",
      { locationId: this.config.ghl.locationId }
    );
    const pipeline = this.config.ghl.pipelineId
      ? pipelines.pipelines.find((p) => p.id === this.config.ghl.pipelineId)
      : pipelines.pipelines[0];
    if (!pipeline) {
      throw new Error("No GoHighLevel pipeline found for this location");
    }
    this.stageMap.clear();
    for (const stage of pipeline.stages) {
      this.stageMap.set(stage.id, mapStageNameToStatus(stage.name));
    }

    const users = await this.request<{ users: GhlUser[] }>("/users/", {
      locationId: this.config.ghl.locationId,
    });
    this.userMap.clear();
    for (const user of users.users) {
      const name =
        user.name ??
        [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
      if (name) this.userMap.set(user.id, name);
    }

    this.metadataLoaded = true;
  }

  private async poll(): Promise<void> {
    try {
      await this.loadMetadata();

      const startOfDay = startOfTodayInZone(this.config.timezone);
      const results: GhlOpportunity[] = [];
      let page = 1;
      // The search endpoint pages at 100 — loop until a short page.
      for (;;) {
        const data = await this.request<{
          opportunities: GhlOpportunity[];
          meta?: { total?: number };
        }>("/opportunities/search", {
          location_id: this.config.ghl.locationId,
          date: startOfDay.toISOString(),
          limit: "100",
          page: String(page),
        });
        results.push(...(data.opportunities ?? []));
        if (!data.opportunities || data.opportunities.length < 100 || page >= 10) break;
        page += 1;
      }

      const todays = results.filter((opp) => {
        const created = opp.createdAt ?? opp.dateAdded;
        return created ? new Date(created) >= startOfDay : false;
      });

      const next = todays.map((opp) => this.toEnquiry(opp));
      this.diffIntoActivity(next);
      this.enquiries = next;
      this.consecutiveFailures = 0;
      this.emit();
    } catch (err) {
      this.consecutiveFailures += 1;
      // Metadata may be stale (e.g. token rotated, stages renamed) — force a
      // refresh on the next attempt after repeated failures.
      if (this.consecutiveFailures >= 3) this.metadataLoaded = false;
      console.error("[ghl] poll failed:", err);
      // Keep serving the last good snapshot; the wallboard must not go blank.
    }
  }

  /**
   * Location for an enquiry: the salesperson's home location from
   * src/config/team.ts when known, otherwise the location this GHL
   * sub-account is configured as (GHL_DASHBOARD_LOCATION_ID, defaulting to
   * the first configured location).
   */
  private resolveLocationId(assignedName: string | null): string {
    const fallback =
      this.config.ghl.dashboardLocationId ?? LOCATIONS[0]?.id ?? "main";
    if (!assignedName) return fallback;
    return locationForMember(assignedName) ?? fallback;
  }

  private toEnquiry(opp: GhlOpportunity): Enquiry {
    const receivedAt = opp.createdAt ?? opp.dateAdded ?? new Date().toISOString();
    let status: EnquiryStatus =
      (opp.pipelineStageId && this.stageMap.get(opp.pipelineStageId)) || "new";
    // The opportunity-level status wins for terminal states.
    if (opp.status === "won") status = "won";
    if (opp.status === "lost" || opp.status === "abandoned") status = "lost";

    // First response = the enquiry left the "new" stage. lastStageChangeAt is
    // the closest signal the opportunity object carries; a webhook-based
    // upgrade can later record the exact first-contact time.
    const respondedAt =
      status !== "new"
        ? opp.lastStageChangeAt ?? opp.lastStatusChangeAt ?? receivedAt
        : null;

    const assignedTo = opp.assignedTo
      ? this.userMap.get(opp.assignedTo) ?? "Unknown"
      : null;

    return {
      id: opp.id,
      contactName: opp.contact?.name ?? opp.name ?? "Unknown contact",
      phone: opp.contact?.phone ?? "—",
      source: opp.source || "GoHighLevel",
      assignedTo,
      locationId: this.resolveLocationId(assignedTo),
      status,
      receivedAt,
      respondedAt,
    };
  }

  /** Compare against the previous snapshot to synthesise the activity feed. */
  private diffIntoActivity(next: Enquiry[]): void {
    const prevById = new Map(this.enquiries.map((e) => [e.id, e]));
    const now = new Date().toISOString();

    for (const enquiry of next) {
      const prev = prevById.get(enquiry.id);
      if (!prev) {
        this.pushActivity("enquiry_received", `${enquiry.contactName} submitted an enquiry (${enquiry.source})`, enquiry.receivedAt, enquiry.locationId);
        continue;
      }
      if (prev.status !== enquiry.status) {
        const who = enquiry.assignedTo ?? "Someone";
        switch (enquiry.status) {
          case "contacted":
            this.pushActivity("contacted", `${who} contacted ${enquiry.contactName}`, now, enquiry.locationId);
            break;
          case "qualified":
            this.pushActivity("qualified", `${enquiry.contactName} marked Qualified`, now, enquiry.locationId);
            break;
          case "booked":
            this.pushActivity("booked", `Appointment booked with ${enquiry.contactName}`, now, enquiry.locationId);
            break;
          case "won":
            this.pushActivity("won", `Deal won — ${enquiry.contactName}`, now, enquiry.locationId);
            break;
          case "lost":
            this.pushActivity("lost", `Lead lost — ${enquiry.contactName}`, now, enquiry.locationId);
            break;
          default:
            break;
        }
      }
    }
  }

  private pushActivity(
    type: ActivityEvent["type"],
    message: string,
    at: string,
    locationId: string
  ): void {
    this.activityCounter += 1;
    this.activity.unshift({
      id: `ghl_act_${Date.now().toString(36)}_${this.activityCounter}`,
      at,
      type,
      message,
      locationId,
    });
    this.activity = this.activity.slice(0, 100);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}
