"use client";

import { useState } from "react";
import { MarkupCanvas } from "@/components/markup/MarkupCanvas";
import { FindingList } from "@/components/markup/FindingList";
import {
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  worstSeverity,
  type Finding,
  type MarkupBox,
  type MarkupPhoto,
} from "@/lib/markup";

/**
 * One page of the report: the marked-up photo on the left, its findings on the
 * right. Prints as a single block — see the @media print rules in globals.css.
 */

interface PhotoSheetProps {
  photo: MarkupPhoto;
  index: number;
  shape: "ellipse" | "box";
  onChange: (id: string, patch: Partial<MarkupPhoto>) => void;
  onFindingChange: (photoId: string, findingId: string, patch: Partial<Finding>) => void;
  onFindingDelete: (photoId: string, findingId: string) => void;
  onFindingAdd: (photoId: string, box: MarkupBox) => void;
  onReanalyse: (id: string) => void;
  onRemove: (id: string) => void;
}

const STATUS_TEXT: Record<MarkupPhoto["status"], string> = {
  queued: "Waiting to analyse…",
  analysing: "Looking for growth…",
  done: "",
  error: "",
};

export function PhotoSheet({
  photo,
  index,
  shape,
  onChange,
  onFindingChange,
  onFindingDelete,
  onFindingAdd,
  onReanalyse,
  onRemove,
}: PhotoSheetProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const busy = photo.status === "queued" || photo.status === "analysing";
  const worst = worstSeverity(photo.findings);

  const handleDraw = (box: MarkupBox) => {
    onFindingAdd(photo.id, box);
    setDrawing(false);
  };

  return (
    <section className="markup-sheet rounded-xl border border-zinc-200 bg-white p-5 shadow-sm print:border-zinc-300 print:shadow-none">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-zinc-900 px-2 py-0.5 text-xs font-semibold text-white">
              Photo {index + 1}
            </span>
            {worst && (
              <span
                className="rounded px-2 py-0.5 text-xs font-semibold text-white"
                style={{ backgroundColor: SEVERITY_COLORS[worst] }}
              >
                {SEVERITY_LABELS[worst]} growth
              </span>
            )}
            {photo.status === "done" && photo.findings.length === 0 && (
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                Surfaces clean
              </span>
            )}
          </div>
          <input
            value={photo.caption}
            onChange={(e) => onChange(photo.id, { caption: e.target.value })}
            placeholder="Where on site was this taken? (e.g. Canopy over trolley bay, north elevation)"
            aria-label={`Photo ${index + 1} location`}
            className={`mt-2 w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-base font-medium text-zinc-800 outline-none transition placeholder:font-normal placeholder:text-zinc-400 hover:border-zinc-300 focus:border-sky-500 print:hover:border-transparent ${
              photo.caption ? "" : "print:hidden"
            }`}
          />
          <p className="px-1.5 text-xs text-zinc-400 print:hidden">
            {photo.fileName}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => setDrawing((value) => !value)}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
              drawing
                ? "border-sky-500 bg-sky-50 text-sky-700"
                : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {drawing ? "Drag on the photo…" : "Add region"}
          </button>
          <button
            type="button"
            onClick={() => onReanalyse(photo.id)}
            disabled={busy}
            className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
          >
            {busy ? "Analysing…" : "Re-analyse"}
          </button>
          <button
            type="button"
            onClick={() => onRemove(photo.id)}
            aria-label={`Remove photo ${index + 1}`}
            className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
          >
            Remove
          </button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="relative">
          <MarkupCanvas
            src={photo.dataUrl}
            width={photo.width}
            height={photo.height}
            alt={photo.caption || photo.fileName}
            findings={photo.findings}
            shape={shape}
            activeId={activeId}
            onActiveChange={setActiveId}
            drawing={drawing}
            onDraw={handleDraw}
          />

          {busy && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-zinc-900/45 print:hidden">
              <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                {STATUS_TEXT[photo.status]}
              </span>
            </div>
          )}
        </div>

        <div>
          {photo.status === "error" && (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {photo.error}
            </p>
          )}

          <textarea
            value={photo.summary}
            onChange={(e) => onChange(photo.id, { summary: e.target.value })}
            placeholder="Overall condition of the surfaces in this photo…"
            aria-label={`Photo ${index + 1} summary`}
            rows={3}
            className={`mb-3 w-full resize-y rounded border border-transparent bg-zinc-50 px-2 py-1.5 text-sm leading-relaxed text-zinc-700 outline-none transition hover:border-zinc-300 focus:border-sky-500 focus:bg-white print:px-0 ${
              photo.summary ? "" : "print:hidden"
            }`}
          />

          <FindingList
            findings={photo.findings}
            activeId={activeId}
            onActiveChange={setActiveId}
            onChange={(findingId, patch) =>
              onFindingChange(photo.id, findingId, patch)
            }
            onDelete={(findingId) => onFindingDelete(photo.id, findingId)}
          />
        </div>
      </div>
    </section>
  );
}
