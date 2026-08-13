import { STATUS_LABELS } from "@/config/team";
import type { EnquiryStatus } from "@/lib/types";

const STATUS_STYLES: Record<EnquiryStatus, { label: string; className: string }> = {
  new: { label: "New", className: "bg-sky-100 text-sky-700 ring-sky-300" },
  contacted: { label: "Contacted", className: "bg-blue-100 text-blue-700 ring-blue-300" },
  chasing: { label: "Chasing", className: "bg-cyan-100 text-cyan-700 ring-cyan-300" },
  qualified: { label: "Qualified", className: "bg-violet-100 text-violet-700 ring-violet-300" },
  booked: { label: "Booked", className: "bg-amber-100 text-amber-700 ring-amber-300" },
  won: { label: "Won", className: "bg-emerald-100 text-emerald-700 ring-emerald-300" },
  lost: { label: "Lost", className: "bg-rose-100 text-rose-700 ring-rose-300" },
};

export function StatusBadge({ status }: { status: EnquiryStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-lg font-semibold ring-1 ring-inset ${style.className}`}
    >
      {STATUS_LABELS[status] ?? style.label}
    </span>
  );
}
