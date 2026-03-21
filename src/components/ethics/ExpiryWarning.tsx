import { AlertTriangle, AlertCircle } from "lucide-react";
import { daysUntil, formatDate } from "@/lib/utils";

export function ExpiryWarning({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null;

  const days = daysUntil(expiresAt);
  if (days === null) return null;

  if (days < 0) {
    return (
      <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
        <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-800">Ethics approval has expired</p>
          <p className="text-xs text-red-600 mt-0.5">
            Expired on {formatDate(expiresAt)}. Renewal is required to continue the study.
          </p>
        </div>
      </div>
    );
  }

  if (days <= 90) {
    return (
      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-800">
            Ethics approval expiring in {days} day{days !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-amber-600 mt-0.5">
            Expires on {formatDate(expiresAt)}. File a renewal application soon.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
