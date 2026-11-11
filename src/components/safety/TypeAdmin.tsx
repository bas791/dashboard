"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAssetType } from "@/app/safety/actions";
import { btnQuiet, input, label } from "./ui";
import { CATEGORIES, type AssetCategory } from "@/lib/safety/types";

export function AddTypeForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AssetCategory>("other");
  const [days, setDays] = useState("");

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await addAssetType({ name, category, detailedIntervalDays: days ? Number(days) : null });
          if (!res.ok) return setError(res.error);
          setName("");
          setDays("");
          setError(null);
          router.refresh();
        });
      }}
    >
      <div>
        <label className={label}>Add an equipment type</label>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Soft-wash pump" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <select aria-label="Category" className={input} value={category} onChange={(e) => setCategory(e.target.value as AssetCategory)}>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          aria-label="Days between detailed inspections"
          className={input}
          inputMode="numeric"
          value={days}
          onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
          placeholder="Inspect every … days"
        />
      </div>
      {error && <p className="text-sm font-medium text-red-700">{error}</p>}
      <button className={btnQuiet} disabled={pending}>
        Add type
      </button>
    </form>
  );
}
