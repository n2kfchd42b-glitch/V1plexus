import { formatDate } from "@/lib/utils";
import type { EthicsApplication, EthicsAmendment } from "@/lib/types/database";

type TimelineEvent = {
  label: string;
  date: string;
  type: "primary" | "amendment" | "expiry";
};

export function EthicsTimeline({
  application,
  amendments,
}: {
  application: EthicsApplication;
  amendments: EthicsAmendment[];
}) {
  const events: TimelineEvent[] = [];

  if (application.submitted_at) {
    events.push({
      label: "Submitted",
      date: application.submitted_at,
      type: "primary",
    });
  }
  if (application.approved_at) {
    events.push({
      label: "Approved",
      date: application.approved_at,
      type: "primary",
    });
  }
  amendments.forEach((a, i) => {
    if (a.submitted_at) {
      events.push({
        label: `Amend #${i + 1} submitted`,
        date: a.submitted_at,
        type: "amendment",
      });
    }
    if (a.approved_at) {
      events.push({
        label: `Amend #${i + 1} approved`,
        date: a.approved_at,
        type: "amendment",
      });
    }
  });
  if (application.expires_at) {
    events.push({
      label: "Expires",
      date: application.expires_at,
      type: "expiry",
    });
  }

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (events.length === 0) {
    return <p className="text-sm text-gray-400">No timeline events yet</p>;
  }

  return (
    <div className="relative">
      {/* Connecting line */}
      <div className="absolute top-3 left-3 right-3 h-0.5 bg-gray-200" />

      <div className="flex items-start justify-between relative overflow-x-auto">
        {events.map((event, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-2 min-w-[80px] px-2"
          >
            <div
              className={`w-3 h-3 rounded-full border-2 border-white z-10 ${
                event.type === "primary"
                  ? "bg-blue-500"
                  : event.type === "amendment"
                  ? "bg-purple-500"
                  : "bg-red-400"
              }`}
            />
            <p className="text-xs font-medium text-gray-700 text-center leading-tight">
              {event.label}
            </p>
            <p className="text-xs text-gray-400 text-center">
              {formatDate(event.date)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
