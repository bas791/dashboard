"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPerson, choosePerson } from "@/app/safety/actions";
import { btnPrimary, input, label } from "./ui";
import type { Person } from "@/lib/safety/types";

interface Loc {
  id: string;
  name: string;
}

export function WhoPicker({
  people,
  locations,
  currentId,
}: {
  people: Person[];
  locations: Loc[];
  currentId: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");

  // Nobody yet: the first person in sets the system up.
  if (people.length === 0) {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await addPerson({ name, locationId, role: "manager" });
            if (!res.ok) return setError(res.error);
            router.push("/safety");
            router.refresh();
          });
        }}
      >
        <p className="text-slate-600">
          You&apos;re the first one here, so you&apos;ll be set up as a manager. You can add the rest of the team
          afterwards.
        </p>
        <div>
          <label className={label}>Your name</label>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className={label}>Your branch</label>
          <select className={input} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm font-medium text-red-700">{error}</p>}
        <button className={`${btnPrimary} w-full`} disabled={pending}>
          {pending ? "Setting up…" : "Get started"}
        </button>
      </form>
    );
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm font-medium text-red-700">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await choosePerson(p.id);
                if (!res.ok) return setError(res.error);
                router.push("/safety");
                router.refresh();
              })
            }
            className={`min-h-16 rounded-2xl border px-3 py-3 text-left font-semibold shadow-sm active:scale-[0.98] ${
              p.id === currentId
                ? "border-teal-700 bg-teal-50 text-teal-900"
                : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            {p.name}
            <span className="block text-xs font-normal text-slate-500">
              {locations.find((l) => l.id === p.locationId)?.name ?? p.locationId}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
