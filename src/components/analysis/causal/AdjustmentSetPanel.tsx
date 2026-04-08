'use client'

import type { AdjustmentSetResult } from '@/types/causal'

interface AdjustmentSetPanelProps {
  result: AdjustmentSetResult
  exposure: string
  outcome: string
}

export function AdjustmentSetPanel({ result, exposure, outcome }: AdjustmentSetPanelProps) {
  return (
    <div className="space-y-4 text-sm">
      {/* Identification status */}
      <div
        className={`rounded-lg px-4 py-3 border text-sm ${
          result.is_identified
            ? 'bg-green-50 text-green-800 border-green-100'
            : 'bg-amber-50 text-amber-800 border-amber-100'
        }`}
      >
        {result.is_identified
          ? `✓ The causal effect of ${exposure} on ${outcome} is identified by this DAG.`
          : `⚠ No directed path from ${exposure} to ${outcome}. Causal effect is not identified.`}
      </div>

      {/* Adjust for */}
      {result.adjustment_set.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Adjust for (include in model)
          </p>
          <div className="flex flex-wrap gap-2">
            {result.adjustment_set.map((v) => (
              <span
                key={v}
                className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium font-mono"
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      ) : (
        result.is_identified && (
          <p className="text-xs text-gray-500 italic">
            No adjustment variables needed — no open backdoor paths detected.
          </p>
        )
      )}

      {/* Do NOT adjust for */}
      {(result.mediators.length > 0 || result.colliders.length > 0) && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Do NOT adjust for
          </p>
          <div className="flex flex-wrap gap-2">
            {result.mediators.map((v) => (
              <span
                key={v}
                className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium font-mono"
              >
                {v} <span className="opacity-60">(mediator)</span>
              </span>
            ))}
            {result.colliders.map((v) => (
              <span
                key={v}
                className="px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium font-mono"
              >
                {v} <span className="opacity-60">(collider)</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Potential instruments */}
      {result.instruments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Potential instruments
          </p>
          <div className="flex flex-wrap gap-2">
            {result.instruments.map((v) => (
              <span
                key={v}
                className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium font-mono"
              >
                {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Causal path summary */}
      {result.causal_paths.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Causal paths ({result.causal_paths.length})
          </p>
          <div className="space-y-1">
            {result.causal_paths.slice(0, 5).map((path, i) => (
              <p key={i} className="text-xs font-mono text-gray-600 bg-gray-50 rounded px-2 py-1">
                {path.join(' → ')}
              </p>
            ))}
            {result.causal_paths.length > 5 && (
              <p className="text-xs text-gray-400">
                +{result.causal_paths.length - 5} more paths
              </p>
            )}
          </div>
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="space-y-1">
          {result.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 border border-amber-100">
              ⚠ {w}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
