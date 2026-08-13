import { NextResponse } from "next/server";
import { TEAM } from "@/config/team";
import { mapStageNameToStatus } from "@/server/datasource/ghl";
import { loadServerConfig } from "@/server/config";

/**
 * GoHighLevel setup checker — open http://localhost:3000/api/ghl/check in a
 * browser after filling in .env.local. It verifies the token, lists your
 * pipelines/stages with the dashboard status each stage maps to, and checks
 * that GHL user names line up with src/config/team.ts. No dashboard data is
 * touched; this is purely a diagnostic.
 */

export const dynamic = "force-dynamic";

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

export async function GET(): Promise<NextResponse> {
  const config = loadServerConfig();
  const { apiKey, locationId, baseUrl, apiVersion, pipelineId } = config.ghl;

  const problems: string[] = [];
  if (!apiKey) problems.push("GHL_API_KEY is not set in .env.local");
  if (!locationId) problems.push("GHL_LOCATION_ID is not set in .env.local");
  if (problems.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        problems,
        help: "Copy .env.example to .env.local, fill in GHL_API_KEY (Settings → Private Integrations in GHL) and GHL_LOCATION_ID, set DATA_SOURCE=ghl, then restart the server and reload this page.",
      },
      { status: 200 }
    );
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Version: apiVersion,
    Accept: "application/json",
  };

  const explainStatus = (status: number): string => {
    if (status === 401) return "Token rejected (401) — check GHL_API_KEY is a Private Integration token, copied in full.";
    if (status === 403) return "Forbidden (403) — the token is valid but missing scopes. Grant contacts/opportunities/users readonly scopes to the Private Integration.";
    if (status === 404) return "Not found (404) — check GHL_LOCATION_ID.";
    return `GoHighLevel returned HTTP ${status}.`;
  };

  try {
    // 1. Pipelines + stage mapping preview
    const pipelinesRes = await fetch(
      `${baseUrl}/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`,
      { headers, cache: "no-store" }
    );
    if (!pipelinesRes.ok) {
      return NextResponse.json(
        { ok: false, problems: [explainStatus(pipelinesRes.status)] },
        { status: 200 }
      );
    }
    const { pipelines = [] } = (await pipelinesRes.json()) as { pipelines: GhlPipeline[] };

    const pipelineReport = pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      selected: pipelineId ? p.id === pipelineId : p === pipelines[0],
      stages: p.stages.map((s) => ({
        name: s.name,
        mapsToDashboardStatus: mapStageNameToStatus(s.name),
      })),
    }));

    if (pipelines.length === 0) {
      problems.push("No pipelines found on this location — the dashboard needs at least one opportunity pipeline.");
    }
    if (pipelineId && !pipelines.some((p) => p.id === pipelineId)) {
      problems.push(`GHL_PIPELINE_ID=${pipelineId} does not match any pipeline on this location.`);
    }

    // 2. Users vs the dashboard team config
    const usersRes = await fetch(
      `${baseUrl}/users/?locationId=${encodeURIComponent(locationId)}`,
      { headers, cache: "no-store" }
    );
    let ghlUserNames: string[] = [];
    if (usersRes.ok) {
      const { users = [] } = (await usersRes.json()) as { users: GhlUser[] };
      ghlUserNames = users
        .map((u) => u.name ?? [u.firstName, u.lastName].filter(Boolean).join(" ").trim())
        .filter(Boolean);
    } else {
      problems.push(`Could not list users: ${explainStatus(usersRes.status)} (leaderboard will show "Unknown" for assigned reps)`);
    }

    const teamNames = TEAM.map((m) => m.name.toLowerCase());
    const unmatchedTeam = TEAM.filter(
      (m) => !ghlUserNames.some((u) => u.toLowerCase() === m.name.toLowerCase())
    ).map((m) => m.name);
    const unmatchedGhl = ghlUserNames.filter(
      (u) => !teamNames.includes(u.toLowerCase())
    );

    return NextResponse.json(
      {
        ok: problems.length === 0,
        problems,
        dataSourceActive: config.dataSource,
        note:
          config.dataSource !== "ghl"
            ? "Credentials work, but DATA_SOURCE is not 'ghl' — the dashboard is still showing mock data. Set DATA_SOURCE=ghl and restart."
            : "The dashboard is polling GoHighLevel with these settings.",
        pipelines: pipelineReport,
        stageMappingHint:
          "Each stage name is keyword-matched to a dashboard status (new/contacted/qualified/booked/won/lost). Unknown names fall back to 'new'. If a mapping looks wrong, either rename the stage in GHL or extend STAGE_KEYWORDS in src/server/datasource/ghl.ts.",
        ghlUsers: ghlUserNames,
        teamConfigCheck: {
          inTeamFileButNotInGhl: unmatchedTeam,
          inGhlButNotInTeamFile: unmatchedGhl,
          hint: "Names must match (case-insensitive) for enquiries to count toward the right location and leaderboard row. Edit src/config/team.ts to match the GHL names.",
        },
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        problems: [
          `Could not reach GoHighLevel: ${err instanceof Error ? err.message : String(err)}`,
          "Check your internet connection and that GHL_API_BASE_URL is unchanged (https://services.leadconnectorhq.com).",
        ],
      },
      { status: 200 }
    );
  }
}
