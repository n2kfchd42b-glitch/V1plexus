"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle, GraduationCap, AlertCircle } from "lucide-react";
import { CoordinatorThesisRow, DEGREE_LABELS } from "@/lib/types/thesis";
import { cn } from "@/lib/utils";

interface StudentProgressRowProps {
  row: CoordinatorThesisRow;
}

const STATUS_CONFIG = {
  on_track:       { label: "On Track",       icon: CheckCircle,   color: "text-green-600  bg-green-50  border-green-200"  },
  behind:         { label: "Behind",         icon: AlertTriangle, color: "text-amber-600 bg-amber-50 border-amber-200" },
  at_risk:        { label: "At Risk",        icon: AlertCircle,   color: "text-red-600    bg-red-50    border-red-200"    },
  near_completion:{ label: "Near Completion", icon: GraduationCap, color: "text-blue-600   bg-blue-50   border-blue-200"   },
};

export function StudentProgressRow({ row }: StudentProgressRowProps) {
  const cfg = STATUS_CONFIG[row.status_label];
  const StatusIcon = cfg.icon;

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* Student */}
      <td className="px-4 py-3 align-top">
        <Link href={`/projects/${row.project_id}/overview`} className="hover:text-blue-600">
          <p className="text-sm font-medium text-gray-900">{row.student_name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {DEGREE_LABELS[row.degree_type]}
            {row.supervisor_name ? ` · ${row.supervisor_name}` : ""}
          </p>
        </Link>
      </td>

      {/* Thesis title */}
      <td className="px-4 py-3 align-top">
        <p className="text-sm text-gray-700 line-clamp-2">
          {row.thesis_title ?? <span className="italic text-gray-400">No title yet</span>}
        </p>
        {row.current_chapter && (
          <p className="text-xs text-gray-400 mt-0.5">{row.current_chapter}</p>
        )}
      </td>

      {/* Progress */}
      <td className="px-4 py-3 align-top w-32">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full",
                row.progress_percent >= 80 ? "bg-blue-500" :
                row.progress_percent >= 50 ? "bg-green-500" :
                row.progress_percent >= 25 ? "bg-amber-400" : "bg-red-400"
              )}
              style={{ width: `${row.progress_percent}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 shrink-0">{row.progress_percent}%</span>
        </div>
        {row.expected_completion && (
          <p className="text-xs text-gray-400 mt-1">Due: {row.expected_completion}</p>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3 align-top">
        <span className={cn(
          "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap",
          cfg.color
        )}>
          <StatusIcon className="h-3 w-3" />
          {cfg.label}
        </span>
        {row.alert_message && (
          <p className="text-xs text-red-500 mt-1 max-w-48">{row.alert_message}</p>
        )}
      </td>
    </tr>
  );
}
