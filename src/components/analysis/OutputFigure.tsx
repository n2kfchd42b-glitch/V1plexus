"use client"

interface OutputFigureProps {
  src: string
  title?: string | null
  alt?: string
}

export function OutputFigure({ src, title, alt }: OutputFigureProps) {
  return (
    <div className="space-y-1">
      {title && <p className="text-sm font-medium">{title}</p>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? title ?? 'Analysis figure'}
        className="max-w-full rounded-md border"
      />
    </div>
  )
}
