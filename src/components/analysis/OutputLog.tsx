"use client"

import { ScrollArea } from '@/components/ui/scroll-area'

interface OutputLogProps {
  log: string
}

export function OutputLog({ log }: OutputLogProps) {
  return (
    <ScrollArea className="h-64 w-full">
      <pre className="text-xs font-mono bg-zinc-950 text-zinc-200 p-4 rounded-md whitespace-pre-wrap">
        {log || <span className="text-zinc-500">No output</span>}
      </pre>
    </ScrollArea>
  )
}
