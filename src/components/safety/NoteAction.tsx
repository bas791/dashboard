"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { btnDanger, btnPrimary, btnQuiet, input } from "./ui";
import type { ActionResult } from "@/app/safety/actions";

/**
 * A button that asks for a short written reason before doing something that
 * goes on the record (take out of service, return to service, fix a fault…).
 */
export function NoteAction({
  label,
  prompt,
  confirmLabel,
  tone = "quiet",
  action,
}: {
  label: string;
  prompt: string;
  confirmLabel: string;
  tone?: "quiet" | "primary" | "danger";
  action: (note: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const style = tone === "danger" ? btnDanger : tone === "primary" ? btnPrimary : btnQuiet;

  if (!open) {
    return (
      <button type="button" className={`${style} w-full`} onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-slate-300 bg-slate-50 p-3">
      <label className="mb-1 block text-sm font-medium text-slate-700">{prompt}</label>
      <textarea
        className={`${input} py-2`}
        rows={2}
        value={note}
        autoFocus
        onChange={(e) => setNote(e.target.value)}
      />
      {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className={`${style} flex-1`}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await action(note);
              if (!res.ok) return setError(res.error);
              setOpen(false);
              setNote("");
              setError(null);
              router.refresh();
            })
          }
        >
          {pending ? "Saving…" : confirmLabel}
        </button>
        <button type="button" className={btnQuiet} disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
