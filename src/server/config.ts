/**
 * Server-side configuration, read once from environment variables.
 * All GHL credentials stay on the server — only SLA thresholds and the
 * timezone are forwarded to the browser (see DashboardConfig).
 */

export interface ServerConfig {
  dataSource: "mock" | "ghl";
  slaWarnMinutes: number;
  slaBreachMinutes: number;
  timezone: string;
  ghl: {
    apiKey: string;
    locationId: string;
    baseUrl: string;
    apiVersion: string;
    pipelineId: string | null;
    pollIntervalMs: number;
  };
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadServerConfig(): ServerConfig {
  const requested = (process.env.DATA_SOURCE ?? "mock").toLowerCase();
  let dataSource: "mock" | "ghl" = requested === "ghl" ? "ghl" : "mock";

  const apiKey = process.env.GHL_API_KEY ?? "";
  const locationId = process.env.GHL_LOCATION_ID ?? "";

  // Fail soft: without credentials the live source cannot work, so fall back
  // to mock rather than crashing the wallboard.
  if (dataSource === "ghl" && (!apiKey || !locationId)) {
    console.warn(
      "[config] DATA_SOURCE=ghl but GHL_API_KEY / GHL_LOCATION_ID missing — falling back to mock data source"
    );
    dataSource = "mock";
  }

  return {
    dataSource,
    slaWarnMinutes: intFromEnv("SLA_WARN_MINUTES", 5),
    slaBreachMinutes: intFromEnv("SLA_BREACH_MINUTES", 10),
    timezone: process.env.DASHBOARD_TIMEZONE ?? "Pacific/Auckland",
    ghl: {
      apiKey,
      locationId,
      baseUrl:
        process.env.GHL_API_BASE_URL ?? "https://services.leadconnectorhq.com",
      apiVersion: process.env.GHL_API_VERSION ?? "2021-07-28",
      pipelineId: process.env.GHL_PIPELINE_ID || null,
      pollIntervalMs: intFromEnv("GHL_POLL_INTERVAL_MS", 15000),
    },
  };
}
