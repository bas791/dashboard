import Link from "next/link";
import type { ReactNode } from "react";
import type { Asset } from "@/lib/safety/types";

/** Shared look for the safety screens: light, high contrast, big tap targets. */

export const btn =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition active:scale-[0.98] disabled:opacity-50";
export const btnPrimary = `${btn} bg-teal-700 text-white hover:bg-teal-800`;
export const btnQuiet = `${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`;
export const btnDanger = `${btn} bg-red-600 text-white hover:bg-red-700`;
export const input =
  "block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30";
export const label = "mb-1 block text-sm font-medium text-slate-600";

export function Screen({
  title,
  back,
  action,
  children,
}: {
  title: string;
  back?: { href: string; label: string };
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex min-h-10 items-center text-sm font-medium text-teal-700">
          ‹ {back.label}
        </Link>
      )}
      <div className="mb-4 flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {action}
      </div>
      {children}
    </main>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>;
}

const TONES = {
  good: "bg-emerald-100 text-emerald-800",
  warn: "bg-amber-100 text-amber-900",
  bad: "bg-red-100 text-red-800",
  muted: "bg-slate-100 text-slate-600",
} as const;

export function Pill({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>
      {children}
    </span>
  );
}

/** The one-line state of an item, worst news first. */
export function assetState(a: Asset): { tone: keyof typeof TONES; text: string } {
  if (a.status === "retired") return { tone: "muted", text: "Retired" };
  if (a.status === "quarantined") return { tone: "bad", text: "Out of service" };
  if (a.detailedOverdue) return { tone: "bad", text: "Inspection overdue" };
  if (a.openFaults > 0) return { tone: "warn", text: `${a.openFaults} open fault${a.openFaults === 1 ? "" : "s"}` };
  return { tone: "good", text: "In service" };
}

export function AssetRow({ asset, href, extra }: { asset: Asset; href?: string; extra?: ReactNode }) {
  const state = assetState(asset);
  const holder = asset.holderPersonName ?? asset.holderVehicleName;
  return (
    <Link
      href={href ?? `/safety/a/${asset.code}`}
      className="flex min-h-16 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50"
    >
      <div className="min-w-0">
        <div className="truncate font-semibold text-slate-900">{asset.name}</div>
        <div className="truncate text-sm text-slate-500">
          {asset.code} · {asset.typeName}
          {holder ? ` · ${holder}` : ""}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Pill tone={state.tone}>{state.text}</Pill>
        {extra}
      </div>
    </Link>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-slate-500">{children}</p>;
}

export function Field({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
      <dt className="text-sm text-slate-500">{name}</dt>
      <dd className="text-right text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}
