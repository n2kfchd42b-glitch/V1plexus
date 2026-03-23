"use client";

import { useState } from "react";
import { Download, Bell, GraduationCap, AlertTriangle, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { CoordinatorThesisRow } from "@/lib/types/thesis";
import { StudentProgressRow } from "./StudentProgressRow";
import { BulkReminderModal } from "./BulkReminderModal";

interface GraduateCoordinatorDashProps {
  departmentName: string;
  students: CoordinatorThesisRow[];
}

export function GraduateCoordinatorDash({ departmentName, students }: GraduateCoordinatorDashProps) {
  const [showBulkReminder, setShowBulkReminder] = useState(false);
  const [filter, setFilter] = useState<"all" | "on_track" | "behind" | "at_risk" | "near_completion">("all");

  const counts = {
    on_track:        students.filter(s => s.status_label === "on_track").length,
    behind:          students.filter(s => s.status_label === "behind").length,
    at_risk:         students.filter(s => s.status_label === "at_risk").length,
    near_completion: students.filter(s => s.status_label === "near_completion").length,
  };

  const filtered = filter === "all" ? students : students.filter(s => s.status_label === filter);

  function handleExportReport() {
    // TODO: generate real PDF/CSV report
    const headers = "Student,Degree,Supervisor,Progress,Status,Expected Completion\n";
    const rows = students.map(s =>
      `"${s.student_name}","${s.degree_type}","${s.supervisor_name ?? ""}",${s.progress_percent}%,"${s.status_label}","${s.expected_completion ?? ""}"`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `graduate-progress-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-blue-500" />
            Graduate Students
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">{departmentName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportReport}
            className="flex items-center gap-1.5 text-sm px-3 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export Report
          </button>
          <button
            onClick={() => setShowBulkReminder(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Bell className="h-4 w-4" />
            Send Bulk Reminder
          </button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all",             `${students.length} total`,   Clock,         "text-gray-600  bg-gray-100  border-gray-200"  ],
            ["on_track",        `${counts.on_track} on track`,     CheckCircle,   "text-green-600 bg-green-50  border-green-200" ],
            ["behind",          `${counts.behind} behind`,    AlertTriangle, "text-amber-600 bg-amber-50  border-amber-200" ],
            ["at_risk",         `${counts.at_risk} at risk`,  AlertCircle,   "text-red-600   bg-red-50    border-red-200"   ],
            ["near_completion",  `${counts.near_completion} near completion`, GraduationCap, "text-blue-600  bg-blue-50   border-blue-200"  ],
          ] as const
        ).map(([key, label, Icon, colorCls]) => (
          <button
            key={key}
            onClick={() => setFilter(key as typeof filter)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${colorCls} ${
              filter === key ? "ring-2 ring-offset-1 ring-blue-400" : "opacity-80 hover:opacity-100"
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-lg border border-gray-200">
          <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No active thesis students in this department.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Student</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Thesis</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Progress</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(row => (
                <StudentProgressRow key={row.project_id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showBulkReminder && (
        <BulkReminderModal
          students={filtered.length > 0 ? filtered : students}
          onClose={() => setShowBulkReminder(false)}
        />
      )}
    </div>
  );
}
