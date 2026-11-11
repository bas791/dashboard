/**
 * All reads and writes for the safety section. Pages and server actions call
 * these; nothing else touches SQL.
 */
import { getDb, ts, d, type Queryable } from "./db";
import type {
  Asset,
  AssetEvent,
  AssetStatus,
  AssetType,
  CheckResult,
  Checklist,
  ChecklistItem,
  ChecklistKind,
  Fault,
  Inspection,
  Person,
  Role,
} from "@/lib/safety/types";

const TZ = process.env.DASHBOARD_TIMEZONE ?? "Pacific/Auckland";
const CODE_PREFIX = process.env.ASSET_CODE_PREFIX ?? "EQ";

// ─── People ──────────────────────────────────────────────────────────────────

const PERSON_COLS = `id, name, location_id AS "locationId", role, active`;

export async function listPeople(includeInactive = false): Promise<Person[]> {
  const db = await getDb();
  return db.query<Person>(
    `SELECT ${PERSON_COLS} FROM people ${includeInactive ? "" : "WHERE active"} ORDER BY name`
  );
}

export async function getPerson(id: string): Promise<Person | null> {
  const db = await getDb();
  const rows = await db.query<Person>(`SELECT ${PERSON_COLS} FROM people WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createPerson(name: string, locationId: string, role: Role): Promise<Person> {
  const db = await getDb();
  const [row] = await db.query<Person>(
    `INSERT INTO people (name, location_id, role) VALUES ($1, $2, $3) RETURNING ${PERSON_COLS}`,
    [name, locationId, role]
  );
  return row;
}

export async function updatePerson(
  id: string,
  patch: { role?: Role; active?: boolean; locationId?: string }
): Promise<void> {
  const db = await getDb();
  await db.query(
    `UPDATE people SET role = COALESCE($2, role), active = COALESCE($3, active),
       location_id = COALESCE($4, location_id) WHERE id = $1`,
    [id, patch.role ?? null, patch.active ?? null, patch.locationId ?? null]
  );
}

export async function countManagers(): Promise<number> {
  const db = await getDb();
  const [{ n }] = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM people WHERE active AND role = 'manager'`
  );
  return n;
}

// ─── Types and checklists ────────────────────────────────────────────────────

const TYPE_COLS = `id, name, category, detailed_interval_days AS "detailedIntervalDays"`;

export async function listAssetTypes(): Promise<AssetType[]> {
  const db = await getDb();
  return db.query<AssetType>(`SELECT ${TYPE_COLS} FROM asset_types ORDER BY sort, name`);
}

export async function getAssetType(id: string): Promise<AssetType | null> {
  const db = await getDb();
  const rows = await db.query<AssetType>(`SELECT ${TYPE_COLS} FROM asset_types WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createAssetType(
  name: string,
  category: string,
  detailedIntervalDays: number | null
): Promise<string> {
  const db = await getDb();
  const [{ id }] = await db.query<{ id: string }>(
    `INSERT INTO asset_types (name, category, detailed_interval_days) VALUES ($1, $2, $3) RETURNING id`,
    [name, category, detailedIntervalDays]
  );
  return id;
}

export async function updateAssetTypeInterval(id: string, days: number | null): Promise<void> {
  const db = await getDb();
  await db.query(`UPDATE asset_types SET detailed_interval_days = $2 WHERE id = $1`, [id, days]);
}

export async function getChecklist(typeId: string, kind: ChecklistKind): Promise<Checklist | null> {
  const db = await getDb();
  const rows = await db.query<{ items: ChecklistItem[] }>(
    `SELECT items FROM checklists WHERE asset_type_id = $1 AND kind = $2`,
    [typeId, kind]
  );
  return rows[0] ? { typeId, kind, items: rows[0].items } : null;
}

export async function saveChecklist(
  typeId: string,
  kind: ChecklistKind,
  items: ChecklistItem[]
): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO checklists (asset_type_id, kind, items) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (asset_type_id, kind) DO UPDATE SET items = EXCLUDED.items, updated_at = now()`,
    [typeId, kind, JSON.stringify(items)]
  );
}

