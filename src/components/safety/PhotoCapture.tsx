"use client";

import { useRef, useState } from "react";
import type { LabelReading, PhotoAssessment } from "@/lib/safety/types";

export interface UploadedPhoto<TAi> {
  id: string;
  ai: TAi | null;
  aiAvailable: boolean;
}

/** Shrinks a phone photo to a sensible size before upload (saves data on site). */
async function compress(file: File, maxEdge = 1600): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (blob) return blob;
  } catch {
    // Fall through and send the original (e.g. a format the browser can't decode).
  }
  return file;
}

/**
 * Take or choose a photo, upload it, and hand back its id plus whatever
 * Claude made of it. `kind` is "label" (read the serial number) or "check"
 * (look for visible problems).
 */
export function PhotoCapture<TAi extends LabelReading | PhotoAssessment>({
  kind,
  assetId,
  check,
  buttonLabel,
  onUploaded,
}: {
  kind: "label" | "check";
  assetId?: string;
  check?: string;
  buttonLabel: string;
  onUploaded: (photo: UploadedPhoto<TAi>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File) {
    setBusy(true);
    setError(null);
    try {
      const blob = await compress(file);
      const form = new FormData();
      form.set("file", new File([blob], "photo.jpg", { type: blob.type || file.type }));
      form.set("kind", kind);
      if (assetId) form.set("assetId", assetId);
      if (check) form.set("check", check);
      const res = await fetch("/api/safety/photos", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Upload failed.");
      onUploaded(body as UploadedPhoto<TAi>);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "No signal — the photo didn't upload. Try again when you have reception."
          : err instanceof Error
            ? err.message
            : "Upload failed."
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handle(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-teal-700 bg-white px-4 text-base font-semibold text-teal-800 active:scale-[0.98] disabled:opacity-60"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
        {busy ? (kind === "label" ? "Reading label…" : "Checking photo…") : buttonLabel}
      </button>
      {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}
