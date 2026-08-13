"use client";

import { formatTimeShort } from "@/lib/time";
import type { ActivityEvent, ActivityType } from "@/lib/types";

const TYPE_META: Record<ActivityType, { icon: string; tone: string }> = {
  enquiry_received: { icon: "✉", tone: "text-sky-600" },
  contacted: { icon: "☎", tone: "text-blue-600" },
  chasing: { icon: "🤖", tone: "text-cyan-600" },
  qualified: { icon: "★", tone: "text-violet-600" },
  booked: { icon: "📅", tone: "text-amber-600" },
  won: { icon: "🏆", tone: "text-emerald-600" },
  lost: { icon: "✕", tone: "text-rose-600" },
  assigned: { icon: "→", tone: "text-slate-500" },
};

export function ActivityFeed({ activity, timezone }: { activity: ActivityEvent[]; timezone: string }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-900/5">
      <h2 className="border-b border-slate-200 bg-gradient-to-r from-violet-50 to-white px-6 py-4 text-2xl font-bold text-slate-900">
        Live Activity
      </h2>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-3">
        {activity.length === 0 && (
          <li className="px-2 py-6 text-center text-xl text-slate-400">
            Activity will appear here as it happens.
          </li>
        )}
        {activity.map((event) => {
          const meta = TYPE_META[event.type];
          return (
            <li
              key={event.id}
              className="flex items-baseline gap-3 rounded-lg px-2 py-1.5 text-xl"
            >
              <span className={`w-7 shrink-0 text-center ${meta.tone}`} aria-hidden>
                {meta.icon}
              </span>
              <span className="flex-1 text-slate-700">{event.message}</span>
              <span className="shrink-0 font-mono text-base text-slate-400">
                {formatTimeShort(event.at, timezone)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
