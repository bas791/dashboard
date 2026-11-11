"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveChecklist } from "@/app/safety/actions";
import { btnPrimary, btnQuiet, input } from "./ui";
import type { ChecklistItem, ChecklistKind } from "@/lib/safety/types";

export function ChecklistEditor({
  typeId,
  kind,
  initial,
}: {
  typeId: string;
  kind: ChecklistKind;
  initial: ChecklistItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [items, setItems] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const patch = (id: string, p: Partial<ChecklistItem>) => {
    setMessage(null);
    setItems((old) => old.map((i) => (i.id === id ? { ...i, ...p } : i)));
  };
  const move = (index: number, by: number) =>
    setItems((old) => {
      const next = [...old];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });

  return (
    <div className="space-y-3">
      {items.map((item, n) => (
        <section key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <textarea
            aria-label={`Check ${n + 1} wording`}
            className={`${input} py-2`}
            rows={2}
            value={item.label}
            onChange={(e) => patch(item.id, { label: e.target.value })}
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-700">
            <label className="flex min-h-10 items-center gap-2">
              <input type="checkbox" className="h-5 w-5" checked={item.photo} onChange={(e) => patch(item.id, { photo: e.target.checked })} />
              Photo required
            </label>
            <label className="flex min-h-10 items-center gap-2">
              <input type="checkbox" className="h-5 w-5" checked={item.critical} onChange={(e) => patch(item.id, { critical: e.target.checked })} />
              Failing takes it out of service
            </label>
            <span className="ml-auto flex gap-1">
              <button type="button" aria-label="Move up" disabled={n === 0} onClick={() => move(n, -1)} className="h-10 w-10 rounded-lg border border-slate-300 disabled:opacity-30">
                ↑
              </button>
              <button type="button" aria-label="Move down" disabled={n === items.length - 1} onClick={() => move(n, 1)} className="h-10 w-10 rounded-lg border border-slate-300 disabled:opacity-30">
                ↓
              </button>
              <button type="button" aria-label="Delete check" onClick={() => setItems((old) => old.filter((i) => i.id !== item.id))} className="h-10 w-10 rounded-lg border border-red-300 text-red-700">
                ×
              </button>
            </span>
          </div>
        </section>
      ))}

      <button
        type="button"
        className={`${btnQuiet} w-full`}
        onClick={() =>
          setItems((old) => [
            ...old,
            { id: `c${Date.now().toString(36)}`, label: "", photo: false, critical: true },
          ])
        }
      >
        + Add a check
      </button>
      {message && (
        <p className={`text-sm font-medium ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</p>
      )}
      <button
        type="button"
        className={`${btnPrimary} w-full`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await saveChecklist(typeId, kind, items);
            setMessage(res.ok ? { ok: true, text: "Saved. New checks use this list from now on." } : { ok: false, text: res.error });
            if (res.ok) router.refresh();
          })
        }
      >
        {pending ? "Saving…" : "Save checklist"}
      </button>
      <p className="text-center text-sm text-slate-500">Past inspections keep the wording they were done with.</p>
    </div>
  );
}
