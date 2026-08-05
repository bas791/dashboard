"use client";

import { formatTimeShort } from "@/lib/time";
import type { ActivityEvent, ActivityType } from "@/lib/types";

const TYPE_META: Record<ActivityType, { icon: string; tone: string }> = {
  enquiry_received: { icon: "✉", tone: "text-sky-300" },
  contacted: { icon: "☎", tone: "text-blue-300" },
  qualified: { icon: "★", tone: "text-violet-300" },
  booked: { icon: "📅", tone: "text-amber-300" },
  won: { icon: "🏆", tone: "text-emerald-300" },
  lost: { icon: "✕", tone: "text-rose-300" },
  assigned: { icon: "→", tone: "text-zinc-300" },
};

export function ActivityFeed({ activity, timezone }: { activity: ActivityEvent[]; timezone: string }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-lg shadow-black/30">
      <h2 className="border-b border-zinc-800 px-6 py-4 text-2xl font-bold text-zinc-100">
        Live Activity
      </h2>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-3">
        {activity.length === 0 && (
          <li className="px-2 py-6 text-center text-xl text-zinc-500">
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
              <span className="flex-1 text-zinc-200">{event.message}</span>
              <span className="shrink-0 font-mono text-base text-zinc-500">
                {formatTimeShort(event.at, timezone)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
