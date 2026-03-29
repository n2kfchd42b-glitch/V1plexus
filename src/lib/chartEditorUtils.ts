export function hexToRgba(hex: string, opacity: number): string {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return `rgba(0,0,0,${opacity})`
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${opacity})`
}
