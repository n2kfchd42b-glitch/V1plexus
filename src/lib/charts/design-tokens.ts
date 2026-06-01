// PLEXUS Empirical Canvas — Chart Design System Tokens
// Data palette: colour-blind safe (Wong 2011 + extended)
// UI chrome: matches globals.css light-mode design system

export const CHART_TOKENS = {
  palette: {
    teal:   { solid: '#3fb8b0', mid: 'rgba(63,184,176,0.4)',   dim: 'rgba(63,184,176,0.10)' },
    gold:   { solid: '#d4a853', mid: 'rgba(212,168,83,0.4)',   dim: 'rgba(212,168,83,0.10)' },
    rose:   { solid: '#e05c7a', mid: 'rgba(224,92,122,0.4)',   dim: 'rgba(224,92,122,0.10)' },
    violet: { solid: '#8b7cf8', mid: 'rgba(139,124,248,0.4)',  dim: 'rgba(139,124,248,0.10)' },
    sage:   { solid: '#6cb68c', mid: 'rgba(108,182,140,0.4)',  dim: 'rgba(108,182,140,0.10)' },
    amber:  { solid: '#e8944a', mid: 'rgba(232,148,74,0.4)',   dim: 'rgba(232,148,74,0.10)' },
    sky:    { solid: '#5ba4d4', mid: 'rgba(91,164,212,0.4)',   dim: 'rgba(91,164,212,0.10)' },
    slate:  { solid: '#8b949e', mid: 'rgba(139,148,158,0.4)', dim: 'rgba(139,148,158,0.10)' },
  },

  // Ordered sequence for auto-assignment
  sequence: ['teal', 'gold', 'rose', 'violet', 'sage', 'amber', 'sky', 'slate'] as const,

  // Solid colours in sequence order — for fills, strokes, and markers.
  solidSequence: [
    '#3fb8b0', '#d4a853', '#e05c7a', '#8b7cf8',
    '#6cb68c', '#e8944a', '#5ba4d4', '#8b949e',
  ],

  // Darkened, same-hue variants for COLOURED TEXT on white. The bright solids
  // above sit at ~2–3.5:1 on white and fail WCAG AA (4.5:1) for small numbers;
  // these all clear 4.6:1 while preserving the hue cue. Use for any palette-
  // coloured statistic, p-value, or label — never use solidSequence as text.
  textSequence: [
    '#297f7a', '#966e22', '#c52146', '#2106df',
    '#3d805a', '#b45e13', '#2979ad', '#68727d',
  ],

  // Mid (40% opacity) — used for fills & active pills
  midSequence: [
    'rgba(63,184,176,0.4)',  'rgba(212,168,83,0.4)',  'rgba(224,92,122,0.4)',
    'rgba(139,124,248,0.4)', 'rgba(108,182,140,0.4)', 'rgba(232,148,74,0.4)',
    'rgba(91,164,212,0.4)',  'rgba(139,148,158,0.4)',
  ],

  // Dim (10% opacity) — used for subtle tinted backgrounds
  dimSequence: [
    'rgba(63,184,176,0.10)',  'rgba(212,168,83,0.10)',  'rgba(224,92,122,0.10)',
    'rgba(139,124,248,0.10)', 'rgba(108,182,140,0.10)', 'rgba(232,148,74,0.10)',
    'rgba(91,164,212,0.10)',  'rgba(139,148,158,0.10)',
  ],

  // ── UI Chrome — matches globals.css light-mode surfaces ──────────────────
  // These mirror the CSS vars in globals.css exactly.
  bg: {
    base:     '#f7f9fb',   // --bg-app
    surface:  '#ffffff',   // --bg-surface / --card
    elevated: '#f3f4f6',   // panel sidebars (light gray)
    card:     '#f0f0f0',   // --bg-inset (inputs, inactive pills)
  },

  // Text — from globals.css --text-* vars
  text: {
    primary:   '#18181B',  // --text-primary
    secondary: '#52525B',  // --text-secondary
    muted:     '#A1A1AA',  // --text-tertiary
  },

  // Borders — from globals.css --border-* vars
  border:       '#E4E4E7',              // --border-default
  borderActive: '#D4D4D8',              // --border-strong

  // Grid lines (subtle on white)
  grid: 'rgba(0,24,72,0.06)',

  // Fonts — loaded globally via next/font
  fonts: {
    sans: "'Manrope', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },

  // Shadows — matches globals.css --shadow-* scale
  shadow: {
    ambient: '0 20px 50px rgba(0,24,72,0.04), 0 4px 12px rgba(0,24,72,0.03)',
    card:    '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.04)',
  },

  radius: {
    base: '12px',  // rounded-xl in Tailwind config
    sm:   '8px',   // rounded-lg
    xs:   '6px',   // rounded-md
  },
} as const

export type PaletteName = keyof typeof CHART_TOKENS.palette

// Helper: get solid colour at index (wraps) — for fills/strokes/markers.
export function chartColor(index: number): string {
  return CHART_TOKENS.solidSequence[index % CHART_TOKENS.solidSequence.length]
}

// Helper: get the WCAG-AA text colour at index (wraps) — for coloured numbers/labels.
export function chartTextColor(index: number): string {
  return CHART_TOKENS.textSequence[index % CHART_TOKENS.textSequence.length]
}

// Helper: get mid colour at index (wraps)
export function chartColorMid(index: number): string {
  return CHART_TOKENS.midSequence[index % CHART_TOKENS.midSequence.length]
}

// Helper: get dim colour at index (wraps)
export function chartColorDim(index: number): string {
  return CHART_TOKENS.dimSequence[index % CHART_TOKENS.dimSequence.length]
}

// Shared axis tick style for Recharts
export const AXIS_TICK_STYLE = {
  fontSize: 11,
  fill: CHART_TOKENS.text.secondary,
  fontFamily: 'Manrope, sans-serif',
}

// Shared grid style
export const GRID_STYLE = {
  stroke: CHART_TOKENS.grid,
  strokeDasharray: '3 6',
}
