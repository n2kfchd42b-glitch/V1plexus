import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'JetBrains Mono', 'monospace'],
        display: ['var(--font-instrument-serif)', 'Georgia', 'serif'],
      },
      fontSize: {
        xs:   ['0.6875rem', { lineHeight: '1rem' }],
        sm:   ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem',  { lineHeight: '1.375rem' }],
        lg:   ['1rem',      { lineHeight: '1.5rem' }],
        xl:   ['1.25rem',   { lineHeight: '1.75rem' }],
        '2xl':['1.5rem',    { lineHeight: '2rem' }],
        '3xl':['2rem',      { lineHeight: '2.5rem' }],
      },
      colors: {
        // Surfaces
        'bg-app':            '#FAFAFA',
        'bg-surface':        '#FFFFFF',
        'bg-surface-hover':  '#F5F5F5',
        'bg-surface-active': '#EFEFEF',
        'bg-inset':          '#F0F0F0',
        'bg-sidebar':        '#18181B',
        'bg-sidebar-hover':  '#27272A',
        'bg-sidebar-active': '#3F3F46',
        // Borders
        'border-default':  '#E4E4E7',
        'border-subtle':   '#F0F0F0',
        'border-strong':   '#D4D4D8',
        'border-focus':    '#3B82F6',
        // Text
        'text-primary':        '#18181B',
        'text-secondary':      '#52525B',
        'text-tertiary':       '#A1A1AA',
        'text-inverse':        '#FAFAFA',
        'text-sidebar':        '#A1A1AA',
        'text-sidebar-active': '#FAFAFA',
        // Accent
        'accent-primary':      '#1B3A5C',
        'accent-blue':         '#3B82F6',
        'accent-blue-subtle':  '#EFF6FF',
        // Status
        'status-success':       '#22C55E',
        'status-success-bg':    '#F0FDF4',
        'status-success-text':  '#166534',
        'status-warning':       '#F59E0B',
        'status-warning-bg':    '#FFFBEB',
        'status-warning-text':  '#92400E',
        'status-error':         '#EF4444',
        'status-error-bg':      '#FEF2F2',
        'status-error-text':    '#991B1B',
        'status-info':          '#3B82F6',
        'status-info-bg':       '#EFF6FF',
        'status-info-text':     '#1E40AF',
        // Phase colors
        'phase-concept':     '#A1A1AA',
        'phase-protocol':    '#3B82F6',
        'phase-ethics':      '#F59E0B',
        'phase-data':        '#8B5CF6',
        'phase-analysis':    '#EC4899',
        'phase-writing':     '#14B8A6',
        'phase-publication': '#22C55E',
        // Radix shadcn compatibility
        border:     'hsl(var(--border))',
        input:      'hsl(var(--input))',
        ring:       'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      spacing: {
        '0':  '0',
        '1':  '0.25rem',
        '2':  '0.5rem',
        '3':  '0.75rem',
        '4':  '1rem',
        '5':  '1.25rem',
        '6':  '1.5rem',
        '8':  '2rem',
        '10': '2.5rem',
        '12': '3rem',
        '16': '4rem',
      },
      borderRadius: {
        sm:   '4px',
        md:   '6px',
        DEFAULT: '6px',
        lg:   '8px',
        xl:   '12px',
        full: '9999px',
      },
      boxShadow: {
        xs:    '0 1px 2px 0 rgb(0 0 0 / 0.03)',
        sm:    '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        md:    '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        lg:    '0 10px 15px -3px rgb(0 0 0 / 0.05), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
        xl:    '0 20px 25px -5px rgb(0 0 0 / 0.05), 0 8px 10px -6px rgb(0 0 0 / 0.05)',
        focus: '0 0 0 2px #ffffff, 0 0 0 4px #3B82F6',
      },
      transitionDuration: {
        instant: '75ms',
        fast:    '150ms',
        normal:  '200ms',
        slow:    '300ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        in:      'cubic-bezier(0.4, 0, 1, 1)',
        out:     'cubic-bezier(0, 0, 0.2, 1)',
        spring:  'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to:   { transform: 'translateX(0)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        shimmer:          'shimmer 1.5s infinite',
        'fade-in':        'fade-in 150ms ease-out',
        'scale-in':       'scale-in 150ms cubic-bezier(0, 0, 0.2, 1)',
        'slide-up':       'slide-up 150ms cubic-bezier(0, 0, 0.2, 1)',
        'slide-in-left':  'slide-in-left 200ms cubic-bezier(0, 0, 0.2, 1)',
        pulse:            'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
