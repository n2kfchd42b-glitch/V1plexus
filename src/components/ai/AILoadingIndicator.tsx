"use client"

export function AILoadingIndicator() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="flex gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
      </span>
      <span>AI is thinking...</span>
    </div>
  )
}
