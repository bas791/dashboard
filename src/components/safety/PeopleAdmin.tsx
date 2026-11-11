"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addPerson, updatePerson } from "@/app/safety/actions";
import { btnPrimary, input, label } from "./ui";
import { ROLES, type Person, type Role } from "@/lib/safety/types";

interface Loc {
  id: string;
  name: string;
}

export function PeopleAdmin({ people, locations }: { people: Person[]; locations: Loc[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [role, setRole] = useState<Role>("crew");

  const change = (id: string, patch: { role?: string; active?: boolean }) =>
    start(async () => {
      const res = await updatePerson(id, patch);
      setError(res.ok ? null : res.error);
      router.refresh();
    });

  return (
    <div>
      <ul className="divide-y divide-slate-100">
        {people.map((p) => (
          <li key={p.id} className={`flex items-center justify-between gap-2 py-2 ${p.active ? "" : "opacity-50"}`}>
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-900">{p.name}</div>
              <div className="text-sm text-slate-500">{locations.find((l) => l.id === p.locationId)?.name}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <select
                aria-label={`Role for ${p.name}`}
                className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm"
                value={p.role}
                disabled={pending || !p.active}
                onChange={(e) => change(p.id, { role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700"
                disabled={pending}
                onClick={() => change(p.id, { active: !p.active })}
              >
                {p.active ? "Remove" : "Restore"}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}

      <form
        className="mt-4 grid gap-3 border-t border-slate-200 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await addPerson({ name, locationId, role });
            if (!res.ok) return setError(res.error);
            setName("");
            setError(null);
            router.refresh();
          });
        }}
      >
        <div>
          <label className={label}>Add a person</label>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select aria-label="Branch" className={input} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <select aria-label="Role" className={input} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <button className={btnPrimary} disabled={pending}>
          Add person
        </button>
      </form>
    </div>
  );
}
