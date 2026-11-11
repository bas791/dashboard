"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAsset, updateAsset, type AssetFormInput } from "@/app/safety/actions";
import { PhotoCapture } from "./PhotoCapture";
import { btnPrimary, input, label } from "./ui";
import type { AssetType, LabelReading } from "@/lib/safety/types";

interface Loc {
  id: string;
  name: string;
}

export function AssetForm({
  types,
  locations,
  defaultLocationId,
  existing,
}: {
  types: AssetType[];
  locations: Loc[];
  defaultLocationId: string;
  existing?: { id: string; values: AssetFormInput };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [reading, setReading] = useState<{ ai: LabelReading | null; aiAvailable: boolean } | null>(null);
  const [v, setV] = useState<AssetFormInput>(
    existing?.values ?? {
      name: "",
      typeId: "",
      locationId: defaultLocationId,
      serial: "",
      manufacturer: "",
      model: "",
      manufacturedOn: "",
      inServiceOn: new Date().toLocaleDateString("en-CA"),
      retireOn: "",
      notes: "",
    }
  );
  const set = (key: keyof AssetFormInput) => (e: { target: { value: string } }) =>
    setV((old) => ({ ...old, [key]: e.target.value }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = existing ? await updateAsset(existing.id, v) : await createAsset(v, photoId);
          if (!res.ok) return setError(res.error);
          router.push(`/safety/a/${res.code}`);
          router.refresh();
        });
      }}
    >
      {!existing && (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
          <p className="mb-3 text-sm text-teal-900">
            Take a clear photo of the label or serial number and the details below fill in for you.
          </p>
          <div className="flex items-center gap-3">
            <PhotoCapture<LabelReading>
              kind="label"
              buttonLabel={photoId ? "Retake label photo" : "Photo the label"}
              onUploaded={(p) => {
                setPhotoId(p.id);
                setReading({ ai: p.ai, aiAvailable: p.aiAvailable });
                if (p.ai) {
                  const ai = p.ai;
                  // Only fill fields the person hasn't already typed into.
                  setV((old) => ({
                    ...old,
                    serial: old.serial || ai.serial || "",
                    manufacturer: old.manufacturer || ai.manufacturer || "",
                    model: old.model || ai.model || "",
                    manufacturedOn: old.manufacturedOn || ai.manufacturedOn || "",
                    name: old.name || ai.suggestedName || "",
                  }));
                }
              }}
            />
            {photoId && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/safety/photos/${photoId}`} alt="Label" className="h-16 w-16 rounded-lg object-cover" />
            )}
          </div>
          {reading && (
            <p className="mt-3 text-sm text-teal-900">
              {reading.ai
                ? `Read from the photo — check it against the label before saving.${reading.ai.notes ? ` Note: ${reading.ai.notes}` : ""}`
                : reading.aiAvailable
                  ? "Couldn't read that label. Retake it closer and in better light, or type the details in."
                  : "Photo saved. Automatic label reading isn't switched on yet, so type the details in."}
            </p>
          )}
        </div>
      )}

      <div>
        <label className={label}>What is it?</label>
        <input className={input} value={v.name} onChange={set("name")} placeholder="e.g. 50m static rope, Hilux flat deck" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Type</label>
          <select className={input} value={v.typeId} onChange={set("typeId")} required>
            <option value="">Choose…</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Branch</label>
          <select className={input} value={v.locationId} onChange={set("locationId")}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={label}>Serial number / rego</label>
        <input className={`${input} font-mono`} value={v.serial ?? ""} onChange={set("serial")} autoCapitalize="characters" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Make</label>
          <input className={input} value={v.manufacturer ?? ""} onChange={set("manufacturer")} />
        </div>
        <div>
          <label className={label}>Model</label>
          <input className={input} value={v.model ?? ""} onChange={set("model")} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={label}>Made</label>
          <input className={input} type="date" value={v.manufacturedOn ?? ""} onChange={set("manufacturedOn")} />
        </div>
        <div>
          <label className={label}>First used</label>
          <input className={input} type="date" value={v.inServiceOn ?? ""} onChange={set("inServiceOn")} />
        </div>
        <div>
          <label className={label}>Retire by</label>
          <input className={input} type="date" value={v.retireOn ?? ""} onChange={set("retireOn")} />
        </div>
      </div>
      <div>
        <label className={label}>Notes</label>
        <textarea className={`${input} py-2`} rows={2} value={v.notes ?? ""} onChange={set("notes")} />
      </div>
      {error && <p className="text-sm font-medium text-red-700">{error}</p>}
      <button className={`${btnPrimary} w-full`} disabled={pending}>
        {pending ? "Saving…" : existing ? "Save changes" : "Add to register"}
      </button>
    </form>
  );
}
