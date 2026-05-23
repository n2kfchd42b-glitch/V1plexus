import { AlertCircle } from "lucide-react"

interface Props {
  feature: string
}

/**
 * Visible "preview only" banner for thesis-workspace flows whose backend
 * isn't yet implemented. Surfaces honest state so reviewers/demos don't
 * mistake the UI for a working feature.
 */
export function UnfinishedFeatureBanner({ feature }: Props) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        <strong>Preview only.</strong> {feature} is not yet connected to the
        backend — actions on this screen are disabled.
      </span>
    </div>
  )
}
