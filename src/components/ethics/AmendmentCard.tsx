import { formatDate } from "@/lib/utils";
import type { EthicsAmendment } from "@/lib/types/database";

const AMENDMENT_STATUS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export function AmendmentCard({
  amendment,
  index,
}: {
  amendment: EthicsAmendment;
  index: number;
}) {
  return (
    <div className="flex items-start justify-between py-3 px-4 border border-gray-100 rounded-lg">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-bold text-gray-500">#{index + 1}</span>
          <p className="text-sm font-medium text-gray-900">{amendment.description}</p>
        </div>
        {amendment.justification && (
          <p className="text-xs text-gray-500 mt-0.5">{amendment.justification}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          {amendment.submitted_at
            ? `Submitted ${formatDate(amendment.submitted_at)}`
            : `Created ${formatDate(amendment.created_at)}`}
        </p>
      </div>
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
          AMENDMENT_STATUS[amendment.status] ?? "bg-gray-100 text-gray-600"
        }`}
      >
        {amendment.status.charAt(0).toUpperCase() + amendment.status.slice(1)}
      </span>
    </div>
  );
}