export async function checklistSummary(): Promise<
  { typeId: string; kind: ChecklistKind; count: number }[]
> {
  const db = await getDb();
  return db.query(
    `SELECT asset_type_id AS "typeId", kind, jsonb_array_length(items)::int AS count FROM checklists`
  );
}

// ─── Assets ──────────────────────────────────────────────────────────────────

const TODAY = `(now() AT TIME ZONE '${TZ}')::date`;

/** One row per asset with everything the UI needs to show its state. */
const ASSET_SELECT = `
  SELECT a.id, a.code, a.name, a.type_id AS "typeId", t.name AS "typeName", t.category,
    a.location_id AS "locationId", a.serial, a.manufacturer, a.model,
    ${d("a.manufactured_on")} AS "manufacturedOn",
    ${d("a.in_service_on")} AS "inServiceOn",
    ${d("a.retire_on")} AS "retireOn",
    a.status, a.holder_person_id AS "holderPersonId", p.name AS "holderPersonName",
    a.holder_vehicle_id AS "holderVehicleId", v.name AS "holderVehicleName",
    a.notes, ${ts("a.created_at")} AS "createdAt",
    ${d("x.due_on")} AS "detailedDueOn",
    COALESCE(x.due_on < ${TODAY}, false) AS "detailedOverdue",
    ${ts("x.last_routine")} AS "lastRoutineAt",
    COALESCE((x.last_routine AT TIME ZONE '${TZ}')::date = ${TODAY}, false) AS "routineDoneToday",
    x.open_faults AS "openFaults",
    x.label_photo AS "labelPhotoId"
  FROM assets a
  JOIN asset_types t ON t.id = a.type_id
  LEFT JOIN people p ON p.id = a.holder_person_id
  LEFT JOIN assets v ON v.id = a.holder_vehicle_id
  CROSS JOIN LATERAL (
    SELECT
      CASE WHEN t.detailed_interval_days IS NULL THEN NULL ELSE
        COALESCE(
          (SELECT max(i.created_at AT TIME ZONE '${TZ}')::date FROM inspections i
            WHERE i.asset_id = a.id AND i.kind = 'detailed'),
          a.in_service_on,
          (a.created_at AT TIME ZONE '${TZ}')::date
        ) + t.detailed_interval_days
      END AS due_on,
      (SELECT max(i.created_at) FROM inspections i
        WHERE i.asset_id = a.id AND i.kind = 'routine') AS last_routine,
      (SELECT count(*)::int FROM faults f WHERE f.asset_id = a.id AND f.status = 'open') AS open_faults,
      (SELECT ph.id FROM photos ph WHERE ph.asset_id = a.id AND ph.kind = 'label'
        ORDER BY ph.created_at DESC LIMIT 1) AS label_photo
  ) x
`;

export interface AssetFilter {
  search?: string;
  category?: string;
  locationId?: string;
  status?: AssetStatus | "attention";
}

export async function listAssets(filter: AssetFilter = {}): Promise<Asset[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.search) {
    params.push(`%${filter.search.toLowerCase()}%`);
    const n = params.length;
    where.push(
      `(lower(a.name) LIKE $${n} OR lower(a.code) LIKE $${n} OR lower(COALESCE(a.serial,'')) LIKE $${n})`
    );
  }
  if (filter.category) {
    params.push(filter.category);
    where.push(`t.category = $${params.length}`);
  }
  if (filter.locationId) {
    params.push(filter.locationId);
    where.push(`a.location_id = $${params.length}`);
  }
  if (filter.status === "attention") {
    where.push(
      `a.status <> 'retired' AND (a.status = 'quarantined' OR x.open_faults > 0 OR x.due_on < ${TODAY})`
    );
  } else if (filter.status) {
    params.push(filter.status);
    where.push(`a.status = $${params.length}`);
  } else {
    where.push(`a.status <> 'retired'`);
  }
  return db.query<Asset>(
    `${ASSET_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY a.name, a.code`,
    params
  );
}

