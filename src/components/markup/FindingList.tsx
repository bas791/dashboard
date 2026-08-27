"use client";

import {
  GROWTH_LABELS,
  GROWTH_TYPES,
  SEVERITIES,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  type Finding,
  type GrowthType,
  type Severity,
} from "@/lib/markup";

/**
 * The notes column beside a photo. Everything Claude writes is editable —
 * the estimator has been on site and gets the last word before this goes to
 * a client, so each field is a plain input rather than static text.
 */

interface FindingListProps {
  findings: Finding[];
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  onChange: (id: string, patch: Partial<Finding>) => void;
  onDelete: (id: string) => void;
}

/** Borderless until you touch it, so the page still reads as a document. */
const FIELD =
  "w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-zinc-800 outline-none transition hover:border-zinc-300 focus:border-sky-500 focus:bg-white print:hover:border-transparent";

export function FindingList({
  findings,
  activeId,
  onActiveChange,
  onChange,
  onDelete,
}: FindingListProps) {
  if (findings.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
        No growth marked on this photo.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {findings.map((finding, index) => {
        const color = SEVERITY_COLORS[finding.severity];
        const active = finding.id === activeId;
        return (
          <li
            key={finding.id}
            onMouseEnter={() => onActiveChange(finding.id)}
            onMouseLeave={() => onActiveChange(null)}
            className={`rounded-lg border bg-white p-3 transition ${
              active
                ? "border-sky-400 shadow-sm ring-1 ring-sky-200"
                : "border-zinc-200"
            } print:border-zinc-300 print:shadow-none print:ring-0`}
          >
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <input
                  value={finding.label}
                  onChange={(e) => onChange(finding.id, { label: e.target.value })}
                  placeholder="Short heading"
                  aria-label={`Finding ${index + 1} heading`}
                  className={`${FIELD} text-sm font-semibold`}
                />
                <input
                  value={finding.surface}
                  onChange={(e) =>
                    onChange(finding.id, { surface: e.target.value })
                  }
                  placeholder="Surface, e.g. Box gutter"
                  aria-label={`Finding ${index + 1} surface`}
                  className={`${FIELD} text-xs text-zinc-500`}
                />
              </div>

              <button
                type="button"
                onClick={() => onDelete(finding.id)}
                aria-label={`Remove finding ${index + 1}`}
                className="rounded px-1.5 py-0.5 text-xs text-zinc-400 transition hover:bg-red-50 hover:text-red-600 print:hidden"
              >
                Remove
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 pl-9">
              <select
                value={finding.growthType}
                onChange={(e) =>
                  onChange(finding.id, {
                    growthType: e.target.value as GrowthType,
                  })
                }
                aria-label={`Finding ${index + 1} growth type`}
                className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-xs text-zinc-700 print:border-none print:bg-transparent print:px-0 print:appearance-none"
              >
                {GROWTH_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {GROWTH_LABELS[type]}
                  </option>
                ))}
              </select>

              <select
                value={finding.severity}
                onChange={(e) =>
                  onChange(finding.id, { severity: e.target.value as Severity })
                }
                aria-label={`Finding ${index + 1} severity`}
                className="rounded border px-1.5 py-0.5 text-xs font-semibold print:border-none print:bg-transparent print:px-0 print:appearance-none"
                style={{ borderColor: color, color }}
              >
                {SEVERITIES.map((severity) => (
                  <option key={severity} value={severity}>
                    {SEVERITY_LABELS[severity]}
                  </option>
                ))}
              </select>

              {finding.source === "ai" ? (
                <span
                  className={`text-[11px] ${
                    finding.confidence < 0.5
                      ? "font-semibold text-amber-600"
                      : "text-zinc-400"
                  }`}
                  title={
                    finding.confidence < 0.5
                      ? "Low confidence — drawn dashed. Worth checking on site."
                      : undefined
                  }
                >
                  AI · {Math.round(finding.confidence * 100)}% confident
                  {finding.confidence < 0.5 ? " · verify on site" : ""}
                </span>
              ) : (
                <span className="text-[11px] text-zinc-400">Added by hand</span>
              )}
            </div>

            <textarea
              value={finding.note}
              onChange={(e) => onChange(finding.id, { note: e.target.value })}
              placeholder="Notes for the client…"
              aria-label={`Finding ${index + 1} notes`}
              rows={3}
              className={`${FIELD} mt-1 ml-9 w-[calc(100%-2.25rem)] resize-y text-sm leading-relaxed`}
            />
          </li>
        );
      })}
    </ol>
  );
}
