"use client";

import { AlertTriangle, Info, AlertCircle } from "lucide-react";
import { EarlyWarning } from "@/lib/types/thesis";
import { cn } from "@/lib/utils";

interface EarlyWarningPanelProps {
  warnings: EarlyWarning[];
}

const WARN_CONFIG = {
  overdue:  { icon: AlertCircle,   color: "text-red-600",    bg: "bg-red-50 border-red-200"    },
  at_risk:  { icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  pace:     { icon: AlertTriangle, color: "text-amber-600",  bg: "bg-amber-50 border-amber-200"  },
  info:     { icon: Info,          color: "text-blue-600",   bg: "bg-blue-50 border-blue-200"    },
};

export function EarlyWarningPanel({ warnings }: EarlyWarningPanelProps) {
  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
        <Info className="h-4 w-4 shrink-0" />
        All chapters are on track. No warnings.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {warnings.map((w, i) => {
        const cfg = WARN_CONFIG[w.type];
        const Icon = cfg.icon;
        return (
          <div key={i} className={cn("flex items-start gap-2 rounded-lg border px-4 py-3 text-sm", cfg.bg)}>
            <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", cfg.color)} />
            <span className={cn("leading-snug", cfg.color)}>{w.message}</span>
          </div>
        );
      })}
    </div>
  );
}
