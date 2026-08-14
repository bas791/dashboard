import Link from "next/link";
import { KPI_STATUSES, STATUS_LABELS } from "@/config/team";
import type { EnquiryStatus, StatusCounts } from "@/lib/types";

interface KpiCardsProps {
  counts: StatusCounts;
  total: number;
  waiting: number;
}

const DEFAULT_LABELS: Record<EnquiryStatus, string> = {
  new: "New",
  contacted: "Contacted",
  chasing: "Chasing",
  qualified: "Qualified",
  booked: "Booked",
  won: "Won",
  lost: "Lost",
};

const STATUS_ACCENTS: Record<EnquiryStatus, string> = {
  new: "bg-sky-50 text-sky-700 border-sky-200",
  contacted: "bg-blue-50 text-blue-700 border-blue-200",
  chasing: "bg-cyan-50 text-cyan-700 border-cyan-200",
  qualified: "bg-violet-50 text-violet-700 border-violet-200",
  booked: "bg-amber-50 text-amber-700 border-amber-200",
  won: "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost: "bg-rose-50 text-rose-700 border-rose-200",
};

interface CardDef {
  label: string;
  value: number;
  accent: string;
  glow?: boolean;
  /** Clicking the card opens this drill-down page */
  href?: string;
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
    ...KPI_STATUSES.map((status) => ({
      label: STATUS_LABELS[status] ?? DEFAULT_LABELS[status],
      value: counts[status],
      accent: STATUS_ACCENTS[status],
      href: status === "won" ? "/won" : undefined,
    })),
  ];

  return (
    <section
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }}
      aria-label="Today's pipeline"
    >
      {cards.map((card) => {
        const className = `block rounded-2xl border px-4 py-3.5 text-center shadow-sm shadow-slate-900/5 transition-colors ${card.accent} ${
          card.glow ? "animate-sla-pulse" : ""
        } ${card.href ? "hover:brightness-95" : ""}`;
        const body = (
          <>
            <div className="text-5xl font-bold tabular-nums">{card.value}</div>
            <div className="mt-1 text-base font-medium uppercase tracking-wider text-slate-500">
              {card.label}
            </div>
          </>
        );
        return card.href ? (
          <Link key={card.label} href={card.href} className={className}>
            {body}
          </Link>
        ) : (
          <div key={card.label} className={className}>
            {body}
          </div>
        );
      })}
    </section>
  );
}
