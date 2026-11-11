import { notFound, redirect } from "next/navigation";
import { getAssetType, getChecklist } from "@/server/safety/repo";
import { requirePerson } from "@/server/safety/session";
import { Screen } from "@/components/safety/ui";
import { ChecklistEditor } from "@/components/safety/ChecklistEditor";
import { kindLabel } from "@/lib/safety/types";

export default async function ChecklistPage({ params }: { params: Promise<{ typeId: string; kind: string }> }) {
  const me = await requirePerson();
  if (me.role !== "manager") redirect("/safety");
  const { typeId, kind } = await params;
  if (kind !== "routine" && kind !== "detailed") notFound();
  const type = /^[0-9a-f-]{36}$/i.test(typeId) ? await getAssetType(typeId) : null;
  if (!type) notFound();
  const checklist = await getChecklist(type.id, kind);
  return (
    <Screen title={`${type.name}: ${kindLabel(kind, type.category).toLowerCase()}`} back={{ href: "/safety/admin", label: "Admin" }}>
      <ChecklistEditor typeId={type.id} kind={kind} initial={checklist?.items ?? []} />
    </Screen>
  );
}
