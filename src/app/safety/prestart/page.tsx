import { listAssets } from "@/server/safety/repo";
import { requirePerson } from "@/server/safety/session";
import { AssetRow, Card, Empty, Pill, Screen, SectionTitle } from "@/components/safety/ui";
import { fmtDateTime } from "@/lib/safety/format";
import { getLocation } from "@/config/team";
import type { Asset } from "@/lib/safety/types";

function Rows({ vehicles }: { vehicles: Asset[] }) {
  return (
    <Card className="!p-0">
      {vehicles.map((v) => (
        <AssetRow
          key={v.id}
          asset={v}
          href={v.status === "in_service" ? `/safety/a/${v.code}/inspect/routine` : `/safety/a/${v.code}`}
          extra={
            v.status !== "in_service" ? null : v.routineDoneToday ? (
              <span className="text-xs text-slate-500">Done {fmtDateTime(v.lastRoutineAt)}</span>
            ) : (
              <Pill tone="warn">Pre-start due</Pill>
            )
          }
        />
      ))}
    </Card>
  );
}

export default async function PrestartPage() {
  const me = await requirePerson();
  const all = await listAssets({ category: "vehicle" });
  const here = all.filter((v) => v.locationId === me.locationId);
  const elsewhere = all.filter((v) => v.locationId !== me.locationId);

  return (
    <Screen title="Vehicle pre-start" back={{ href: "/safety", label: "Home" }}>
      <p className="-mt-2 mb-4 text-slate-600">Pick the vehicle you&apos;re taking out today.</p>
      {all.length === 0 && (
        <Empty>No vehicles in the register yet. Add your trucks and trailers under “Add equipment”.</Empty>
      )}
      {here.length > 0 && (
        <>
          <SectionTitle>{getLocation(me.locationId)?.name ?? "Your branch"}</SectionTitle>
          <Rows vehicles={here} />
        </>
      )}
      {elsewhere.length > 0 && (
        <>
          <SectionTitle>Other branches</SectionTitle>
          <Rows vehicles={elsewhere} />
        </>
      )}
    </Screen>
  );
}
