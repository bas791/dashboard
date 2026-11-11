"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitInspection } from "@/app/safety/actions";
import { PhotoCapture } from "./PhotoCapture";
import { btnPrimary, input, label, Pill } from "./ui";
import type { CheckOutcome, ChecklistItem, ChecklistKind, PhotoAssessment } from "@/lib/safety/types";

interface Photo {
  id: string;
  ai: PhotoAssessment | null;
}
interface Answer {
  outcome: CheckOutcome | null;
  note: string;
  photos: Photo[];
}

const RANK = { none: 0, possible: 1, clear: 2 } as const;

/** Worst thing Claude said about any of this check's usable photos. */
function worst(photos: Photo[]): PhotoAssessment | null {
  return photos.reduce<PhotoAssessment | null>(
    (acc, p) => (p.ai && (!acc || RANK[p.ai.concern] > RANK[acc.concern]) ? p.ai : acc),
    null
  );
}

const OUTCOMES: { id: CheckOutcome; text: string; on: string }[] = [
  { id: "pass", text: "OK", on: "border-emerald-600 bg-emerald-600 text-white" },
  { id: "fail", text: "Problem", on: "border-red-600 bg-red-600 text-white" },
  { id: "na", text: "N/A", on: "border-slate-500 bg-slate-500 text-white" },
];

export function InspectionRunner({
  assetId,
  assetCode,
  kind,
  items,
  askOdometer,
}: {
  assetId: string;
  assetCode: string;
  kind: ChecklistKind;
  items: ChecklistItem[];
  askOdometer: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [odometer, setOdometer] = useState("");
  const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
    Object.fromEntries(items.map((i) => [i.id, { outcome: null, note: "", photos: [] }]))
  );
  const patch = (id: string, p: Partial<Answer>) =>
    setAnswers((old) => ({ ...old, [id]: { ...old[id], ...p } }));

  const problems = (item: ChecklistItem): string | null => {
    const a = answers[item.id];
    if (!a.outcome) return "Not answered yet";
    if (a.outcome === "pass" && item.photo && a.photos.length === 0) return "Photo needed";
    if (a.outcome === "fail" && !a.note.trim()) return "Describe the problem";
    return null;
  };
  const remaining = items.filter((i) => problems(i)).length;
  const failed = items.filter((i) => answers[i.id].outcome === "fail");
  const willQuarantine = failed.some((i) => i.critical);

  return (
    <div className="space-y-3">
      {items.map((item, n) => {
        const a = answers[item.id];
        const ai = worst(a.photos);
        const issue = problems(item);
        return (
          <section key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                {n + 1}
              </span>
              <p className="text-base font-semibold leading-snug text-slate-900">{item.label}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {OUTCOMES.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={a.outcome === o.id}
                  onClick={() => patch(item.id, { outcome: o.id })}
                  className={`min-h-12 rounded-xl border text-base font-semibold active:scale-[0.98] ${
                    a.outcome === o.id ? o.on : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {o.text}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <PhotoCapture<PhotoAssessment>
                kind="check"
                assetId={assetId}
                check={item.label}
                buttonLabel={a.photos.length ? "Add another photo" : item.photo ? "Take photo (required)" : "Add photo"}
                onUploaded={(p) => patch(item.id, { photos: [...answers[item.id].photos, { id: p.id, ai: p.ai }] })}
              />
              {a.photos.map((p) => (
                <span key={p.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/safety/photos/${p.id}`} alt="Check photo" className="h-12 w-12 rounded-lg object-cover" />
                  <button
                    type="button"
                    aria-label="Remove photo"
                    onClick={() => patch(item.id, { photos: a.photos.filter((x) => x.id !== p.id) })}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            {a.photos.some((p) => p.ai && !p.ai.usable) && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                <strong>Photo unclear.</strong> {a.photos.find((p) => p.ai && !p.ai.usable)?.ai?.note} Retake it if you can.
              </p>
            )}
            {ai && ai.concern !== "none" && (
              <p className={`mt-3 rounded-xl p-3 text-sm ${ai.concern === "clear" ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-900"}`}>
                <strong>{ai.concern === "clear" ? "AI spotted a problem." : "AI suggests a closer look."}</strong> {ai.note}{" "}
                You decide — check it by hand.
              </p>
            )}

            {(a.outcome === "fail" || a.note) && (
              <div className="mt-3">
                <label className={label}>{a.outcome === "fail" ? "What's wrong?" : "Note"}</label>
                <textarea className={`${input} py-2`} rows={2} value={a.note} onChange={(e) => patch(item.id, { note: e.target.value })} />
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-2 text-sm">
              <span className={issue ? "font-medium text-amber-700" : "text-emerald-700"}>{issue ?? "Done"}</span>
              {item.critical && a.outcome === "fail" && <Pill tone="bad">Takes item out of service</Pill>}
            </div>
          </section>
        );
      })}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {askOdometer && (
          <div className="mb-3">
            <label className={label}>Odometer (km), optional</label>
            <input className={input} inputMode="numeric" value={odometer} onChange={(e) => setOdometer(e.target.value.replace(/\D/g, ""))} />
          </div>
        )}
        <label className={label}>Anything else to report?</label>
        <textarea className={`${input} py-2`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </section>

      {willQuarantine && (
        <p className="rounded-2xl border border-red-300 bg-red-50 p-4 font-medium text-red-900">
          Saving this will take the item out of service. Don&apos;t use it, and tag it so no one else does.
        </p>
      )}
      {error && <p className="text-sm font-medium text-red-700">{error}</p>}

      <button
        type="button"
        className={`${btnPrimary} w-full`}
        disabled={pending || remaining > 0}
        onClick={() =>
          start(async () => {
            const res = await submitInspection({
              assetId,
              kind,
              notes,
              odometer: odometer ? Number(odometer) : null,
              answers: items.map((i) => {
                const a = answers[i.id];
                const ai = worst(a.photos);
                return {
                  itemId: i.id,
                  outcome: a.outcome ?? "na",
                  note: a.note,
                  photoIds: a.photos.map((p) => p.id),
                  aiConcern: ai?.concern ?? null,
                  aiNote: ai?.note ?? null,
                };
              }),
            });
            if (!res.ok) return setError(res.error);
            router.push(`/safety/inspections/${res.id}?done=1`);
            router.refresh();
          })
        }
      >
        {pending
          ? "Saving…"
          : remaining > 0
            ? `${remaining} check${remaining === 1 ? "" : "s"} still to finish`
            : failed.length
              ? "Sign and save (with faults)"
              : "Sign and save"}
      </button>
      <p className="text-center text-sm text-slate-500">
        Saved under your name. A check can&apos;t be changed afterwards. Item {assetCode}.
      </p>
    </div>
  );
}
