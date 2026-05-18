import { cn } from '@/lib/utils'

type VerifyVariant = 'verified' | 'broken' | 'pending'

interface Props {
  variant?: VerifyVariant
  className?: string
}

export function VerifyBadge({ variant = 'verified', className }: Props) {
  if (variant === 'pending') {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium font-mono',
        'bg-white text-text-tertiary border border-dashed border-border-default',
        className
      )}>
        <span className="w-2.5 h-2.5 rounded-full border border-dashed border-text-tertiary" />
        DRAFT
      </span>
    )
  }

  if (variant === 'broken') {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold font-mono',
        'bg-status-error-bg text-status-error border border-red-300',
        className
      )}>
        <span className="inline-flex items-center justify-center w-2.5 h-2.5 rounded-full bg-status-error text-white text-[7px] font-bold">!</span>
        BROKEN
      </span>
    )
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold font-mono tracking-wide',
      'bg-status-success-bg text-status-success border border-green-200',
      className
    )}>
      <span className="inline-flex items-center justify-center w-2.5 h-2.5 rounded-full bg-status-success text-white text-[7px] font-bold">✓</span>
      VERIFIED
    </span>
  )
}
