/**
 * Types and helpers for the photo mark-up tool (/markup).
 *
 * A "finding" is one patch of biological growth on a photo. Boxes are stored
 * normalised (0–1 of the image width/height) so the same numbers work at any
 * display size, on screen and in print. Keep this file dependency-free — it is
 * imported by both the API route and the browser components.
 */

/** What is actually growing. Drives the colour and the wording in the report. */
export type GrowthType =
  | "mould"
  | "lichen"
  | "moss"
  | "algae"
  | "organic-staining";

export const GROWTH_TYPES: GrowthType[] = [
  "mould",
  "lichen",
  "moss",
  "algae",
  "organic-staining",
];

/** How far advanced the growth is — light is a wash, heavy needs treatment. */
export type Severity = "light" | "moderate" | "heavy";

export const SEVERITIES: Severity[] = ["light", "moderate", "heavy"];

/** Normalised rectangle: 0–1 of the image's width and height. */
export interface MarkupBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Finding {
  id: string;
  box: MarkupBox;
  /** Short heading, e.g. "Moss in canopy sheet pans" */
  label: string;
  growthType: GrowthType;
  severity: Severity;
  /** The building element affected, e.g. "Corrugated canopy roof" */
  surface: string;
  /** A sentence or two: what it is, why it is there, what to do about it. */
  note: string;
  /** 0–1. Low confidence findings are drawn dashed so they get a second look. */
  confidence: number;
  /** Whether Claude found it or someone drew it by hand. */
  source: "ai" | "manual";
}

/** What the analyse endpoint returns for one photo. */
export interface PhotoAnalysis {
  summary: string;
  findings: Finding[];
}

/**
 * Severity palette. These are deliberately strong, saturated colours: the
 * mark-up has to stay readable over a bright roof photo and survive being
 * printed or emailed as a PDF.
 */
export const SEVERITY_COLORS: Record<Severity, string> = {
  light: "#eab308",
  moderate: "#f97316",
  heavy: "#dc2626",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  light: "Light",
  moderate: "Moderate",
  heavy: "Heavy",
};

export const GROWTH_LABELS: Record<GrowthType, string> = {
  mould: "Mould",
  lichen: "Lichen",
  moss: "Moss",
  algae: "Algae",
  "organic-staining": "Organic staining",
};

/** Rank used to pick a photo's worst finding for the summary chip. */
const SEVERITY_RANK: Record<Severity, number> = {
  light: 1,
  moderate: 2,
  heavy: 3,
};

export function worstSeverity(findings: Finding[]): Severity | null {
  let worst: Severity | null = null;
  for (const finding of findings) {
    if (!worst || SEVERITY_RANK[finding.severity] > SEVERITY_RANK[worst]) {
      worst = finding.severity;
    }
  }
  return worst;
}

/** Clamp a box to the image and give it a minimum size so it stays clickable. */
export function clampBox(box: MarkupBox): MarkupBox {
  const width = Math.min(Math.max(box.width, 0.01), 1);
  const height = Math.min(Math.max(box.height, 0.01), 1);
  return {
    width,
    height,
    x: Math.min(Math.max(box.x, 0), 1 - width),
    y: Math.min(Math.max(box.y, 0), 1 - height),
  };
}

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Where a photo is up to in the analysis queue. */
export type PhotoStatus = "queued" | "analysing" | "done" | "error";

/** One photo in the mark-up document, with everything shown about it. */
export interface MarkupPhoto {
  id: string;
  fileName: string;
  /** Downscaled JPEG data URL — see src/lib/image.ts. */
  dataUrl: string;
  width: number;
  height: number;
  status: PhotoStatus;
  error: string | null;
  /** Claude's overall read on the photo, editable by the estimator. */
  summary: string;
  /** Where on site this was taken — feeds back into the analysis as context. */
  caption: string;
  findings: Finding[];
}
