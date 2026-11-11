import Link from "next/link";
import { notFound } from "next/navigation";
import { getAsset, getInspection } from "@/server/safety/repo";
import { requirePerson } from "@/server/safety/session";
import { btnPrimary, Card, Pill, Screen } from "@/components/safety/ui";
import { fmtDateTime } from "@/lib/safety/format";
import { kindLabel } from "@/lib/safety/types";

const OUTCOME = {
  pass: { tone: "good", text: "OK" },
  fail: { tone: "bad", text: "Problem" },
  na: { tone: "muted", text: "N/A" },
} as const;

export default async function InspectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  await requirePerson();
  const { id } = await params;
  const { done } = await searchParams;
  const inspection = /^[0-9a-f-]{36}$/i.test(id) ? await getInspection(id) : null;
  if (!inspection) notFound();
  const asset = await getAsset(inspection.assetId);
  if (!asset) notFound();
  const criticalFail = inspection.results.some((r) => r.outcome === "fail" && r.critical);

  return (
    <Screen
      title={kindLabel(inspection.kind, asset.category)}
      back={{ href: `/safety/a/${asset.code}`, label: asset.name }}
      action={<Pill tone={inspection.result === "pass" ? "good" : "bad"}>{inspection.result === "pass" ? "Passed" : "Failed"}</Pill>}
    >
      <p className="-mt-3 mb-4 text-sm text-slate-500">
        {asset.name} · {asset.code} · by {inspection.personName} · {fmtDateTime(inspection.createdAt)}
        {inspection.odometer != null ? ` · ${inspection.odometer.toLocaleString("en-NZ")} km` : ""}
      </p>

      {done && (
        <div
          className={`mb-4 rounded-2xl border p-4 font-medium ${
            criticalFail
              ? "border-red-300 bg-red-50 text-red-900"
              : inspection.result === "fail"
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-emerald-300 bg-emerald-50 text-emerald-900"
          }`}
        >
          {criticalFail
            ? "Saved. This item is now out of service — don't use it, and tag it so no one else does."
            : inspection.result === "fail"
              ? "Saved. The faults have been reported and stay open until someone fixes them."
              : "Saved. All checks OK."}
          <Link href="/safety" className={`${btnPrimary} mt-3 w-full`}>
            Back to home
          </Link>
        </div>
      )}

      {inspection.aiFlagged && (
        <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          One or more checks were marked OK even though AI flagged a concern in the photo. Worth a second look.
        </div>
      )}

      <div className="space-y-3">
        {inspection.results.map((r, n) => (
          <Card key={r.itemId}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-slate-900">
                {n + 1}. {r.label}
              </p>
              <Pill tone={OUTCOME[r.outcome].tone}>{OUTCOME[r.outcome].text}</Pill>
            </div>
            {r.note && <p className="mt-2 text-slate-700">“{r.note}”</p>}
            {r.aiConcern && r.aiConcern !== "none" && (
              <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                <strong>AI {r.aiConcern === "clear" ? "spotted a problem" : "suggested a closer look"}:</strong> {r.aiNote}
              </p>
            )}
            {r.photoIds.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {r.photoIds.map((pid) => (
                  <a key={pid} href={`/api/safety/photos/${pid}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/safety/photos/${pid}`} alt={`Photo for: ${r.label}`} loading="lazy" className="h-24 w-24 rounded-lg object-cover" />
                  </a>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {inspection.notes && (
        <Card className="mt-3">
          <p className="text-sm font-medium text-slate-500">Other notes</p>
          <p className="text-slate-800">{inspection.notes}</p>
        </Card>
      )}
    </Screen>
  );
}
