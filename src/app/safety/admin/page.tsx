import Link from "next/link";
import { redirect } from "next/navigation";
import { LOCATIONS } from "@/config/team";
import { checklistSummary, listAssetTypes, listPeople } from "@/server/safety/repo";
import { requirePerson } from "@/server/safety/session";
import { aiAvailable } from "@/server/safety/ai";
import { Card, Pill, Screen, SectionTitle } from "@/components/safety/ui";
import { PeopleAdmin } from "@/components/safety/PeopleAdmin";
import { AddTypeForm } from "@/components/safety/TypeAdmin";

export default async function AdminPage() {
  const me = await requirePerson();
  if (me.role !== "manager") redirect("/safety");
  const [people, types, summary] = await Promise.all([listPeople(true), listAssetTypes(), checklistSummary()]);
  const count = (typeId: string, kind: string) =>
    summary.find((s) => s.typeId === typeId && s.kind === kind)?.count ?? 0;

  return (
    <Screen title="Admin" back={{ href: "/safety", label: "Home" }}>
      <Card>
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-slate-900">AI photo reading (Claude)</span>
          <Pill tone={aiAvailable() ? "good" : "warn"}>{aiAvailable() ? "On" : "Not set up"}</Pill>
        </div>
        {!aiAvailable() && (
          <p className="mt-2 text-sm text-slate-600">
            Photos still save, but serial numbers aren&apos;t read and inspection photos aren&apos;t checked until an
            Anthropic API key is added to the server settings.
          </p>
        )}
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="font-medium text-slate-900">Database</span>
          <Pill tone={process.env.DATABASE_URL ? "good" : "warn"}>
            {process.env.DATABASE_URL ? "Connected" : "Temporary (this server only)"}
          </Pill>
        </div>
      </Card>

      <SectionTitle>People</SectionTitle>
      <Card>
        <PeopleAdmin people={people} locations={LOCATIONS.map((l) => ({ id: l.id, name: l.name }))} />
      </Card>

      <SectionTitle>Equipment types and checklists</SectionTitle>
      <Card className="!p-0">
        {types.map((t) => (
          <div key={t.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
            <div className="font-semibold text-slate-900">{t.name}</div>
            <div className="mb-2 text-sm text-slate-500">
              {t.detailedIntervalDays ? `Detailed inspection every ${t.detailedIntervalDays} days` : "No periodic inspection"}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium text-teal-700">
              <Link href={`/safety/admin/checklists/${t.id}/routine`}>
                {t.category === "vehicle" ? "Pre-start" : "Pre-use"} checklist ({count(t.id, "routine")})
              </Link>
              <Link href={`/safety/admin/checklists/${t.id}/detailed`}>
                Detailed checklist ({count(t.id, "detailed")})
              </Link>
            </div>
          </div>
        ))}
      </Card>
      <Card className="mt-3">
        <AddTypeForm />
      </Card>

      <SectionTitle>QR labels</SectionTitle>
      <Link href="/safety/admin/labels" className="font-medium text-teal-700">
        Print QR labels for all equipment
      </Link>
    </Screen>
  );
}
