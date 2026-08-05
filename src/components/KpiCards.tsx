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
    { label: "Enquiries Today", value: total, accent: "text-zinc-100 border-zinc-700" },
    {
      label: "Waiting",
      value: waiting,
      accent:
        waiting > 0
          ? "text-orange-300 border-orange-500/50"
          : "text-emerald-300 border-emerald-500/40",
      glow: waiting > 0,
    },
    { label: "Contacted", value: counts.contacted, accent: "text-blue-300 border-blue-500/40" },
    { label: "Qualified", value: counts.qualified, accent: "text-violet-300 border-violet-500/40" },
    { label: "Booked", value: counts.booked, accent: "text-amber-300 border-amber-500/40" },
    { label: "Won", value: counts.won, accent: "text-emerald-300 border-emerald-500/40" },
    { label: "Lost", value: counts.lost, accent: "text-rose-300 border-rose-500/40" },
  ];

  return (
    <section className="grid grid-cols-7 gap-4" aria-label="Today's pipeline">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-2xl border bg-zinc-900/60 px-4 py-3.5 text-center shadow-lg shadow-black/30 transition-colors ${card.accent} ${
            card.glow ? "animate-sla-pulse" : ""
          }`}
        >
          <div className="text-5xl font-bold tabular-nums">{card.value}</div>
          <div className="mt-1 text-base font-medium uppercase tracking-wider text-zinc-500">
            {card.label}
          </div>
        </div>
      ))}
    </section>
  );
}
