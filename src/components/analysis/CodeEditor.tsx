"use client"

import { useRef, KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  language: 'r' | 'python'
  disabled?: boolean
  className?: string
}

export function CodeEditor({ value, onChange, disabled, className }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = textareaRef.current!
      const start = el.selectionStart
      const end = el.selectionEnd
      const newValue = value.substring(0, start) + '  ' + value.substring(end)
      onChange(newValue)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2
      })
    }
  }

  return (
    <div className={cn('relative font-mono text-sm', className)}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        spellCheck={false}
        className={cn(
          'w-full h-full resize-none bg-zinc-950 text-zinc-100 p-4 rounded-md',
          'focus:outline-none focus:ring-2 focus:ring-primary/50',
          'font-mono text-sm leading-relaxed',
          'placeholder:text-zinc-600',
          disabled && 'opacity-60 cursor-not-allowed'
        )}
        placeholder={`# Write your code here...\n`}
      />
    </div>
  )
}
