/**
 * Claude-powered helpers for the safety section.
 *
 *  - readLabel:   pulls serial number, maker, model and dates off a label photo
 *  - assessPhoto: looks at an inspection photo and flags visible problems
 *
 * Rule: Claude may flag a concern, but it never passes equipment. A person
 * always makes and signs the decision. Without ANTHROPIC_API_KEY everything
 * here returns null and the app falls back to manual entry.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { LabelReading, PhotoAssessment } from "@/lib/safety/types";

const MODEL = process.env.SAFETY_AI_MODEL ?? "claude-opus-5-5";

type ImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 });
  return client;
}

const LabelSchema = z.object({
  serial: z.string().nullable(),
  manufacturer: z.string().nullable(),
  model: z.string().nullable(),
  manufactured_on: z.string().nullable(),
  suggested_name: z.string().nullable(),
  notes: z.string().nullable(),
});

const AssessmentSchema = z.object({
  usable: z.boolean(),
  concern: z.enum(["none", "possible", "clear"]),
  note: z.string(),
});

async function ask<T extends z.ZodType>(
  schema: T,
  system: string,
  image: { data: Buffer; mime: string },
  text: string
): Promise<z.infer<T> | null> {
  if (!aiAvailable()) return null;
  try {
    const response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system,
      output_config: { effort: "low", format: zodOutputFormat(schema) },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: image.mime as ImageMime,
                data: image.data.toString("base64"),
              },
            },
            { type: "text", text },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") return null;
    return response.parsed_output ?? null;
  } catch (err) {
    // AI is an assist, never a gate: log and let the person carry on manually.
    if (err instanceof Anthropic.APIError) {
      console.warn(`[safety/ai] Claude API error ${err.status}: ${err.message}`);
    } else {
      console.warn("[safety/ai] request failed", err);
    }
    return null;
  }
}

export async function readLabel(image: { data: Buffer; mime: string }): Promise<LabelReading | null> {
  const out = await ask(
    LabelSchema,
    `You read identification labels on work equipment (ropes, harnesses, connectors, pressure washers, ladders, vehicles) for an asset register.
Copy markings exactly as printed. Never guess or complete a character you cannot read: if any part of a field is unreadable, return null for that field and say what was unclear in notes. A wrong serial number in a safety register is worse than a blank one.
- serial: the serial / individual number only, without prefixes such as "S/N" or "No."
- manufactured_on: as YYYY-MM-DD. If only month and year are shown use day 01; if only a year, use YYYY-01-01. Null if not shown.
- suggested_name: a short plain name for the item, e.g. "Petzl Avao harness" or "11mm static rope 50m".
- notes: anything a person should double-check (ambiguous characters such as 0/O or 1/I, glare, wear), or other useful markings such as a standard or rated load. Null if nothing.`,
    image,
    "Read this equipment label."
  );
  if (!out) return null;
  return {
    serial: out.serial,
    manufacturer: out.manufacturer,
    model: out.model,
    manufacturedOn:
      out.manufactured_on && /^\d{4}-\d{2}-\d{2}$/.test(out.manufactured_on)
        ? out.manufactured_on
        : null,
    suggestedName: out.suggested_name,
    notes: out.notes,
  };
}

export async function assessPhoto(
  image: { data: Buffer; mime: string },
  context: { assetType: string; assetName: string; check: string }
): Promise<PhotoAssessment | null> {
  return ask(
    AssessmentSchema,
    `You help a field worker with an equipment safety check by looking at the photo they took for one item on a checklist.
You are a second pair of eyes, not the inspector: you can raise a concern, but you cannot clear equipment as safe. A photo cannot show internal damage, so never say or imply the item is safe to use.
- usable: false if the photo is too dark, blurry, far away or does not show the part the check is about. Then use note to say what to retake.
- concern: "clear" for visible damage that plainly matters for this check (cuts, exposed core or braid, cracks, melted or glazed fibres, bent or missing parts, deployed fall indicators, bald tyres, leaks). "possible" for something that deserves a closer look by hand. "none" if nothing of concern is visible.
- note: one or two short plain sentences for someone standing next to the equipment. Say what you see and where. If concern is "none", say only that nothing of concern is visible in this photo.`,
    image,
    `Equipment: ${context.assetName} (${context.assetType}).\nChecklist item: ${context.check}`
  );
}
