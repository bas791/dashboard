import type { StatusCounts } from "@/lib/types";

interface KpiCardsProps {
  counts: StatusCounts;
  total: number;
  waiting: number;
}

interface CardDef {
  label: string;
  value: number;
  accent: string;
  glow?: boolean;
}

export function KpiCards({ counts, total, waiting }: KpiCardsProps) {
  const cards: CardDef[] = [
    { label: "Enquiries Today", value: total, accent: "bg-sky-50 text-sky-700 border-sky-200" },
    {
      label: "Waiting",
      value: waiting,
      accent:
        waiting > 0
          ? "bg-orange-50 text-orange-600 border-orange-300"
          : "bg-emerald-50 text-emerald-600 border-emerald-200",
      glow: waiting > 0,
    },
    { label: "Contacted", value: counts.contacted, accent: "bg-blue-50 text-blue-700 border-blue-200" },
    { label: "Chasing", value: counts.chasing, accent: "bg-cyan-50 text-cyan-700 border-cyan-200" },
    { label: "Qualified", value: counts.qualified, accent: "bg-violet-50 text-violet-700 border-violet-200" },
    { label: "Booked", value: counts.booked, accent: "bg-amber-50 text-amber-700 border-amber-200" },
    { label: "Won", value: counts.won, accent: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { label: "Lost", value: counts.lost, accent: "bg-rose-50 text-rose-700 border-rose-200" },
  ];

  return (
    <section className="grid grid-cols-8 gap-4" aria-label="Today's pipeline">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-2xl border px-4 py-3.5 text-center shadow-sm shadow-slate-900/5 transition-colors ${card.accent} ${
            card.glow ? "animate-sla-pulse" : ""
          }`}
        >
          <div className="text-5xl font-bold tabular-nums">{card.value}</div>
          <div className="mt-1 text-base font-medium uppercase tracking-wider text-slate-500">
            {card.label}
          </div>
        </div>
      ))}
    </section>
  );
}
