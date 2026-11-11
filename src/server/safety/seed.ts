/**
 * Starter equipment types and checklists, inserted once into an empty
 * database. These are DRAFTS to get going — review each one against the
 * manufacturer's instructions and how your crews actually work, then edit
 * them in the app (Safety → Admin → Checklists). Editing here later has no
 * effect on a database that already has types.
 */
import type { Db } from "./db";
import type { AssetCategory, ChecklistItem } from "@/lib/safety/types";

/** [label, photo required, critical (fail = out of service)] */
type Line = [string, boolean, boolean];

interface SeedType {
  name: string;
  category: AssetCategory;
  detailedIntervalDays: number | null;
  routine: Line[];
  detailed?: Line[];
}

const SEED: SeedType[] = [
  {
    name: "Truck / van",
    category: "vehicle",
    detailedIntervalDays: null,
    routine: [
      ["Walk-around: no new body damage or leaks under vehicle", true, false],
      ["Tyres: tread, pressure and no visible damage (incl. spare)", true, true],
      ["Lights, indicators and brake lights working", false, true],
      ["Windscreen, wipers and mirrors clean and undamaged", false, false],
      ["Brakes and handbrake feel normal", false, true],
      ["Seatbelts latch and retract", false, true],
      ["Oil, coolant and washer fluid levels OK", false, false],
      ["No warning lights on the dash", true, false],
      ["WoF/CoF and registration current", false, true],
      ["Load, tanks and equipment secured", true, true],
      ["Chemicals stored upright, sealed and labelled", true, true],
      ["First aid kit, fire extinguisher and spill kit on board", false, false],
    ],
  },
  {
    name: "Trailer",
    category: "vehicle",
    detailedIntervalDays: null,
    routine: [
      ["Coupling locked and safety chain attached", true, true],
      ["Tyres: tread, pressure and no visible damage", true, true],
      ["Lights and indicators working when connected", false, true],
      ["WoF and registration current", false, true],
      ["Load secured and within rating", true, true],
      ["Jockey wheel raised and secured", false, false],
    ],
  },
  {
    name: "Water blaster / pressure washer",
    category: "machine",
    detailedIntervalDays: 365,
    routine: [
      ["High-pressure hose: no cuts, bulges or exposed braid", true, true],
      ["Hose couplings and fittings tight, O-rings present", true, true],
      ["Gun and trigger lock work, trigger releases cleanly", false, true],
      ["Lance and nozzle undamaged and correct for the job", false, false],
      ["Engine oil and fuel levels OK, no leaks", false, false],
      ["Guards and covers in place", false, true],
      ["Unloader / pressure relief operating", false, true],
    ],
    detailed: [
      ["Pump: no leaks, oil clean and at level", true, true],
      ["Engine serviced to schedule (hours noted in comments)", false, false],
      ["All hoses inspected full length and pressure rated for the machine", true, true],
      ["Unloader valve and pressure gauge tested", false, true],
      ["Frame, wheels and mounts sound", true, false],
      ["Electrical lead and plug undamaged, tag current (electric units)", true, true],
    ],
  },
  {
    name: "Hose & lance set",
    category: "machine",
    detailedIntervalDays: null,
    routine: [
      ["Hose: no cuts, bulges, kinks or exposed braid", true, true],
      ["Couplings undamaged and seat fully", true, true],
      ["Lance straight, no cracks, nozzle clear", false, true],
    ],
  },
  {
    name: "Ladder",
    category: "access",
    detailedIntervalDays: 182,
    routine: [
      ["Stiles straight: no bends, cracks or dents", true, true],
      ["Rungs secure, clean and undamaged", true, true],
      ["Feet present, grip intact", true, true],
      ["Locks, ropes and pulleys work (extension ladders)", false, true],
      ["Load rating label legible, industrial rated", false, false],
    ],
    detailed: [
      ["Every rung and joint checked for cracks and looseness", true, true],
      ["Stiles checked full length for twist, corrosion or heat damage", true, true],
      ["Feet, end caps and hardware complete", true, true],
      ["Rating and identification labels legible", true, false],
    ],
  },
  {
    name: "Harness",
    category: "height",
    detailedIntervalDays: 182,
    routine: [
      ["Webbing: no cuts, fraying, burns or stiff/discoloured patches", true, true],
      ["Stitching intact at every join", true, true],
      ["Buckles and D-rings: no cracks, distortion or corrosion", true, true],
      ["Fall indicator not deployed", true, true],
      ["Label legible and within service life", false, true],
      ["No known chemical contact since last check", false, true],
    ],
    detailed: [
      ["Full-length webbing inspection, both sides, by hand and eye", true, true],
      ["All load-bearing stitching inspected", true, true],
      ["All metal fittings inspected and function-tested", true, true],
      ["Fall indicators intact", true, true],
      ["Serial number and manufacture date match the register", true, true],
      ["Within manufacturer's service life", false, true],
    ],
  },
  {
    name: "Rope",
    category: "height",
    detailedIntervalDays: 182,
    routine: [
      ["Sheath: no cuts, glazing, melting or heavy fuzzing", true, true],
      ["Core: no soft, flat, stiff or lumpy spots when run through hands", false, true],
      ["Terminations and stitching intact", true, true],
      ["No discolouration or stiffness from chemical contact", true, true],
      ["No shock load or fall taken since last check", false, true],
      ["Identification tag present and legible", false, false],
    ],
    detailed: [
      ["Full length run through hands: no core damage found", false, true],
      ["Full length visual: sheath condition acceptable", true, true],
      ["Terminations, splices and stitching inspected", true, true],
      ["No evidence of chemical, heat or UV degradation", true, true],
      ["Usage log reviewed (falls, chemical exposure, abrasion)", false, true],
      ["Within manufacturer's service life", false, true],
    ],
  },
  {
    name: "Connector / descender / rope hardware",
    category: "height",
    detailedIntervalDays: 182,
    routine: [
      ["No cracks, deep grooves, sharp edges or corrosion", true, true],
      ["Gate / cam opens, closes and locks fully", false, true],
      ["No distortion; markings legible", false, true],
    ],
    detailed: [
      ["Body inspected under good light for cracks and wear grooves", true, true],
      ["Moving parts function-tested and clean", false, true],
      ["Wear within manufacturer's limits", true, true],
      ["Serial number matches the register", true, true],
    ],
  },
  {
    name: "Other equipment",
    category: "other",
    detailedIntervalDays: null,
    routine: [
      ["No visible damage", true, true],
      ["Works as intended", false, true],
      ["Guards, labels and safety features in place", false, false],
    ],
  },
];

function toItems(lines: Line[], prefix: string): ChecklistItem[] {
  return lines.map(([label, photo, critical], i) => ({
    id: `${prefix}${i + 1}`,
    label,
    photo,
    critical,
  }));
}

export async function seedDefaults(db: Db): Promise<void> {
  const [{ n }] = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM asset_types");
  if (n > 0) return;
  await db.tx(async (q) => {
    for (const [i, t] of SEED.entries()) {
      const [{ id }] = await q.query<{ id: string }>(
        `INSERT INTO asset_types (name, category, detailed_interval_days, sort)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [t.name, t.category, t.detailedIntervalDays, i]
      );
      await q.query(
        `INSERT INTO checklists (asset_type_id, kind, items) VALUES ($1, 'routine', $2::jsonb)`,
        [id, JSON.stringify(toItems(t.routine, "r"))]
      );
      if (t.detailed) {
        await q.query(
          `INSERT INTO checklists (asset_type_id, kind, items) VALUES ($1, 'detailed', $2::jsonb)`,
          [id, JSON.stringify(toItems(t.detailed, "d"))]
        );
      }
    }
  });
}
