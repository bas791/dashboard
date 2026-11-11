import { NextResponse } from "next/server";
import { currentPerson } from "@/server/safety/session";
import { getAsset, savePhoto } from "@/server/safety/repo";
import { aiAvailable, assessPhoto, readLabel } from "@/server/safety/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Upload one photo. `kind` decides what Claude does with it:
 *   label → read serial number etc.   check → look for visible problems
 * Responds with { id, ai } where ai is null when AI is off or failed.
 */
export async function POST(request: Request) {
  const person = await currentPerson();
  if (!person) return NextResponse.json({ error: "Choose who you are first." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "general");
  const assetId = String(form.get("assetId") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ error: "No photo sent." }, { status: 400 });
  if (!MIMES.has(file.type)) {
    return NextResponse.json({ error: "Photo must be a JPEG, PNG or WebP." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Photo is too large." }, { status: 413 });
  }
  if (!["label", "check", "general"].includes(kind)) {
    return NextResponse.json({ error: "Unknown photo kind." }, { status: 400 });
  }

  const asset = UUID.test(assetId) ? await getAsset(assetId) : null;
  const data = Buffer.from(await file.arrayBuffer());
  const image = { data, mime: file.type };

  let ai: unknown = null;
  if (kind === "label") {
    ai = await readLabel(image);
  } else if (kind === "check" && asset) {
    ai = await assessPhoto(image, {
      assetType: asset.typeName,
      assetName: asset.name,
      check: String(form.get("check") ?? "General condition").slice(0, 300),
    });
  }

  const id = await savePhoto({
    // Check photos are attached to the asset when the inspection is saved.
    assetId: kind === "check" ? null : (asset?.id ?? null),
    kind,
    mime: file.type,
    data,
    ai,
    createdBy: person.id,
  });
  return NextResponse.json({ id, ai, aiAvailable: aiAvailable() });
}