export async function getAssetByCode(code: string): Promise<Asset | null> {
  const db = await getDb();
  const rows = await db.query<Asset>(`${ASSET_SELECT} WHERE a.code = $1`, [code.toUpperCase()]);
  return rows[0] ?? null;
}

export async function getAsset(id: string): Promise<Asset | null> {
  const db = await getDb();
  const rows = await db.query<Asset>(`${ASSET_SELECT} WHERE a.id = $1`, [id]);
  return rows[0] ?? null;
}

/** Gear currently assigned to a truck. */
export async function listAssetsOnVehicle(vehicleId: string): Promise<Asset[]> {
  const db = await getDb();
  return db.query<Asset>(`${ASSET_SELECT} WHERE a.holder_vehicle_id = $1 ORDER BY a.name`, [
    vehicleId,
  ]);
}

export interface AssetInput {
  name: string;
  typeId: string;
  locationId: string;
  serial: string | null;
  manufacturer: string | null;
  model: string | null;
  manufacturedOn: string | null;
  inServiceOn: string | null;
  retireOn: string | null;
  notes: string | null;
}

async function logEvent(
  q: Queryable,
  assetId: string,
  kind: string,
  detail: string,
  personName: string | null
) {
  await q.query(
    `INSERT INTO asset_events (asset_id, kind, detail, person_name) VALUES ($1, $2, $3, $4)`,
    [assetId, kind, detail, personName]
  );
}

export async function createAsset(
  input: AssetInput,
  by: Person,
  labelPhotoId: string | null
): Promise<string> {
  const db = await getDb();
  return db.tx(async (q) => {
    const [{ n }] = await q.query<{ n: string }>(`SELECT nextval('asset_code_seq') AS n`);
    const code = `${CODE_PREFIX}-${String(n).padStart(4, "0")}`;
    const [{ id }] = await q.query<{ id: string }>(
      `INSERT INTO assets (code, name, type_id, location_id, serial, manufacturer, model,
         manufactured_on, in_service_on, retire_on, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9::date,$10::date,$11) RETURNING id`,
      [
        code,
        input.name,
        input.typeId,
        input.locationId,
        input.serial,
        input.manufacturer,
        input.model,
        input.manufacturedOn,
        input.inServiceOn,
        input.retireOn,
        input.notes,
      ]
    );
    if (labelPhotoId) {
      await q.query(`UPDATE photos SET asset_id = $1 WHERE id = $2 AND asset_id IS NULL`, [
        id,
        labelPhotoId,
      ]);
    }
    await logEvent(q, id, "created", "Added to the register", by.name);
    return code;
  });
}

export async function updateAsset(id: string, input: AssetInput, by: Person): Promise<void> {
  const db = await getDb();
  await db.tx(async (q) => {
    await q.query(
      `UPDATE assets SET name=$2, type_id=$3, location_id=$4, serial=$5, manufacturer=$6, model=$7,
         manufactured_on=$8::date, in_service_on=$9::date, retire_on=$10::date, notes=$11
       WHERE id=$1`,
      [
        id,
        input.name,
        input.typeId,
        input.locationId,
        input.serial,
        input.manufacturer,
        input.model,
        input.manufacturedOn,
        input.inServiceOn,
        input.retireOn,
        input.notes,
      ]
    );
    await logEvent(q, id, "edited", "Details edited", by.name);
  });
}

export async function setAssetStatus(
  id: string,
  status: AssetStatus,
  note: string,
  by: Person
): Promise<void> {
  const db = await getDb();
  const label =
    status === "in_service"
      ? "Returned to service"
      : status === "quarantined"
        ? "Taken out of service"
        : "Retired";
  await db.tx(async (q) => {
    await q.query(`UPDATE assets SET status = $2 WHERE id = $1`, [id, status]);
    if (status !== "in_service") {
      await q.query(
        `UPDATE assets SET holder_person_id = NULL, holder_vehicle_id = NULL WHERE id = $1`,
        [id]
      );
    }
    await logEvent(q, id, status, note ? `${label}: ${note}` : label, by.name);
  });
}

