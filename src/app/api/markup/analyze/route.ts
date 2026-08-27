import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import {
  clampBox,
  createId,
  GROWTH_TYPES,
  SEVERITIES,
  type Finding,
  type GrowthType,
  type PhotoAnalysis,
  type Severity,
} from "@/lib/markup";

/**
 * Mould / lichen / moss detection for the photo mark-up tool.
 *
 * Takes one photo as a data URL, asks Claude to point at every patch of
 * biological growth on the building, and returns normalised boxes plus the
 * notes that go in the report. The browser draws the outlines — nothing is
 * rendered here, so a failed call never costs you the photo.
 */

export const dynamic = "force-dynamic";
/** Vision + reasoning on a large photo takes a while; give it room. */
export const maxDuration = 120;

const MODEL = "claude-opus-5";

/** Roughly 6 MB of base64 — the browser downsizes well below this. */
const MAX_BASE64_LENGTH = 8_000_000;

const SUPPORTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

/**
 * Coordinates come back on a 0–1000 grid rather than as 0–1 decimals: models
 * place boxes more accurately on an integer grid, and it keeps the JSON tidy.
 */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "One or two sentences describing the overall condition of the building surfaces in this photo, as a tradesperson would write it on a quote.",
    },
    findings: {
      type: "array",
      description:
        "Every distinct patch of biological growth. Empty if the surfaces are clean.",
      items: {
        type: "object",
        properties: {
          label: {
            type: "string",
            description:
              "Short heading, max 6 words, e.g. 'Moss in canopy sheet pans'.",
          },
          surface: {
            type: "string",
            description:
              "The building element affected, e.g. 'Corrugated canopy roof', 'Parapet capping', 'Box gutter', 'Weatherboard cladding'.",
          },
          growth_type: { type: "string", enum: GROWTH_TYPES },
          severity: { type: "string", enum: SEVERITIES },
          note: {
            type: "string",
            description:
              "Two or three sentences for the client report: what the growth is, why it is holding there (shade, ponding water, slow drainage, sheltered aspect), and the recommended treatment.",
          },
          confidence: {
            type: "number",
            description:
              "0-1. How certain you are this is biological growth rather than shadow, rust, or dirt.",
          },
          x: {
            type: "integer",
            description: "Left edge of the box, 0-1000 across the image width.",
          },
          y: {
            type: "integer",
            description: "Top edge of the box, 0-1000 down the image height.",
          },
          width: {
            type: "integer",
            description: "Box width, 0-1000 of the image width.",
          },
          height: {
            type: "integer",
            description: "Box height, 0-1000 of the image height.",
          },
        },
        required: [
          "label",
          "surface",
          "growth_type",
          "severity",
          "note",
          "confidence",
          "x",
          "y",
          "width",
          "height",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "findings"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are surveying photos for a New Zealand exterior cleaning company that soft-washes roofs, cladding, canopies and gutters on commercial and residential buildings. Your job is to mark every patch of biological growth on the building so an estimator can quote the wash and show the client what needs doing.

WHAT TO MARK
Mark only living growth and the staining it leaves on building surfaces:
- mould / mildew — black or dark grey spotting and blotches, often on shaded painted surfaces and soffits.
- algae — flat green or blue-black films and vertical streaking, thrives where water sheets down or sits.
- moss — raised green or brown cushions, holds in sheet pans, gutters, laps and against upstands.
- lichen — crusty grey-green, white or orange discs bonded to the surface, common on roof sheets and cappings.
- organic-staining — the dark tide-marks and run-off trails left where growth has been feeding, e.g. streaks below a capping or around a fixing.

WHERE IT ACTUALLY GROWS — check these before anything else
Growth follows moisture that lingers, so it concentrates in predictable places:
- the pans (valleys) of corrugated and trimdeck sheets, where the flutes hold water — far more than on the ribs.
- box gutters, spouting, sumps and the last metre of roof before them.
- sheet end-laps, side-laps and around fixings, where water wicks and drains slowly.
- parapet cappings and their tops, canopy and verandah roofs, and low-pitch roofs that drain slowly.
- surfaces shaded by a taller wall, plant, sign or overhanging trees — in New Zealand the south-facing aspect stays damp longest.
- under downpipe discharges, air-conditioning condensate, and along the drip line of a wall above.

WHAT IS NOT GROWTH — do not mark these
This is the main way to get the report wrong, so rule each one out deliberately:
- SHADOWS. Photos taken across a corrugated roof in low sun throw long, hard-edged, perfectly straight dark bands across the sheets, and the shaded flank of every corrugation reads dark. Shadow follows the geometry of the object casting it and has a crisp edge; growth is irregular, blotchy, soft-edged, and sits in the pans regardless of the sun angle.
- RUST and corrosion — orange, red-brown or flaking metal, usually starting at fixings, cut edges and laps. That is a roofing repair, not a wash.
- dirt, soot, tyre-rubber marks, sealant, bitumen patching, and black rubber membrane.
- the roof's own colour, weathered galvanised steel, grey concrete, and paint fade or chalking.
- anything that is not the building: asphalt, carparks, vehicles, trees, shrubs, grass, sky, signage graphics.

HOW TO MARK
- Draw one box per contiguous affected area. If growth runs the full length of a gutter or a run of sheet pans, that is ONE box covering the run — do not scatter a dozen tiny boxes over the same patch.
- Return at most 12 findings. If there is more than that, mark the worst areas and say so in the summary.
- Box the growth itself reasonably tightly. Do not box a whole roof plane unless it really is affected end to end.
- severity: light = surface film or scattered spotting, cleans off easily. moderate = established patches, clearly visible from the ground. heavy = dense continuous growth, moss cushions or lichen bonded to the surface, needing treatment and dwell time.
- confidence: be honest. Use 0.5 or below when the photo is low-resolution, distant, or you cannot fully separate growth from shadow or staining. Include the uncertain finding with a low score rather than dropping it — the estimator checks the low-confidence ones on site.
- If the surfaces in the photo are genuinely clean, return an empty findings list and say so in the summary. Never invent findings to fill the report.

NOTES
Write notes for the building owner, not for another AI. Plain New Zealand trade English, no marketing language, no hedging filler. Name the surface, say why the growth is holding there, and give the treatment — typically a soft wash with a sodium hypochlorite blend and a suitable dwell time, gutter clean-out where relevant, and a note if access equipment (EWP, harness, edge protection) looks necessary. Do not quote prices.`;

interface RawFinding {
  label: string;
  surface: string;
  growth_type: string;
  severity: string;
  note: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RawAnalysis {
  summary: string;
  findings: RawFinding[];
}

/** Split "data:image/jpeg;base64,AAAA" into the parts the API needs. */
function parseDataUrl(
  value: unknown
): { mediaType: SupportedMediaType; data: string } | { error: string } {
  if (typeof value !== "string" || value.length === 0) {
    return { error: "No image was sent." };
  }
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/s.exec(value);
  if (!match) {
    return { error: "Image must be a base64 data URL." };
  }
  const [, mediaType, data] = match;
  if (!SUPPORTED_MEDIA_TYPES.includes(mediaType as SupportedMediaType)) {
    return {
      error: `Unsupported image type "${mediaType}". Use JPEG, PNG, WebP or GIF.`,
    };
  }
  if (data.length > MAX_BASE64_LENGTH) {
    return { error: "Image is too large — try a smaller photo." };
  }
  return { mediaType: mediaType as SupportedMediaType, data };
}

function asGrowthType(value: string): GrowthType {
  return (GROWTH_TYPES as string[]).includes(value)
    ? (value as GrowthType)
    : "mould";
}

function asSeverity(value: string): Severity {
  return (SEVERITIES as string[]).includes(value)
    ? (value as Severity)
    : "moderate";
}

/** 0–1000 grid → normalised 0–1 box, clamped to the image. */
function toFinding(raw: RawFinding): Finding {
  return {
    id: createId("ai"),
    box: clampBox({
      x: raw.x / 1000,
      y: raw.y / 1000,
      width: raw.width / 1000,
      height: raw.height / 1000,
    }),
    label: raw.label,
    surface: raw.surface,
    growthType: asGrowthType(raw.growth_type),
    severity: asSeverity(raw.severity),
    note: raw.note,
    confidence: Math.min(Math.max(Number(raw.confidence) || 0, 0), 1),
    source: "ai",
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the server — see the Photo mark-up section of the README.",
      },
      { status: 500 }
    );
  }

  let body: { image?: unknown; context?: unknown };
  try {
    body = (await request.json()) as { image?: unknown; context?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const image = parseDataUrl(body.image);
  if ("error" in image) {
    return NextResponse.json({ error: image.error }, { status: 400 });
  }

  // Optional free-text hint from the estimator ("north elevation", "canopy
  // over the trolley bay") so the notes can name the right part of the site.
  const context =
    typeof body.context === "string" ? body.context.trim().slice(0, 400) : "";

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: RESPONSE_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: image.mediaType,
                data: image.data,
              },
            },
            {
              type: "text",
              text: context
                ? `Mark up this site photo. Context from the estimator: ${context}`
                : "Mark up this site photo.",
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Claude declined to analyse this photo." },
        { status: 422 }
      );
    }

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    let parsed: RawAnalysis;
    try {
      parsed = JSON.parse(text) as RawAnalysis;
    } catch {
      return NextResponse.json(
        { error: "Could not read the analysis — try again." },
        { status: 502 }
      );
    }

    const analysis: PhotoAnalysis = {
      summary: parsed.summary ?? "",
      findings: (parsed.findings ?? []).map(toFinding),
    };

    return NextResponse.json(analysis, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    // Typed SDK errors first, so the UI can say something useful instead of
    // "something went wrong".
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY was rejected — check the key in .env.local." },
        { status: 502 }
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Rate limited by the API — wait a moment and re-analyse." },
        { status: 429 }
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Analysis failed (HTTP ${err.status}): ${err.message}` },
        { status: 502 }
      );
    }
    return NextResponse.json(
      {
        error: `Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 502 }
    );
  }
}
