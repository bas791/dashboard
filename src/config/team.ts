/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  YOUR LOCATIONS AND TEAM — edit this file to match your business.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * LOCATIONS drive the per-site dashboards and the NZ map:
 *   - each location gets its own TV view at  /l/<id>
 *   - the NZ-wide view at  /  shows every location on the map
 *   - lat/lng position the dot on the map (Google Maps → right-click → copy)
 *
 * TEAM lists every salesperson. They appear on the leaderboard from the moment
 * they're added (with zeros until they get enquiries). `locationId` must match
 * a location below. In GoHighLevel mode, names are matched case-insensitively
 * against GHL user names, so use the same display names as in GHL.
 */

export interface OfficeLocation {
  /** URL-safe id: /l/<id> */
  id: string;
  name: string;
  /** Short label used on the map and in compact chips */
  shortName: string;
  lat: number;
  lng: number;
}

export interface TeamMember {
  name: string;
  locationId: string;
}

export const LOCATIONS: OfficeLocation[] = [
  // lat/lng only positions the dot on the NZ map — update to your city
  // (Google Maps → right-click your office → copy coordinates).
  { id: "main", name: "Maximum Wash", shortName: "MW", lat: -36.85, lng: 174.76 },
];

export const TEAM: TeamMember[] = [
  // Names must match GoHighLevel user names (case-insensitive).
  { name: "Bas van Wel", locationId: "main" },
  { name: "Herman Thompson", locationId: "main" },
  { name: "Jarryd Pearce", locationId: "main" },
  { name: "Madelien Van Der Merwe", locationId: "main" },
  { name: "Nikko Sandoval", locationId: "main" },
];

export function getLocation(id: string): OfficeLocation | undefined {
  return LOCATIONS.find((l) => l.id === id);
}

export function teamForLocation(locationId: string): TeamMember[] {
  return TEAM.filter((m) => m.locationId === locationId);
}

/** Case-insensitive lookup: salesperson name → their home location id. */
export function locationForMember(name: string): string | undefined {
  const lower = name.toLowerCase();
  return TEAM.find((m) => m.name.toLowerCase() === lower)?.locationId;
}