export async function assignAsset(
  id: string,
  holder: { personId?: string | null; vehicleId?: string | null },
  detail: string,
  by: Person
): Promise<void> {
  const db = await getDb();
  await db.tx(async (q) => {
    await q.query(`UPDATE assets SET holder_person_id = $2, holder_vehicle_id = $3 WHERE id = $1`, [
      id,
      holder.personId ?? null,
      holder.vehicleId ?? null,
    ]);
    await logEvent(q, id, "assigned", detail, by.name);
  });
}

export async function listAssetEvents(assetId: string, limit = 50): Promise<AssetEvent[]> {
  const db = await getDb();
  return db.query<AssetEvent>(
    `SELECT id, kind, detail, person_name AS "personName", ${ts("created_at")} AS "createdAt"
     FROM asset_events WHERE asset_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [assetId, limit]
  );
}

// ─── Photos ──────────────────────────────────────────────────────────────────

export async function savePhoto(input: {
  assetId: string | null;
  kind: string;
  mime: string;
  data: Buffer;
  ai: unknown;
  createdBy: string | null;
}): Promise<string> {
  const db = await getDb();
  const [{ id }] = await db.query<{ id: string }>(
    `INSERT INTO photos (asset_id, kind, mime, data, ai, created_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING id`,
    [
      input.assetId,
      input.kind,
      input.mime,
      input.data,
      input.ai == null ? null : JSON.stringify(input.ai),
      input.createdBy,
    ]
  );
  return id;
}

export async function getPhoto(id: string): Promise<{ mime: string; data: Buffer } | null> {
  const db = await getDb();
  const rows = await db.query<{ mime: string; data: Uint8Array }>(
    `SELECT mime, data FROM photos WHERE id = $1`,
    [id]
  );
  return rows[0] ? { mime: rows[0].mime, data: Buffer.from(rows[0].data) } : null;
}

export interface PhotoMeta {
  id: string;
  kind: string;
  inspectionId: string | null;
  createdAt: string;
}

export async function listAssetPhotos(assetId: string, limit = 60): Promise<PhotoMeta[]> {
  const db = await getDb();
  return db.query<PhotoMeta>(
    `SELECT id, kind, inspection_id AS "inspectionId", ${ts("created_at")} AS "createdAt"
     FROM photos WHERE asset_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [assetId, limit]
  );
}

// ─── Inspections and faults ──────────────────────────────────────────────────

const INSPECTION_SELECT = `
  SELECT i.id, i.asset_id AS "assetId", a.code AS "assetCode", a.name AS "assetName", i.kind,
    i.person_name AS "personName", i.result, i.results, i.notes, i.odometer,
    i.ai_flagged AS "aiFlagged", ${ts("i.created_at")} AS "createdAt"
  FROM inspections i JOIN assets a ON a.id = i.asset_id
`;

export async function getInspection(id: string): Promise<Inspection | null> {
  const db = await getDb();
  const rows = await db.query<Inspection>(`${INSPECTION_SELECT} WHERE i.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listInspections(opts: {
  assetId?: string;
  aiFlaggedOnly?: boolean;
  limit?: number;
}): Promise<Inspection[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.assetId) {
    params.push(opts.assetId);
    where.push(`i.asset_id = $${params.length}`);
  }
  if (opts.aiFlaggedOnly) where.push(`i.ai_flagged`);
  params.push(opts.limit ?? 30);
  return db.query<Inspection>(
    `${INSPECTION_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY i.created_at DESC LIMIT $${params.length}`,
    params
  );
}

/**
 * Records an inspection. Any failed check raises a fault; a failed critical
 * check also takes the asset out of service. Returns the inspection id.
 */
export async function recordInspection(input: {
  asset: Asset;
  kind: ChecklistKind;
  results: CheckResult[];
  notes: string | null;
  odometer: number | null;
  by: Person;
}): Promise<{ id: string; result: "pass" | "fail"; quarantined: boolean }> {
  const db = await getDb();
  const failed = input.results.filter((r) => r.outcome === "fail");
  const result = failed.length ? "fail" : "pass";
  const quarantined = failed.some((r) => r.critical);
  const aiFlagged = input.results.some(
    (r) => r.outcome === "pass" && r.aiConcern != null && r.aiConcern !== "none"
  );
  const kindText = input.kind === "detailed" ? "Detailed inspection" : "Routine check";

  return db.tx(async (q) => {
    const [{ id }] = await q.query<{ id: string }>(
      `INSERT INTO inspections (asset_id, kind, person_id, person_name, result, results, notes,
         odometer, ai_flagged)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9) RETURNING id`,
      [
        input.asset.id,
        input.kind,
        input.by.id,
        input.by.name,
        result,
        JSON.stringify(input.results),
        input.notes,
        input.odometer,
        aiFlagged,
      ]
    );
    for (const r of input.results) {
      for (const photoId of r.photoIds) {
        await q.query(
          `UPDATE photos SET inspection_id = $1, asset_id = $2
           WHERE id = $3 AND inspection_id IS NULL`,
          [id, input.asset.id, photoId]
        );
      }
    }
    for (const r of failed) {
      await q.query(
        `INSERT INTO faults (asset_id, inspection_id, item_label, note, critical)
         VALUES ($1,$2,$3,$4,$5)`,
        [input.asset.id, id, r.label, r.note, r.critical]
      );
    }
    await logEvent(
      q,
      input.asset.id,
      "inspection",
      `${kindText}: ${result === "pass" ? "passed" : `failed (${failed.length} fault${failed.length === 1 ? "" : "s"})`}`,
      input.by.name
    );
    if (quarantined && input.asset.status === "in_service") {
      await q.query(
        `UPDATE assets SET status = 'quarantined', holder_person_id = NULL, holder_vehicle_id = NULL
         WHERE id = $1`,
        [input.asset.id]
      );
      await logEvent(
        q,
        input.asset.id,
        "quarantined",
        "Taken out of service automatically: failed a critical check",
        input.by.name
      );
    }
    return { id, result, quarantined } as const;
  });
}

const FAULT_SELECT = `
  SELECT f.id, f.asset_id AS "assetId", a.code AS "assetCode", a.name AS "assetName",
    f.inspection_id AS "inspectionId", f.item_label AS "itemLabel", f.note, f.critical, f.status,
    ${ts("f.created_at")} AS "createdAt", f.resolved_by_name AS "resolvedByName",
    f.resolved_note AS "resolvedNote", ${ts("f.resolved_at")} AS "resolvedAt"
  FROM faults f JOIN assets a ON a.id = f.asset_id
`;

export async function listFaults(opts: { assetId?: string; openOnly?: boolean }): Promise<Fault[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.assetId) {
    params.push(opts.assetId);
    where.push(`f.asset_id = $${params.length}`);
  }
  if (opts.openOnly) where.push(`f.status = 'open'`);
  return db.query<Fault>(
    `${FAULT_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY (f.status = 'open') DESC, f.critical DESC, f.created_at DESC LIMIT 100`,
    params
  );
}

export async function getFault(id: string): Promise<Fault | null> {
  const db = await getDb();
  const rows = await db.query<Fault>(`${FAULT_SELECT} WHERE f.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function resolveFault(fault: Fault, note: string, by: Person): Promise<void> {
  const db = await getDb();
  await db.tx(async (q) => {
    await q.query(
      `UPDATE faults SET status = 'resolved', resolved_by_name = $2, resolved_note = $3,
         resolved_at = now() WHERE id = $1 AND status = 'open'`,
      [fault.id, by.name, note]
    );
    await logEvent(q, fault.assetId, "fault_resolved", `Fault fixed (${fault.itemLabel}): ${note}`, by.name);
  });
}

export async function countOpenCriticalFaults(assetId: string): Promise<number> {
  const db = await getDb();
  const [{ n }] = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM faults WHERE asset_id = $1 AND status = 'open' AND critical`,
    [assetId]
  );
  return n;
}
