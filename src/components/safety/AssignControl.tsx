"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignAsset } from "@/app/safety/actions";
import { btnPrimary, btnQuiet, input } from "./ui";

interface Option {
  id: string;
  name: string;
}

/** Issue an item to a person or put it on a truck; or return it to the store. */
export function AssignControl({
  assetId,
  held,
  meId,
  people,
  vehicles,
}: {
  assetId: string;
  held: boolean;
  meId: string;
  people: Option[];
  vehicles: Option[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState(`p:${meId}`);

  const run = (holder: { personId: string | null; vehicleId: string | null }) =>
    start(async () => {
      const res = await assignAsset(assetId, holder);
      setError(res.ok ? null : res.error);
      if (res.ok) router.refresh();
    });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select className={`${input} flex-1`} value={target} onChange={(e) => setTarget(e.target.value)}>
          <optgroup label="People">
            {people.map((p) => (
              <option key={p.id} value={`p:${p.id}`}>
                {p.id === meId ? `${p.name} (me)` : p.name}
              </option>
            ))}
          </optgroup>
          {vehicles.length > 0 && (
            <optgroup label="Vehicles">
              {vehicles.map((v) => (
                <option key={v.id} value={`v:${v.id}`}>
                  {v.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          type="button"
          className={btnPrimary}
          disabled={pending}
          onClick={() => {
            const [kind, id] = [target.slice(0, 1), target.slice(2)];
            run(kind === "p" ? { personId: id, vehicleId: null } : { personId: null, vehicleId: id });
          }}
        >
          {held ? "Move" : "Issue"}
        </button>
      </div>
      {held && (
        <button type="button" className={`${btnQuiet} w-full`} disabled={pending} onClick={() => run({ personId: null, vehicleId: null })}>
          Return to store
        </button>
      )}
      {error && <p className="text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}
