"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PhotoSheet } from "@/components/markup/PhotoSheet";
import { isImageFile, preparePhoto } from "@/lib/image";
import {
  createId,
  GROWTH_LABELS,
  SEVERITIES,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  type Finding,
  type MarkupBox,
  type MarkupPhoto,
  type PhotoAnalysis,
  type Severity,
} from "@/lib/markup";

/**
 * Photo mark-up document.
 *
 * Drop site photos in, Claude circles the mould / lichen / moss and writes the
 * notes, then the estimator edits anything that needs editing and prints the
 * page to PDF for the client. Everything lives in browser memory — photos are
 * only ever sent to the analysis endpoint, never stored on the server.
 */

/** Two at a time: fast enough to feel live, gentle on the API rate limit. */
const MAX_CONCURRENT_ANALYSES = 2;

interface DocumentDetails {
  site: string;
  address: string;
  preparedBy: string;
  date: string;
  scope: string;
}

export function MarkupWorkspace() {
  const [photos, setPhotos] = useState<MarkupPhoto[]>([]);
  const [shape, setShape] = useState<"ellipse" | "box">("ellipse");
  const [dragging, setDragging] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [details, setDetails] = useState<DocumentDetails>({
    site: "",
    address: "",
    preparedBy: "",
    date: "",
    scope: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(0);
  /** Mirrors `photos` so the async queue always reads current data. */
  const photosRef = useRef<MarkupPhoto[]>([]);
  photosRef.current = photos;

  // Filled in on the client so server and client markup match on first paint.
  useEffect(() => {
    setDetails((current) =>
      current.date
        ? current
        : { ...current, date: new Date().toISOString().slice(0, 10) }
    );
  }, []);

  const patchPhoto = useCallback((id: string, patch: Partial<MarkupPhoto>) => {
    setPhotos((current) =>
      current.map((photo) => (photo.id === id ? { ...photo, ...patch } : photo))
    );
  }, []);

  /** Send one photo for analysis. Status is already "analysing" when called. */
  const analyse = useCallback(
    async (id: string) => {
      const photo = photosRef.current.find((item) => item.id === id);
      if (!photo) {
        inFlightRef.current -= 1;
        return;
      }

      try {
        const response = await fetch("/api/markup/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: photo.dataUrl,
            context: photo.caption,
          }),
        });

        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            payload &&
            typeof payload === "object" &&
            typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error: string }).error
              : `Analysis failed (HTTP ${response.status}).`;
          patchPhoto(id, { status: "error", error: message });
          return;
        }

        const analysis = payload as PhotoAnalysis;
        patchPhoto(id, {
          status: "done",
          error: null,
          summary: analysis.summary ?? "",
          // Hand-drawn regions survive a re-analysis; AI ones are replaced.
          findings: [
            ...analysis.findings,
            ...(photosRef.current
              .find((item) => item.id === id)
              ?.findings.filter((finding) => finding.source === "manual") ?? []),
          ],
        });
      } catch (err) {
        patchPhoto(id, {
          status: "error",
          error:
            err instanceof Error
              ? `Could not reach the analysis endpoint: ${err.message}`
              : "Could not reach the analysis endpoint.",
        });
      } finally {
        inFlightRef.current -= 1;
      }
    },
    [patchPhoto]
  );

  // Queue pump: whenever the list changes, start any queued photos that fit
  // under the concurrency cap. Marking a photo "analysing" re-runs this
  // effect, which then picks up the next one as slots free.
  useEffect(() => {
    const queued = photos.filter((photo) => photo.status === "queued");
    if (queued.length === 0) return;

    const slots = MAX_CONCURRENT_ANALYSES - inFlightRef.current;
    for (const photo of queued.slice(0, Math.max(slots, 0))) {
      inFlightRef.current += 1;
      patchPhoto(photo.id, { status: "analysing", error: null });
      void analyse(photo.id);
    }
  }, [photos, analyse, patchPhoto]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const images = Array.from(files).filter(isImageFile);
    if (images.length === 0) {
      setLoadError("Those files are not images.");
      return;
    }
    setLoadError(null);

    for (const file of images) {
      try {
        const prepared = await preparePhoto(file);
        setPhotos((current) => [
          ...current,
          {
            id: createId("photo"),
            fileName: file.name || "photo.jpg",
            dataUrl: prepared.dataUrl,
            width: prepared.width,
            height: prepared.height,
            status: "queued",
            error: null,
            summary: "",
            caption: "",
            findings: [],
          },
        ]);
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : `Could not read ${file.name}.`
        );
      }
    }
  }, []);

  // Paste straight from a screenshot or a photo app.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length > 0) void addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 0) void addFiles(event.dataTransfer.files);
  };

  const handleFindingChange = useCallback(
    (photoId: string, findingId: string, patch: Partial<Finding>) => {
      setPhotos((current) =>
        current.map((photo) =>
          photo.id === photoId
            ? {
                ...photo,
                findings: photo.findings.map((finding) =>
                  finding.id === findingId ? { ...finding, ...patch } : finding
                ),
              }
            : photo
        )
      );
    },
    []
  );

  const handleFindingDelete = useCallback((photoId: string, findingId: string) => {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === photoId
          ? {
              ...photo,
              findings: photo.findings.filter(
                (finding) => finding.id !== findingId
              ),
            }
          : photo
      )
    );
  }, []);

  const handleFindingAdd = useCallback((photoId: string, box: MarkupBox) => {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === photoId
          ? {
              ...photo,
              findings: [
                ...photo.findings,
                {
                  id: createId("manual"),
                  box,
                  label: "Area of concern",
                  surface: "",
                  growthType: "mould",
                  severity: "moderate",
                  note: "",
                  confidence: 1,
                  source: "manual",
                },
              ],
            }
          : photo
      )
    );
  }, []);

  const handleRemove = useCallback((id: string) => {
    setPhotos((current) => current.filter((photo) => photo.id !== id));
  }, []);

  const handleReanalyse = useCallback(
    (id: string) => patchPhoto(id, { status: "queued", error: null }),
    [patchPhoto]
  );

  /** Plain-text version for pasting into a quote or an email. */
  const buildReportText = (): string => {
    const lines: string[] = ["MOULD & GROWTH REPORT", ""];
    if (details.site) lines.push(`Site: ${details.site}`);
    if (details.address) lines.push(`Address: ${details.address}`);
    if (details.date) lines.push(`Date: ${details.date}`);
    if (details.preparedBy) lines.push(`Prepared by: ${details.preparedBy}`);
    if (details.scope) lines.push("", details.scope);

    photos.forEach((photo, index) => {
      lines.push("", `PHOTO ${index + 1}${photo.caption ? ` — ${photo.caption}` : ""}`);
      if (photo.summary) lines.push(photo.summary);
      photo.findings.forEach((finding, findingIndex) => {
        lines.push(
          `  ${findingIndex + 1}. [${SEVERITY_LABELS[finding.severity]} ${GROWTH_LABELS[
            finding.growthType
          ].toLowerCase()}] ${finding.label}${
            finding.surface ? ` — ${finding.surface}` : ""
          }`
        );
        if (finding.note) lines.push(`     ${finding.note}`);
      });
      if (photo.findings.length === 0 && photo.status === "done") {
        lines.push("  No growth identified.");
      }
    });

    return lines.join("\n");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildReportText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setLoadError("Could not copy to the clipboard.");
    }
  };

  const allFindings = photos.flatMap((photo) => photo.findings);
  const severityCounts = SEVERITIES.map((severity) => ({
    severity,
    count: allFindings.filter((finding) => finding.severity === severity).length,
  })).filter((entry) => entry.count > 0);
  const busyCount = photos.filter(
    (photo) => photo.status === "queued" || photo.status === "analysing"
  ).length;

  const detailField = (
    key: keyof DocumentDetails,
    label: string,
    placeholder: string,
    type = "text"
  ) => (
    <label className={`block ${details[key] ? "" : "print:hidden"}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <input
        type={type}
        value={details[key]}
        onChange={(e) => setDetails({ ...details, [key]: e.target.value })}
        placeholder={placeholder}
        className="mt-0.5 w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-zinc-800 outline-none transition hover:border-zinc-300 focus:border-sky-500 focus:bg-white print:hover:border-transparent"
      />
    </label>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="markup-doc rounded-2xl bg-white p-6 text-zinc-800 shadow-xl print:rounded-none print:p-0 print:shadow-none">
        <header className="border-b border-zinc-200 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                Mould &amp; growth photo report
              </h1>
              <p className="mt-1 text-sm text-zinc-500 print:hidden">
                Drop site photos below. Claude outlines the mould, lichen and
                moss, and writes the notes — edit anything before you send it.
              </p>
            </div>

            <div className="flex items-center gap-2 print:hidden">
              <div className="flex overflow-hidden rounded-md border border-zinc-300 text-xs">
                <button
                  type="button"
                  onClick={() => setShape("ellipse")}
                  className={`px-2.5 py-1.5 font-medium transition ${
                    shape === "ellipse"
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  Circles
                </button>
                <button
                  type="button"
                  onClick={() => setShape("box")}
                  className={`px-2.5 py-1.5 font-medium transition ${
                    shape === "box"
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  Boxes
                </button>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                disabled={photos.length === 0}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                {copied ? "Copied" : "Copy notes"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={photos.length === 0}
                className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
              >
                Print / Save PDF
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {detailField("site", "Site", "Pak'nSave Silverdale")}
            {detailField("address", "Address", "123 Hibiscus Coast Hwy")}
            {detailField("preparedBy", "Prepared by", "Your name")}
            {detailField("date", "Date", "", "date")}
          </div>

          <textarea
            value={details.scope}
            onChange={(e) => setDetails({ ...details, scope: e.target.value })}
            placeholder="Scope / covering note for the client…"
            aria-label="Scope note"
            rows={2}
            className={`mt-2 w-full resize-y rounded border border-transparent bg-zinc-50 px-2 py-1.5 text-sm text-zinc-700 outline-none transition hover:border-zinc-300 focus:border-sky-500 focus:bg-white print:px-0 ${
              details.scope ? "" : "print:hidden"
            }`}
          />

          {(allFindings.length > 0 || busyCount > 0) && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-zinc-600">
                {allFindings.length} finding{allFindings.length === 1 ? "" : "s"}{" "}
                across {photos.length} photo{photos.length === 1 ? "" : "s"}
              </span>
              {severityCounts.map(({ severity, count }) => (
                <span
                  key={severity}
                  className="rounded-full px-2 py-0.5 font-semibold text-white"
                  style={{ backgroundColor: SEVERITY_COLORS[severity as Severity] }}
                >
                  {count} {SEVERITY_LABELS[severity as Severity].toLowerCase()}
                </span>
              ))}
              {busyCount > 0 && (
                <span className="text-zinc-400 print:hidden">
                  {busyCount} still analysing…
                </span>
              )}
            </div>
          )}
        </header>

        <div className="mt-6 space-y-6">
          {photos.map((photo, index) => (
            <PhotoSheet
              key={photo.id}
              photo={photo}
              index={index}
              shape={shape}
              onChange={patchPhoto}
              onFindingChange={handleFindingChange}
              onFindingDelete={handleFindingDelete}
              onFindingAdd={handleFindingAdd}
              onReanalyse={handleReanalyse}
              onRemove={handleRemove}
            />
          ))}
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`mt-6 cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition print:hidden ${
            dragging
              ? "border-sky-500 bg-sky-50"
              : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100"
          }`}
        >
          <p className="text-sm font-semibold text-zinc-700">
            {photos.length === 0
              ? "Drop photos here to start the report"
              : "Drop more photos"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Drag and drop, paste from the clipboard, or click to browse. JPEG,
            PNG or WebP — each one is analysed as soon as it lands.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>

        {loadError && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 print:hidden">
            {loadError}
          </p>
        )}

        <footer className="mt-8 border-t border-zinc-200 pt-4 text-[11px] leading-relaxed text-zinc-400">
          Growth is identified from photographs only. Areas marked with a dashed
          outline are low confidence and should be confirmed on site, and growth
          hidden from the camera may not appear in this report.
        </footer>
      </div>
    </div>
  );
}
