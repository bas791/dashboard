import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAssetByCode,
  getChecklist,
  listAssetEvents,
  listAssetPhotos,
  listAssets,
  listAssetsOnVehicle,
  listFaults,
  listInspections,
  listPeople,
} from "@/server/safety/repo";
import { requirePerson } from "@/server/safety/session";
import { returnToService, resolveFault, retireAsset, takeOutOfService } from "@/app/safety/actions";
import { AssetRow, assetState, btnPrimary, btnQuiet, Card, Field, Pill, Screen, SectionTitle } from "@/components/safety/ui";
import { AssignControl } from "@/components/safety/AssignControl";
import { NoteAction } from "@/components/safety/NoteAction";
import { fmtDate, fmtDateTime } from "@/lib/safety/format";
import { canInspectDetailed, routineLabel } from "@/lib/safety/types";
import { getLocation } from "@/config/team";

export default async function AssetPage({ params }: { params: Promise<{ code: string }> }) {
  const me = await requirePerson();
  const { code } = await params;
  const asset = await getAssetByCode(code);
  if (!asset) notFound();

  const [inspections, faults, events, photos, people, vehicles, detailed, onBoard] = await Promise.all([
    listInspections({ assetId: asset.id, limit: 15 }),
    listFaults({ assetId: asset.id }),
    listAssetEvents(asset.id, 30),
    listAssetPhotos(asset.id, 24),
    listPeople(),
    listAssets({ category: "vehicle" }),
    getChecklist(asset.typeId, "detailed"),
    asset.category === "vehicle" ? listAssetsOnVehicle(asset.id) : Promise.resolve([]),
  ]);
  const state = assetState(asset);
  const senior = canInspectDetailed(me.role);
  const openFaults = faults.filter((f) => f.status === "open");
  const live = asset.status !== "retired";

  return (
    <Screen
      title={asset.name}
      back={{ href: "/safety/assets", label: "Equipment" }}
      action={<Pill tone={state.tone}>{state.text}</Pill>}
    >
      <p className="-mt-3 mb-4 text-sm text-slate-500">
        {asset.code} · {asset.typeName} · {getLocation(asset.locationId)?.name ?? asset.locationId}
      </p>

      {asset.status === "quarantined" && (
        <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 p-4 font-medium text-red-900">
          Do not use. This item is out of service until an inspector or manager returns it.
        </div>
      )}
      {asset.status === "in_service" && asset.detailedOverdue && (
        <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 p-4 font-medium text-red-900">
          Detailed inspection was due {fmtDate(asset.detailedDueOn)}. It can&apos;t be issued until that&apos;s done.
        </div>
      )}

      {live && (
        <div className="grid gap-2">
          <Link href={`/safety/a/${asset.code}/inspect/routine`} className={`${btnPrimary} w-full`}>
            Start {routineLabel(asset.category).toLowerCase()}
          </Link>
          {detailed && senior && (
            <Link href={`/safety/a/${asset.code}/inspect/detailed`} className={`${btnQuiet} w-full`}>
              Record detailed inspection
            </Link>
          )}
        </div>
      )}

      {openFaults.length > 0 && (
        <>
          <SectionTitle>Open faults</SectionTitle>
          <div className="space-y-3">
            {openFaults.map((f) => (
              <Card key={f.id}>
                <div className="mb-1 flex items-start justify-between gap-3">
                  <div className="font-semibold text-slate-900">{f.itemLabel}</div>
                  <Pill tone={f.critical ? "bad" : "warn"}>{f.critical ? "Critical" : "Fault"}</Pill>
                </div>
                {f.note && <p className="text-slate-700">“{f.note}”</p>}
                <p className="mb-3 text-sm text-slate-500">
                  Reported {fmtDateTime(f.createdAt)}
                  {f.inspectionId && (
                    <>
                      {" · "}
                      <Link className="font-medium text-teal-700" href={`/safety/inspections/${f.inspectionId}`}>
                        see check
                      </Link>
                    </>
                  )}
                </p>
                {(!f.critical || senior) && (
                  <NoteAction
                    label="Mark as fixed"
                    prompt="What was done to fix it?"
                    confirmLabel="Fixed"
                    action={resolveFault.bind(null, f.id)}
                  />
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {live && (
        <>
          <SectionTitle>Who has it</SectionTitle>
          <Card>
            <p className="mb-3 font-medium text-slate-900">
              {asset.holderPersonName
                ? `Issued to ${asset.holderPersonName}`
                : asset.holderVehicleName
                  ? `On ${asset.holderVehicleName}`
                  : "In the store"}
            </p>
            {asset.status === "in_service" && (
              <AssignControl
                assetId={asset.id}
                held={Boolean(asset.holderPersonId || asset.holderVehicleId)}
                meId={me.id}
                people={people.map((p) => ({ id: p.id, name: p.name }))}
                vehicles={vehicles
                  .filter((v) => v.id !== asset.id && v.status === "in_service")
                  .map((v) => ({ id: v.id, name: v.name }))}
              />
            )}
          </Card>
        </>
      )}

      {asset.category === "vehicle" && (
        <>
          <SectionTitle>Gear on this vehicle</SectionTitle>
          {onBoard.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing assigned to this vehicle yet.</p>
          ) : (
            <Card className="!p-0">
              {onBoard.map((a) => (
                <AssetRow key={a.id} asset={a} />
              ))}
            </Card>
          )}
        </>
      )}

      <SectionTitle>Details</SectionTitle>
      <Card>
        <dl>
          <Field name="Serial number / rego">
            <span className="font-mono">{asset.serial ?? "—"}</span>
          </Field>
          <Field name="Make">{asset.manufacturer ?? "—"}</Field>
          <Field name="Model">{asset.model ?? "—"}</Field>
          <Field name="Made">{fmtDate(asset.manufacturedOn)}</Field>
          <Field name="First used">{fmtDate(asset.inServiceOn)}</Field>
          <Field name="Retire by">{fmtDate(asset.retireOn)}</Field>
          <Field name={`Last ${routineLabel(asset.category).toLowerCase()}`}>{fmtDateTime(asset.lastRoutineAt)}</Field>
          {asset.detailedDueOn && <Field name="Detailed inspection due">{fmtDate(asset.detailedDueOn)}</Field>}
        </dl>
        {asset.notes && <p className="mt-3 text-sm text-slate-700">{asset.notes}</p>}
        <div className="mt-4 flex gap-4 text-sm font-medium text-teal-700">
          <Link href={`/safety/a/${asset.code}/edit`}>Edit details</Link>
          <Link href={`/safety/admin/labels?code=${asset.code}`}>Print QR label</Link>
        </div>
      </Card>

      {photos.length > 0 && (
        <>
          <SectionTitle>Photos, newest first</SectionTitle>
          <div className="grid grid-cols-4 gap-2">
            {photos.map((p) => (
              <a key={p.id} href={`/api/safety/photos/${p.id}`} target="_blank" rel="noreferrer" title={fmtDateTime(p.createdAt)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/safety/photos/${p.id}`} alt={`Photo from ${fmtDateTime(p.createdAt)}`} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
              </a>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Checks and inspections</SectionTitle>
      {inspections.length === 0 ? (
        <p className="text-sm text-slate-500">No checks recorded yet.</p>
      ) : (
        <Card className="!p-0">
          {inspections.map((i) => (
            <Link key={i.id} href={`/safety/inspections/${i.id}`} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
              <div>
                <div className="font-medium text-slate-900">
                  {i.kind === "detailed" ? "Detailed inspection" : routineLabel(asset.category)}
                </div>
                <div className="text-sm text-slate-500">
                  {i.personName} · {fmtDateTime(i.createdAt)}
                </div>
              </div>
              <Pill tone={i.result === "pass" ? "good" : "bad"}>{i.result === "pass" ? "Passed" : "Failed"}</Pill>
            </Link>
          ))}
        </Card>
      )}

      <SectionTitle>History</SectionTitle>
      <Card>
        <ul className="space-y-2 text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex justify-between gap-3">
              <span className="text-slate-800">{e.detail}</span>
              <span className="shrink-0 text-right text-slate-500">
                {e.personName ? `${e.personName} · ` : ""}
                {fmtDateTime(e.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {live && (
        <div className="mt-8 grid gap-2">
          {asset.status === "in_service" && (
            <NoteAction
              label="Take out of service"
              prompt="Why is it being taken out of service?"
              confirmLabel="Take out of service"
              tone="danger"
              action={takeOutOfService.bind(null, asset.id)}
            />
          )}
          {asset.status === "quarantined" && senior && (
            <NoteAction
              label="Return to service"
              prompt="What was done to make it safe to use again?"
              confirmLabel="Return to service"
              tone="primary"
              action={returnToService.bind(null, asset.id)}
            />
          )}
          {senior && (
            <NoteAction
              label="Retire this item"
              prompt="Why is it being retired? (It stays on record but can't be used.)"
              confirmLabel="Retire"
              action={retireAsset.bind(null, asset.id)}
            />
          )}
        </div>
      )}
    </Screen>
  );
}
