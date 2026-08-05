import type { DashboardSnapshot } from "@/lib/types";
import { loadServerConfig, type ServerConfig } from "./config";
import { GhlDataSource } from "./datasource/ghl";
import { MockDataSource } from "./datasource/mock";
import type { DataSource } from "./datasource/types";

/**
 * Process-wide dashboard store: owns the active data source and fans changes
 * out to every connected SSE client. Cached on globalThis so Next.js dev-mode
 * hot reloads and multiple route evaluations reuse one instance (and one GHL
 * poller) instead of spawning duplicates.
 */

export class DashboardStore {
  readonly config: ServerConfig;
  private readonly source: DataSource;
  private readonly subscribers = new Set<(snapshot: DashboardSnapshot) => void>();

  constructor() {
    this.config = loadServerConfig();
    this.source =
      this.config.dataSource === "ghl"
        ? new GhlDataSource(this.config)
        : new MockDataSource();
    this.source.onChange(() => this.broadcast());
    this.source.start();
  }

  getSnapshot(): DashboardSnapshot {
    return {
      generatedAt: new Date().toISOString(),
      config: {
        slaWarnMinutes: this.config.slaWarnMinutes,
        slaBreachMinutes: this.config.slaBreachMinutes,
        timezone: this.config.timezone,
        dataSource: this.source.kind,
      },
      enquiries: this.source.getEnquiries(),
      activity: this.source.getActivity(),
    };
  }

  subscribe(onSnapshot: (snapshot: DashboardSnapshot) => void): () => void {
    this.subscribers.add(onSnapshot);
    return () => this.subscribers.delete(onSnapshot);
  }

  private broadcast(): void {
    if (this.subscribers.size === 0) return;
    const snapshot = this.getSnapshot();
    for (const notify of this.subscribers) {
      try {
        notify(snapshot);
      } catch {
        // A broken client stream must never take the wallboard down.
      }
    }
  }
}

const globalForStore = globalThis as unknown as { __dashboardStore?: DashboardStore };

export function getStore(): DashboardStore {
  if (!globalForStore.__dashboardStore) {
    globalForStore.__dashboardStore = new DashboardStore();
  }
  return globalForStore.__dashboardStore;
}
