import type { EnquiryStatus } from "@/lib/types";

const STATUS_STYLES: Record<EnquiryStatus, { label: string; className: string }> = {
  new: { label: "New", className: "bg-sky-500/15 text-sky-300 ring-sky-400/40" },
  contacted: { label: "Contacted", className: "bg-blue-500/15 text-blue-300 ring-blue-400/40" },
  qualified: { label: "Qualified", className: "bg-violet-500/15 text-violet-300 ring-violet-400/40" },
  booked: { label: "Booked", className: "bg-amber-500/15 text-amber-300 ring-amber-400/40" },
  won: { label: "Won", className: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/40" },
  lost: { label: "Lost", className: "bg-rose-500/15 text-rose-300 ring-rose-400/40" },
};

export function StatusBadge({ status }: { status: EnquiryStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-lg font-semibold ring-1 ring-inset ${style.className}`}
    >
      {style.label}
    </span>
  );
}
