"use client";

import { AlertCircle, AlertTriangle, Info, Wrench, ExternalLink } from "lucide-react";
import { FormatViolation } from "@/lib/types/thesis";
import { cn } from "@/lib/utils";

interface FormatViolationListProps {
  violations: FormatViolation[];
  onAutoFix?: (id: string) => void;
  onAutoFixAll?: () => void;
}

const SEVERITY_CONFIG = {
  error: { icon: AlertCircle,   color: "text-red-600",   bg: "bg-red-50 border-red-200",   label: "Error"   },
  warn:  { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", label: "Warning" },
  info:  { icon: Info,          color: "text-blue-600",  bg: "bg-blue-50 border-blue-200",  label: "Info"    },
};

export function FormatViolationList({ violations, onAutoFix, onAutoFixAll }: FormatViolationListProps) {
  if (violations.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg">
        No format violations found. Document meets all formatting requirements.
      </div>
    );
  }

  const autoFixable = violations.filter(v => v.auto_fixable);
  const errors = violations.filter(v => v.severity === "error");
  const warnings = violations.filter(v => v.severity === "warn");
  const infos = violations.filter(v => v.severity === "info");

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <span className="font-medium">{violations.length} issue{violations.length !== 1 ? "s" : ""} found</span>
          {autoFixable.length > 0 && (
            <span className="text-gray-400 ml-1">({autoFixable.length} auto-fixable)</span>
          )}
          {errors.length > 0 && (
            <span className="ml-2 text-xs text-red-600 font-medium">{errors.length} error{errors.length !== 1 ? "s" : ""}</span>
          )}
          {warnings.length > 0 && (
            <span className="ml-2 text-xs text-amber-600 font-medium">{warnings.length} warning{warnings.length !== 1 ? "s" : ""}</span>
          )}
        </p>
        {autoFixable.length > 0 && onAutoFixAll && (
          <button
            onClick={onAutoFixAll}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-50"
          >
            <Wrench className="h-3.5 w-3.5" />
            Auto-Fix All ({autoFixable.length})
          </button>
        )}
      </div>

      {/* Violation rows */}
      <div className="space-y-2">
        {violations.map(v => {
          const cfg = SEVERITY_CONFIG[v.severity];
          const Icon = cfg.icon;
          return (
            <div key={v.id} className={cn("rounded-lg border p-3 flex items-start gap-3", cfg.bg)}>
              <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", cfg.color)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-xs font-medium uppercase tracking-wide", cfg.color)}>
                    [{cfg.label}]
                  </span>
                  <span className="text-xs text-gray-500">{v.location}</span>
                  {v.field && <span className="text-xs text-gray-400">· {v.field}</span>}
                </div>
                <p className="text-sm text-gray-700 mt-0.5">
                  Uses <code className="text-xs bg-white px-1 rounded border border-gray-200">{v.actual}</code>,
                  expected <code className="text-xs bg-white px-1 rounded border border-gray-200">{v.expected}</code>
                </p>
              </div>
              <div className="shrink-0">
                {v.auto_fixable && onAutoFix ? (
                  <button
                    onClick={() => onAutoFix(v.id)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 whitespace-nowrap"
                  >
                    <Wrench className="h-3 w-3" />
                    Auto-Fix
                  </button>
                ) : (
                  <span className="text-xs text-gray-400 italic whitespace-nowrap">Manual Fix</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
