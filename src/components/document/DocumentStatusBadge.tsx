import { cn } from "@/lib/utils";

type DocStatus = "draft" | "in_review" | "revision_requested" | "approved" | "locked";

const STATUS_STYLES: Record<DocStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  in_review: "bg-yellow-100 text-yellow-700",
  revision_requested: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  locked: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<DocStatus, string> = {
  draft: "Draft",
  in_review: "In Review",
  revision_requested: "Revision Requested",
  approved: "Approved",
  locked: "Locked",
};

export function DocumentStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const s = status as DocStatus;
  return (
    <span
      className={cn(
        "text-xs px-2 py-0.5 rounded-full font-medium",
        STATUS_STYLES[s] ?? "bg-gray-100 text-gray-600",
        className
      )}
    >
      {STATUS_LABELS[s] ?? status}
    </span>
  );
}
