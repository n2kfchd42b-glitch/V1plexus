"use client";

import { useMemo } from "react";
import { GanttEntry } from "@/lib/types/thesis";

interface GanttTimelineProps {
  entries: GanttEntry[];
  startDate?: Date;
  endDate?: Date;
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function GanttTimeline({ entries, startDate, endDate }: GanttTimelineProps) {
  const { timelineStart, totalMonths, months } = useMemo(() => {
    const allDates = entries.flatMap(e => [
      e.start_date ? new Date(e.start_date) : null,
      e.target_date ? new Date(e.target_date) : null,
      e.actual_end ? new Date(e.actual_end) : null,
    ]).filter(Boolean) as Date[];

    const earliest = startDate ?? (allDates.length > 0
      ? new Date(Math.min(...allDates.map(d => d.getTime())))
      : new Date());
    const latest = endDate ?? (allDates.length > 0
      ? new Date(Math.max(...allDates.map(d => d.getTime())))
      : addMonths(new Date(), 6));

    // Start from beginning of month
    const ts = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const te = new Date(latest.getFullYear(), latest.getMonth() + 1, 1);
    const total = Math.max(monthsBetween(ts, te), 3);

    const ms = Array.from({ length: total }, (_, i) => addMonths(ts, i));

    return { timelineStart: ts, totalMonths: total, months: ms };
  }, [entries, startDate, endDate]);

  function getBarStyle(entry: GanttEntry): { left: string; width: string } | null {
    const start = entry.start_date ? new Date(entry.start_date) : null;
    const end = entry.actual_end
      ? new Date(entry.actual_end)
      : entry.target_date
        ? new Date(entry.target_date)
        : null;
    if (!start && !end) return null;

    const effectiveStart = start ?? timelineStart;
    const effectiveEnd = end ?? addMonths(effectiveStart, 1);

    const startOffset = monthsBetween(timelineStart, new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), 1));
    const endOffset = monthsBetween(timelineStart, new Date(effectiveEnd.getFullYear(), effectiveEnd.getMonth() + 1, 0));

    const leftPct = Math.max(0, (startOffset / totalMonths) * 100);
    const widthPct = Math.max(2, ((Math.max(endOffset, startOffset + 1) - startOffset) / totalMonths) * 100);

    return { left: `${leftPct}%`, width: `${Math.min(widthPct, 100 - leftPct)}%` };
  }

  function getBarColor(entry: GanttEntry): string {
    if (entry.status === "defense") return "bg-purple-500";
    if (entry.status === "approved" || entry.status === "locked") return "bg-green-500";
    if (entry.status === "revision_requested") return "bg-amber-400";
    if (entry.status === "submitted_for_review") return "bg-blue-400";
    if (entry.status === "drafting") return "bg-blue-300";
    return "bg-gray-200";
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No timeline data available.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 600 }}>
        {/* Month header */}
        <div className="flex mb-1">
          <div className="w-40 shrink-0" />
          <div className="flex-1 flex">
            {months.map((m, i) => (
              <div
                key={i}
                className="flex-1 text-center text-xs text-gray-400 font-medium border-l border-gray-100 px-0.5"
              >
                {MONTH_NAMES[m.getMonth()]}
                {i === 0 || m.getMonth() === 0 ? ` ${m.getFullYear().toString().slice(2)}` : ""}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="space-y-1.5">
          {entries.map(entry => {
            const barStyle = getBarStyle(entry);
            const barColor = getBarColor(entry);
            const isLate =
              entry.target_date &&
              new Date(entry.target_date) < new Date() &&
              entry.status !== "approved" &&
              entry.status !== "locked" &&
              entry.status !== "defense";

            return (
              <div key={entry.id} className="flex items-center">
                <div className="w-40 shrink-0 pr-3 text-xs text-gray-600 font-medium truncate" title={entry.label}>
                  {entry.label}
                </div>
                <div className="flex-1 relative h-5 bg-gray-50 rounded border border-gray-100">
                  {/* Grid lines */}
                  {months.map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l border-gray-100"
                      style={{ left: `${(i / totalMonths) * 100}%` }}
                    />
                  ))}

                  {/* Today line */}
                  {(() => {
                    const todayOffset = monthsBetween(timelineStart, new Date());
                    if (todayOffset >= 0 && todayOffset <= totalMonths) {
                      return (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                          style={{ left: `${(todayOffset / totalMonths) * 100}%` }}
                        />
                      );
                    }
                    return null;
                  })()}

                  {/* Bar */}
                  {barStyle && (
                    <div
                      className={`absolute top-1 bottom-1 rounded-sm ${isLate ? "bg-red-400" : barColor}`}
                      style={barStyle}
                      title={`${entry.label}: ${entry.start_date ?? "?"} → ${entry.target_date ?? "?"}`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 pl-40">
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-green-500 inline-block" /> Approved</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-blue-300 inline-block" /> In Progress</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-gray-200 inline-block" /> Planned</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-red-400 inline-block" /> Overdue</span>
          <span className="flex items-center gap-1"><span className="w-px h-3 bg-red-400 inline-block" /> Today</span>
        </div>
      </div>
    </div>
  );
}
