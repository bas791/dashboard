"use server";

/**
 * Every change in the safety section goes through one of these server
 * actions. Each one works out who is acting, checks they're allowed, and
 * returns { ok, error } so the phone can show a plain message.
 */
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LOCATIONS } from "@/config/team";
import * as repo from "@/server/safety/repo";
import { currentPerson, PERSON_COOKIE } from "@/server/safety/session";
import {
  canInspectDetailed,
  type CheckResult,
  type ChecklistKind,
  type Person,
} from "@/lib/safety/types";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

const uuid = z.string().uuid();
const locationId = z.string().refine((v) => LOCATIONS.some((l) => l.id === v), "Unknown location");
const role = z.enum(["crew", "inspector", "manager"]);
const optionalText = z
  .string()
  .trim()
  .max(500)
  .transform((v) => v || null)
  .nullable();
const optionalDate = z
  .string()
  .trim()
  .transform((v) => v || null)
  .nullable()
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Dates must be YYYY-MM-DD");

async function actor(): Promise<Person | null> {
  return currentPerson();
}

const NOT_SIGNED_IN = "Choose who you are first.";

// ─── People ──────────────────────────────────────────────────────────────────

export async function choosePerson(id: string): Promise<ActionResult> {
  const person = uuid.safeParse(id).success ? await repo.getPerson(id) : null;
  if (!person?.active) return fail("That person isn't on the list any more.");
  (await cookies()).set(PERSON_COOKIE, person.id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return { ok: true };
}

const personInput = z.object({ name: z.string().trim().min(1).max(80), locationId, role });

export async function addPerson(input: z.input<typeof personInput>): Promise<ActionResult> {
  const parsed = personInput.safeParse(input);
  if (!parsed.success) return fail("Enter a name and choose a location.");
  const me = await actor();
  // The very first person sets the system up, so they become a manager.
  const bootstrap = (await repo.countManagers()) === 0;
  if (!bootstrap && me?.role !== "manager") return fail("Only a manager can add people.");
  const person = await repo.createPerson(
    parsed.data.name,
    parsed.data.locationId,
    bootstrap ? "manager" : parsed.data.role
  );
  if (bootstrap) await choosePerson(person.id);
  revalidatePath("/safety", "layout");
  return { ok: true };
}

export async function updatePerson(
  id: string,
  patch: { role?: string; active?: boolean }
): Promise<ActionResult> {
  const me = await actor();
  if (me?.role !== "manager") return fail("Only a manager can change people.");
  const parsedRole = patch.role === undefined ? undefined : role.safeParse(patch.role);
  if (!uuid.safeParse(id).success || (parsedRole && !parsedRole.success)) return fail("Invalid change.");
  const demoting = (parsedRole?.data && parsedRole.data !== "manager") || patch.active === false;
  if (id === me.id && demoting && (await repo.countManagers()) <= 1) {
    return fail("You're the only manager. Make someone else a manager first.");
  }
  await repo.updatePerson(id, { role: parsedRole?.data, active: patch.active });
  revalidatePath("/safety", "layout");
  return { ok: true };
}

// ─── Assets ──────────────────────────────────────────────────────────────────

const assetInput = z.object({
  name: z.string().trim().min(1, "Give the item a name").max(120),
  typeId: uuid,
  locationId,
  serial: optionalText,
  manufacturer: optionalText,
  model: optionalText,
  manufacturedOn: optionalDate,
  inServiceOn: optionalDate,
  retireOn: optionalDate,
  notes: optionalText,
});
export type AssetFormInput = z.input<typeof assetInput>;

export async function createAsset(
  input: AssetFormInput,
  labelPhotoId: string | null
): Promise<ActionResult<{ code: string }>> {
  const me = await actor();
  if (!me) return fail(NOT_SIGNED_IN);
  const parsed = assetInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");
  if (!(await repo.getAssetType(parsed.data.typeId))) return fail("Choose an equipment type.");
  const photo = labelPhotoId && uuid.safeParse(labelPhotoId).success ? labelPhotoId : null;
  const code = await repo.createAsset(parsed.data, me, photo);
  revalidatePath("/safety", "layout");
  return { ok: true, code };
}

export async function updateAsset(id: string, input: AssetFormInput): Promise<ActionResult<{ code: string }>> {
  const me = await actor();
  if (!me) return fail(NOT_SIGNED_IN);
  const parsed = assetInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");
  const asset = uuid.safeParse(id).success ? await repo.getAsset(id) : null;
  if (!asset) return fail("Item not found.");
  await repo.updateAsset(id, parsed.data, me);
  revalidatePath("/safety", "layout");
  return { ok: true, code: asset.code };
}

/** Assign an item to a person or a truck, or return it (both null). */
export async function assignAsset(
  id: string,
  holder: { personId: string | null; vehicleId: string | null }
): Promise<ActionResult> {
  const me = await actor();
  if (!me) return fail(NOT_SIGNED_IN);
  const asset = uuid.safeParse(id).success ? await repo.getAsset(id) : null;
  if (!asset) return fail("Item not found.");

  if (!holder.personId && !holder.vehicleId) {
    await repo.assignAsset(id, {}, "Returned to store", me);
    revalidatePath("/safety", "layout");
    return { ok: true };
  }
  if (asset.status !== "in_service") {
    return fail("This item is out of service and can't be issued.");
  }
  if (asset.detailedOverdue) {
    return fail("This item's detailed inspection is overdue. It can't be issued until it's inspected.");
  }
  if (holder.personId) {
    const person = await repo.getPerson(holder.personId);
    if (!person?.active) return fail("Person not found.");
    await repo.assignAsset(id, { personId: person.id }, `Issued to ${person.name}`, me);
  } else if (holder.vehicleId) {
    const vehicle = await repo.getAsset(holder.vehicleId);
    if (!vehicle || vehicle.category !== "vehicle" || vehicle.id === asset.id) {
      return fail("Choose a truck or trailer.");
    }
    await repo.assignAsset(id, { vehicleId: vehicle.id }, `Put on ${vehicle.name}`, me);
  }
  revalidatePath("/safety", "layout");
  return { ok: true };
}

export async function takeOutOfService(id: string, note: string): Promise<ActionResult> {
  const me = await actor();
  if (!me) return fail(NOT_SIGNED_IN);
  const asset = uuid.safeParse(id).success ? await repo.getAsset(id) : null;
  if (!asset) return fail("Item not found.");
  if (!note.trim()) return fail("Say why it's being taken out of service.");
  await repo.setAssetStatus(id, "quarantined", note.trim().slice(0, 500), me);
  revalidatePath("/safety", "layout");
  return { ok: true };
}

export async function returnToService(id: string, note: string): Promise<ActionResult> {
  const me = await actor();
  if (!me) return fail(NOT_SIGNED_IN);
  if (!canInspectDetailed(me.role)) {
    return fail("Only a competent inspector or manager can return an item to service.");
  }
  const asset = uuid.safeParse(id).success ? await repo.getAsset(id) : null;
  if (!asset) return fail("Item not found.");
  if (!note.trim()) return fail("Say what was done to make it safe.");
  if ((await repo.countOpenCriticalFaults(id)) > 0) {
    return fail("Mark the open critical faults as fixed first.");
  }
  await repo.setAssetStatus(id, "in_service", note.trim().slice(0, 500), me);
  revalidatePath("/safety", "layout");
  return { ok: true };
}

export async function retireAsset(id: string, note: string): Promise<ActionResult> {
  const me = await actor();
  if (!me) return fail(NOT_SIGNED_IN);
  if (!canInspectDetailed(me.role)) return fail("Only a competent inspector or manager can retire an item.");
  const asset = uuid.safeParse(id).success ? await repo.getAsset(id) : null;
  if (!asset) return fail("Item not found.");
  if (!note.trim()) return fail("Say why it's being retired.");
  await repo.setAssetStatus(id, "retired", note.trim().slice(0, 500), me);
  revalidatePath("/safety", "layout");
  return { ok: true };
}

// ─── Inspections and faults ──────────────────────────────────────────────────

const answer = z.object({
  itemId: z.string().max(40),
  outcome: z.enum(["pass", "fail", "na"]),
  note: z.string().trim().max(1000),
  photoIds: z.array(uuid).max(6),
  aiConcern: z.enum(["none", "possible", "clear"]).nullable(),
  aiNote: z.string().max(1000).nullable(),
});

export async function submitInspection(input: {
  assetId: string;
  kind: ChecklistKind;
  answers: z.input<typeof answer>[];
  notes: string;
  odometer: number | null;
}): Promise<ActionResult<{ id: string; result: "pass" | "fail"; quarantined: boolean }>> {
  const me = await actor();
  if (!me) return fail(NOT_SIGNED_IN);
  if (input.kind !== "routine" && input.kind !== "detailed") return fail("Unknown check.");
  if (input.kind === "detailed" && !canInspectDetailed(me.role)) {
    return fail("Only a competent inspector or manager can record a detailed inspection.");
  }
  const asset = uuid.safeParse(input.assetId).success ? await repo.getAsset(input.assetId) : null;
  if (!asset) return fail("Item not found.");
  if (asset.status === "retired") return fail("This item has been retired.");
  const checklist = await repo.getChecklist(asset.typeId, input.kind);
  if (!checklist?.items.length) return fail("There's no checklist for this type of equipment yet.");

  const answers = z.array(answer).safeParse(input.answers);
  if (!answers.success) return fail("Something in the form didn't save properly. Try again.");
  const byId = new Map(answers.data.map((a) => [a.itemId, a]));

  // The checklist on the server is the source of truth: every item must be
  // answered, and the rules are re-checked here rather than trusted from the phone.
  const results: CheckResult[] = [];
  for (const item of checklist.items) {
    const a = byId.get(item.id);
    if (!a) return fail(`Not answered: "${item.label}"`);
    if (a.outcome === "pass" && item.photo && a.photoIds.length === 0) {
      return fail(`A photo is needed for: "${item.label}"`);
    }
    if (a.outcome === "fail" && !a.note) {
      return fail(`Describe the problem for: "${item.label}"`);
    }
    results.push({
      itemId: item.id,
      label: item.label,
      critical: item.critical,
      outcome: a.outcome,
      note: a.note,
      photoIds: a.photoIds,
      aiConcern: a.aiConcern,
      aiNote: a.aiNote,
    });
  }

  const odometer =
    input.odometer != null && Number.isInteger(input.odometer) && input.odometer >= 0
      ? input.odometer
      : null;
  const out = await repo.recordInspection({
    asset,
    kind: input.kind,
    results,
    notes: input.notes.trim().slice(0, 2000) || null,
    odometer,
    by: me,
  });
  revalidatePath("/safety", "layout");
  return { ok: true, ...out };
}

export async function resolveFault(id: string, note: string): Promise<ActionResult> {
  const me = await actor();
  if (!me) return fail(NOT_SIGNED_IN);
  const fault = uuid.safeParse(id).success ? await repo.getFault(id) : null;
  if (!fault || fault.status !== "open") return fail("Fault not found.");
  if (fault.critical && !canInspectDetailed(me.role)) {
    return fail("Only a competent inspector or manager can sign off a critical fault.");
  }
  if (!note.trim()) return fail("Say what was done to fix it.");
  await repo.resolveFault(fault, note.trim().slice(0, 500), me);
  revalidatePath("/safety", "layout");
  return { ok: true };
}

// ─── Admin: types and checklists ─────────────────────────────────────────────

const checklistItems = z
  .array(
    z.object({
      id: z.string().min(1).max(40),
      label: z.string().trim().min(1).max(200),
      photo: z.boolean(),
      critical: z.boolean(),
    })
  )
  .max(60);

export async function saveChecklist(
  typeId: string,
  kind: ChecklistKind,
  items: z.input<typeof checklistItems>
): Promise<ActionResult> {
  const me = await actor();
  if (me?.role !== "manager") return fail("Only a manager can edit checklists.");
  if (kind !== "routine" && kind !== "detailed") return fail("Unknown checklist.");
  const parsed = checklistItems.safeParse(items);
  if (!parsed.success) return fail("Every check needs some wording.");
  if (new Set(parsed.data.map((i) => i.id)).size !== parsed.data.length) return fail("Duplicate checks.");
  if (!uuid.safeParse(typeId).success || !(await repo.getAssetType(typeId))) return fail("Type not found.");
  await repo.saveChecklist(typeId, kind, parsed.data);
  revalidatePath("/safety", "layout");
  return { ok: true };
}

const typeInput = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.enum(["vehicle", "height", "machine", "access", "other"]),
  detailedIntervalDays: z.number().int().min(1).max(3650).nullable(),
});

