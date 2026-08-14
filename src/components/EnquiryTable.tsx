"use client";

import Link from "next/link";
import { getLocation } from "@/config/team";
import { formatTimeShort } from "@/lib/time";
import type { Enquiry } from "@/lib/types";
import { ResponseTimer, SlaDot } from "./ResponseTimer";
import { StatusBadge } from "./StatusBadge";

interface EnquiryTableProps {
  enquiries: Enquiry[];
  now: number;
  timezone: string;
  warnMinutes: number;
  breachMinutes: number;
  /** Enquiries that arrived while the board was open — briefly highlighted. */
  recentIds: Set<string>;
  /** On the NZ-wide board, show which branch each enquiry belongs to. */
  showLocations?: boolean;
}

const HIGHLIGHT_WINDOW_MS = 60_000;

/** Live incoming enquiries, newest first. */
export function EnquiryTable({
  enquiries,
  now,
  timezone,
  warnMinutes,
  breachMinutes,
  recentIds,
  showLocations = false,
}: EnquiryTableProps) {
  const columnCount = showLocations ? 9 : 8;
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-md shadow-slate-900/5">
      <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-sky-50 to-white px-6 py-4">
        <h2 className="text-2xl font-bold text-slate-900">Live Enquiries</h2>
        <span className="text-lg text-slate-500">{enquiries.length} today</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-slate-50 text-base uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3">Time</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Phone</th>
              {showLocations && <th className="px-4 py-3">Branch</th>}
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Response</th>
              <th className="px-4 py-3">SLA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xl">
            {enquiries.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="px-6 py-12 text-center text-2xl text-slate-400">
                  No enquiries yet today — they’ll appear here the moment they arrive.
                </td>
              </tr>
            )}
            {enquiries.map((enquiry) => {
              const isFresh =
                recentIds.has(enquiry.id) &&
                now - new Date(enquiry.receivedAt).getTime() < HIGHLIGHT_WINDOW_MS;
              return (
                <tr
                  key={enquiry.id}
                  className={`transition-colors ${
                    isFresh
                      ? "animate-new-row bg-sky-100"
                      : enquiry.respondedAt
                        ? "opacity-80"
                        : ""
                  }`}
                >
                  <td className="whitespace-nowrap px-6 py-3 font-mono text-slate-500">
                    {formatTimeShort(enquiry.receivedAt, timezone)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {enquiry.contactName}
                    {isFresh && (
                      <span className="ml-3 rounded-full bg-sky-100 px-2.5 py-0.5 text-sm font-bold uppercase tracking-wide text-sky-700 ring-1 ring-inset ring-sky-300">
                        New
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-500">
                    {enquiry.phone}
                  </td>
                  {showLocations && (
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-base font-semibold uppercase tracking-wide text-slate-500">
                        {getLocation(enquiry.locationId)?.shortName ?? enquiry.locationId}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-600">{enquiry.source}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {enquiry.assignedTo ? (
                      <Link
                        href={`/p/${encodeURIComponent(enquiry.assignedTo)}`}
                        className="underline-offset-2 hover:text-sky-700 hover:underline"
                      >
                        {enquiry.assignedTo}
                      </Link>
                    ) : (
                      <span className="italic text-slate-400">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={enquiry.status} />
                  </td>
                  <td className="px-4 py-3">
                    <ResponseTimer
                      enquiry={enquiry}
                      now={now}
                      warnMinutes={warnMinutes}
                      breachMinutes={breachMinutes}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <SlaDot
                      enquiry={enquiry}
                      now={now}
                      warnMinutes={warnMinutes}
                      breachMinutes={breachMinutes}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
