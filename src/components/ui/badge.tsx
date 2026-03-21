import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
  {
    variants: {
      variant: {
        default:     "bg-[var(--accent-blue-subtle)] text-[var(--accent-blue)] border border-blue-200",
        secondary:   "bg-[var(--bg-surface-active)] text-[var(--text-secondary)] border border-[var(--border-default)]",
        destructive: "bg-[var(--status-error-bg)] text-[var(--status-error-text)] border border-red-200",
        outline:     "border border-[var(--border-default)] text-[var(--text-secondary)]",
        success:     "bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-green-200",
        warning:     "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-amber-200",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
