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
  { id: "auckland", name: "Auckland", shortName: "AKL", lat: -36.85, lng: 174.76 },
  { id: "hamilton", name: "Hamilton", shortName: "HAM", lat: -37.79, lng: 175.28 },
  { id: "wellington", name: "Wellington", shortName: "WLG", lat: -41.29, lng: 174.78 },
  { id: "christchurch", name: "Christchurch", shortName: "CHC", lat: -43.53, lng: 172.64 },
];

export const TEAM: TeamMember[] = [
  { name: "Sarah", locationId: "auckland" },
  { name: "Mike", locationId: "auckland" },
  { name: "Jess", locationId: "hamilton" },
  { name: "Tom", locationId: "wellington" },
  { name: "Emma", locationId: "christchurch" },
  { name: "Dave", locationId: "christchurch" },
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
