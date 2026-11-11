import { notFound } from "next/navigation";
import { getAssetByCode, getChecklist } from "@/server/safety/repo";
import { requirePerson } from "@/server/safety/session";
import { Empty, Screen } from "@/components/safety/ui";
import { InspectionRunner } from "@/components/safety/InspectionRunner";
import { canInspectDetailed, kindLabel } from "@/lib/safety/types";

export default async function InspectPage({ params }: { params: Promise<{ code: string; kind: string }> }) {
  const me = await requirePerson();
  const { code, kind } = await params;
  if (kind !== "routine" && kind !== "detailed") notFound();
  const asset = await getAssetByCode(code);
  if (!asset || asset.status === "retired") notFound();
  const checklist = await getChecklist(asset.typeId, kind);
  const back = { href: `/safety/a/${asset.code}`, label: asset.name };

  if (kind === "detailed" && !canInspectDetailed(me.role)) {
    return (
      <Screen title="Detailed inspection" back={back}>
        <Empty>Detailed inspections are recorded by a competent inspector or a manager.</Empty>
      </Screen>
    );
  }
  if (!checklist?.items.length) {
    return (
      <Screen title={kindLabel(kind, asset.category)} back={back}>
        <Empty>There&apos;s no checklist for {asset.typeName.toLowerCase()} yet. A manager can add one under Admin.</Empty>
      </Screen>
    );
  }
  return (
    <Screen title={kindLabel(kind, asset.category)} back={back}>
      <p className="-mt-3 mb-4 text-sm text-slate-500">
        {asset.name} · {asset.code}
      </p>
      <InspectionRunner
        assetId={asset.id}
        assetCode={asset.code}
        kind={kind}
        items={checklist.items}
        askOdometer={asset.category === "vehicle" && asset.typeName !== "Trailer"}
      />
    </Screen>
  );
}
