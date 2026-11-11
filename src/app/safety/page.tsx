import Link from "next/link";
import { listAssets, listFaults, listInspections } from "@/server/safety/repo";
import { requirePerson } from "@/server/safety/session";
import { AssetRow, Card, Empty, Pill, Screen, SectionTitle } from "@/components/safety/ui";
import { fmtDateTime } from "@/lib/safety/format";
import { getLocation } from "@/config/team";

function Tile({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-24 flex-col justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm active:scale-[0.98]"
    >
      <span className="text-lg font-bold text-slate-900">{title}</span>
      <span className="text-sm text-slate-500">{sub}</span>
    </Link>
  );
}

export default async function SafetyHome() {
  const me = await requirePerson();
  const [attention, mine, vehicles, flagged, faults] = await Promise.all([
    listAssets({ status: "attention" }),
    listAssets({}).then((all) => all.filter((a) => a.holderPersonId === me.id)),
    listAssets({ category: "vehicle", locationId: me.locationId }),
    me.role === "crew" ? Promise.resolve([]) : listInspections({ aiFlaggedOnly: true, limit: 5 }),
    listFaults({ openOnly: true }),
  ]);
  const prestartsDue = vehicles.filter((v) => v.status === "in_service" && !v.routineDoneToday).length;

  return (
    <Screen title={`Kia ora, ${me.name}`}>
      <p className="-mt-3 mb-4 text-sm text-slate-500">{getLocation(me.locationId)?.name ?? me.locationId}</p>

      <div className="grid grid-cols-2 gap-3">
        <Tile
          href="/safety/prestart"
          title="Vehicle pre-start"
          sub={
            vehicles.length === 0
              ? "No vehicles added yet"
              : prestartsDue
                ? `${prestartsDue} still to do today`
                : "All done today"
          }
        />
        <Tile href="/safety/assets" title="Check equipment" sub="Find an item and inspect it" />
        <Tile href="/safety/assets/new" title="Add equipment" sub="Photo the label to start" />
        <Tile href="/safety/assets" title="Equipment register" sub="Everything we own" />
      </div>

      {mine.length > 0 && (
        <>
          <SectionTitle>Issued to you</SectionTitle>
          <Card className="!p-0">
            {mine.map((a) => (
              <AssetRow key={a.id} asset={a} />
            ))}
          </Card>
        </>
      )}

      <SectionTitle>Needs attention</SectionTitle>
      {attention.length === 0 ? (
        <Empty>Nothing out of service, overdue or faulty.</Empty>
      ) : (
        <Card className="!p-0">
          {attention.map((a) => (
            <AssetRow key={a.id} asset={a} />
          ))}
        </Card>
      )}

      {faults.length > 0 && (
        <>
          <SectionTitle>Open faults</SectionTitle>
          <Card className="!p-0">
            {faults.slice(0, 10).map((f) => (
              <Link
                key={f.id}
                href={`/safety/a/${f.assetCode}`}
                className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{f.assetName}</div>
                  <div className="text-sm text-slate-600">{f.itemLabel}</div>
                  {f.note && <div className="text-sm text-slate-500">“{f.note}”</div>}
                </div>
                <Pill tone={f.critical ? "bad" : "warn"}>{f.critical ? "Critical" : "Fault"}</Pill>
              </Link>
            ))}
          </Card>
        </>
      )}

      {flagged.length > 0 && (
        <>
          <SectionTitle>Passed despite an AI concern — worth a second look</SectionTitle>
          <Card className="!p-0">
            {flagged.map((i) => (
              <Link
                key={i.id}
                href={`/safety/inspections/${i.id}`}
                className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
              >
                <div>
                  <div className="font-semibold text-slate-900">{i.assetName}</div>
                  <div className="text-sm text-slate-500">
                    {i.personName} · {fmtDateTime(i.createdAt)}
                  </div>
                </div>
                <Pill tone="warn">Review</Pill>
              </Link>
            ))}
          </Card>
        </>
      )}

      {me.role === "manager" && (
        <Link href="/safety/admin" className="mt-8 block text-center text-sm font-medium text-teal-700">
          Admin: people, checklists and QR labels
        </Link>
      )}
    </Screen>
  );
}
