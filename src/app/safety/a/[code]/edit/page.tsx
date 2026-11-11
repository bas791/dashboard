import { notFound } from "next/navigation";
import { LOCATIONS } from "@/config/team";
import { getAssetByCode, listAssetTypes } from "@/server/safety/repo";
import { requirePerson } from "@/server/safety/session";
import { Screen } from "@/components/safety/ui";
import { AssetForm } from "@/components/safety/AssetForm";

export default async function EditAssetPage({ params }: { params: Promise<{ code: string }> }) {
  const me = await requirePerson();
  const { code } = await params;
  const [asset, types] = await Promise.all([getAssetByCode(code), listAssetTypes()]);
  if (!asset) notFound();
  return (
    <Screen title="Edit details" back={{ href: `/safety/a/${asset.code}`, label: asset.name }}>
      <AssetForm
        types={types}
        locations={LOCATIONS.map((l) => ({ id: l.id, name: l.name }))}
        defaultLocationId={me.locationId}
        existing={{
          id: asset.id,
          values: {
            name: asset.name,
            typeId: asset.typeId,
            locationId: asset.locationId,
            serial: asset.serial ?? "",
            manufacturer: asset.manufacturer ?? "",
            model: asset.model ?? "",
            manufacturedOn: asset.manufacturedOn ?? "",
            inServiceOn: asset.inServiceOn ?? "",
            retireOn: asset.retireOn ?? "",
            notes: asset.notes ?? "",
          },
        }}
      />
    </Screen>
  );
}