export async function addAssetType(input: z.input<typeof typeInput>): Promise<ActionResult<{ id: string }>> {
  const me = await actor();
  if (me?.role !== "manager") return fail("Only a manager can add equipment types.");
  const parsed = typeInput.safeParse(input);
  if (!parsed.success) return fail("Enter a name for the type.");
  const existing = await repo.listAssetTypes();
  if (existing.some((t) => t.name.toLowerCase() === parsed.data.name.toLowerCase())) {
    return fail("There's already a type with that name.");
  }
  const id = await repo.createAssetType(
    parsed.data.name,
    parsed.data.category,
    parsed.data.detailedIntervalDays
  );
  await repo.saveChecklist(id, "routine", [
    { id: "r1", label: "No visible damage", photo: true, critical: true },
    { id: "r2", label: "Works as intended", photo: false, critical: true },
  ]);
  revalidatePath("/safety", "layout");
  return { ok: true, id };
}

export async function setTypeInterval(typeId: string, days: number | null): Promise<ActionResult> {
  const me = await actor();
  if (me?.role !== "manager") return fail("Only a manager can change inspection intervals.");
  if (days != null && (!Number.isInteger(days) || days < 1 || days > 3650)) return fail("Enter a number of days.");
  if (!uuid.safeParse(typeId).success) return fail("Type not found.");
  await repo.updateAssetTypeInterval(typeId, days);
  revalidatePath("/safety", "layout");
  return { ok: true };
}
