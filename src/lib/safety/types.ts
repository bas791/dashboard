/**
 * Shared types for the health & safety section (asset register, inspections,
 * vehicle pre-starts). Safe to import from both server and client code.
 */

export type Role = "crew" | "inspector" | "manager";
export const ROLES: { id: Role; label: string }[] = [
  { id: "crew", label: "Crew" },
  { id: "inspector", label: "Competent inspector" },
  { id: "manager", label: "Manager" },
];

export type AssetCategory = "vehicle" | "height" | "machine" | "access" | "other";
export const CATEGORIES: { id: AssetCategory; label: string }[] = [
  { id: "vehicle", label: "Vehicles & trailers" },
  { id: "height", label: "Height & rope gear" },
  { id: "machine", label: "Machines" },
  { id: "access", label: "Ladders & access" },
  { id: "other", label: "Other" },
];

export type AssetStatus = "in_service" | "quarantined" | "retired";

/** routine = pre-start (vehicles) / pre-use (everything else) */
export type ChecklistKind = "routine" | "detailed";

export interface ChecklistItem {
  id: string;
  label: string;
  /** A photo must be attached before this check can be passed. */
  photo: boolean;
  /** Failing this check takes the item out of service. */
  critical: boolean;
}

export interface Person {
  id: string;
  name: string;
  locationId: string;
  role: Role;
  active: boolean;
}

export interface AssetType {
  id: string;
  name: string;
  category: AssetCategory;
  /** Days between detailed inspections; null = no periodic inspection. */
  detailedIntervalDays: number | null;
}

export interface Checklist {
  typeId: string;
  kind: ChecklistKind;
  items: ChecklistItem[];
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  typeId: string;
  typeName: string;
  category: AssetCategory;
  locationId: string;
  serial: string | null;
  manufacturer: string | null;
  model: string | null;
  manufacturedOn: string | null;
  inServiceOn: string | null;
  retireOn: string | null;
  status: AssetStatus;
  holderPersonId: string | null;
  holderPersonName: string | null;
  holderVehicleId: string | null;
  holderVehicleName: string | null;
  notes: string | null;
  createdAt: string;
  /** Date the next detailed inspection is due (YYYY-MM-DD), if the type has an interval. */
  detailedDueOn: string | null;
  detailedOverdue: boolean;
  /** Timestamp of the most recent routine check. */
  lastRoutineAt: string | null;
  routineDoneToday: boolean;
  openFaults: number;
  labelPhotoId: string | null;
}

export type CheckOutcome = "pass" | "fail" | "na";

/** What Claude said about one inspection photo. It can flag, never pass. */
export interface PhotoAssessment {
  usable: boolean;
  concern: "none" | "possible" | "clear";
  note: string;
}

export interface LabelReading {
  serial: string | null;
  manufacturer: string | null;
  model: string | null;
  manufacturedOn: string | null;
  suggestedName: string | null;
  notes: string | null;
}

export interface CheckResult {
  itemId: string;
  label: string;
  critical: boolean;
  outcome: CheckOutcome;
  note: string;
  photoIds: string[];
  /** Worst AI concern across this check's photos, kept for the record. */
  aiConcern: PhotoAssessment["concern"] | null;
  aiNote: string | null;
}

export interface Inspection {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  kind: ChecklistKind;
  personName: string;
  result: "pass" | "fail";
  results: CheckResult[];
  notes: string | null;
  odometer: number | null;
  /** A check was passed even though AI flagged a concern in its photo. */
  aiFlagged: boolean;
  createdAt: string;
}

export interface Fault {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  inspectionId: string | null;
  itemLabel: string;
  note: string;
  critical: boolean;
  status: "open" | "resolved";
  createdAt: string;
  resolvedByName: string | null;
  resolvedNote: string | null;
  resolvedAt: string | null;
}

export interface AssetEvent {
  id: string;
  kind: string;
  detail: string;
  personName: string | null;
  createdAt: string;
}

export function routineLabel(category: AssetCategory): string {
  return category === "vehicle" ? "Pre-start check" : "Pre-use check";
}

export function kindLabel(kind: ChecklistKind, category: AssetCategory): string {
  return kind === "detailed" ? "Detailed inspection" : routineLabel(category);
}

export function canInspectDetailed(role: Role): boolean {
  return role === "inspector" || role === "manager";
}
