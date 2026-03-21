import { cn } from "@/lib/utils";

type EthicsStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "conditionally_approved"
  | "rejected"
  | "expired"
  | "renewal_pending";

const STATUS_STYLES: Record<EthicsStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  conditionally_approved: "bg-teal-100 text-teal-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-red-100 text-red-700",
  renewal_pending: "bg-orange-100 text-orange-700",
};

const STATUS_LABELS: Record<EthicsStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  conditionally_approved: "Conditionally Approved",
  rejected: "Rejected",
  expired: "Expired",
  renewal_pending: "Renewal Pending",
};

export function EthicsStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const s = status as EthicsStatus;
  return (
    <span
      className={cn(
        "text-xs px-2.5 py-1 rounded-full font-semibold",
        STATUS_STYLES[s] ?? "bg-gray-100 text-gray-600",
        className
      )}
    >
      {STATUS_LABELS[s] ?? status}
    </span>
  );
}
