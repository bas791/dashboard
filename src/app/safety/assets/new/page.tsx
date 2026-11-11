import { LOCATIONS } from "@/config/team";
import { listAssetTypes } from "@/server/safety/repo";
import { requirePerson } from "@/server/safety/session";
import { Screen } from "@/components/safety/ui";
import { AssetForm } from "@/components/safety/AssetForm";

export default async function NewAssetPage() {
  const me = await requirePerson();
  const types = await listAssetTypes();
  return (
    <Screen title="Add equipment" back={{ href: "/safety/assets", label: "Equipment" }}>
      <AssetForm
        types={types}
        locations={LOCATIONS.map((l) => ({ id: l.id, name: l.name }))}
        defaultLocationId={me.locationId}
      />
    </Screen>
  );
}
