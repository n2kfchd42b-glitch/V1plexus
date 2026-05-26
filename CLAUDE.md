# CLAUDE.md — Plexus

Plexus is an institution-grade research management platform built with Next.js, React 19, TypeScript, Supabase, and TipTap. It covers the full research lifecycle: project design, ethics, data collection, statistical analysis, collaborative writing, and publication.

---

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run type-check   # Run tsc --noEmit (run this before finishing any task)
npm run lint         # ESLint
```

There is no test suite. Correctness is verified via type-checking and manual QA.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js App Router (src/app/) |
| Language | TypeScript 5 (strict) |
| UI primitives | Radix UI |
| Styling | Tailwind CSS 3.4 + CSS variables |
| Component variants | class-variance-authority (CVA) |
| Rich text | TipTap 2 + Yjs CRDT |
| Auth + DB | Supabase (PostgreSQL + Realtime) |
| State | React Context (auth), Zustand (complex client state) |
| Forms | react-hook-form + Zod |
| Charts | Recharts 3 |
| AI | Anthropic SDK (@anthropic-ai/sdk) |
| Drag & drop | @dnd-kit |
| Toasts | Sonner |

---

## Directory Map

```
src/
  app/
    (auth)/           # Login, register, setup, invite
    (dashboard)/      # All authenticated routes
      projects/       # Project lifecycle pages
      settings/       # User & workspace settings
      approvals/      # Review & approval workflows
      audit/          # Audit logs
      compliance/     # Compliance features
      notifications/  # Notification center
    (public)/         # Public registry, dataset hub, profiles
    api/              # Next.js API routes (serverless)
  components/         # ~300 components, organized by feature domain
    ui/               # Base primitives (Button, Card, Input, etc.)
    layout/           # Header, Sidebar, CommandPalette
    analysis/         # Analysis UI
    document/         # TipTap editor & viewers
    approval/         # Approval workflow UI
    charts/           # Recharts wrappers
    ai/               # Claude integration components
    [feature]/        # All other domain components
  hooks/              # Custom React hooks
  lib/
    supabase/         # Supabase client & helpers
    analysis/         # Statistical engine (descriptive, regression, tests, etc.)
    decision-engine/  # Analysis recommendation & workflow builder
    [utilities]
  types/
    database.ts       # Hand-curated TypeScript mirror of the Supabase schema
    [feature].ts      # Domain-specific types
  middleware.ts       # Supabase auth guard (protects all dashboard routes)
```

---

## Code Conventions

### Components
- Functional components with named TypeScript interfaces
- Use `cn()` (clsx + tailwind-merge) for all className merging — never concatenate strings
- Use CVA for components with multiple visual variants
- Use Radix UI primitives for anything interactive (dialogs, dropdowns, tooltips, etc.)
- Set `displayName` on components that use `forwardRef`

### Styling
- Tailwind-first. Use CSS variables (`var(--bg-surface)`, `var(--text-primary)`) for dynamic theming
- Dark mode is class-based (`dark:`)
- Custom color tokens live in `tailwind.config.ts` — do not hardcode hex values
- Phase colors: `concept`, `protocol`, `ethics`, `data`, `analysis`, `writing`, `publication`
- Status colors: `success`, `warning`, `error`, `info`
- Custom fonts loaded via `src/app/layout.tsx`: Geist Sans/Mono, Instrument Serif, Manrope, Inter, Lora
- The empirical-canvas skill enforces design rules — activate it for any UI/styling task

### API Routes
- File: `src/app/api/[resource]/route.ts`
- Export named async handlers: `GET`, `POST`, `PUT`, `DELETE`
- Use Supabase client from `src/lib/supabase/` for all DB access
- Return typed JSON with proper HTTP status codes
- Validate request bodies with Zod before processing

### Authentication
- Single Supabase client instance (singleton in `src/lib/supabase/`)
- Auth state via `AuthContext` + `useAuth()` hook — do not create new Supabase auth subscriptions
- Route protection is handled by `src/middleware.ts` — do not duplicate auth checks in page components
- User profiles are auto-created on signup

### Database
- Table names: `lowercase_with_underscores`
- All schema types come from `src/types/database.ts` — use them, do not define ad-hoc inline types for DB rows
- `src/types/database.ts` is hand-curated as `export interface Foo { ... }`, not the Supabase generator's `Database['public']['Tables']['x']['Row']` shape. When you add tables or columns, extend this file by hand and keep the existing style. Running `supabase gen types typescript` would overwrite it with an incompatible shape and break every import.
- Realtime subscriptions are used for live updates — clean them up in `useEffect` returns

### State Management
- Auth state: React Context only
- Complex client state: Zustand
- Local component state: `useState`/`useReducer`
- Persisted local state: `usePersistedState` hook (wraps localStorage)

### Forms
- `react-hook-form` for form state
- `Zod` schemas for validation
- Always validate at the API boundary, not just in the UI

---

## Key Architectural Patterns

### Analysis Engine
The statistical engine lives in `src/lib/analysis/`. It is modular:
- `descriptive.ts`, `frequencies.ts`, `regression.ts`, `tests.ts`, `multivariate.ts`, `special.ts`
- Orchestrated by `src/lib/analysisEngine.ts`
- The decision engine (`src/lib/decision-engine/`) recommends analyses based on data characteristics

When adding a new analysis type, register it in `analysisRegistry.ts` and add feasibility logic in `feasibilityChecker.ts`.

### Real-Time Collaboration
- TipTap editor synced via Yjs CRDT
- Supabase Realtime Broadcast is the WebSocket transport layer
- Collaboration helpers: `src/lib/collaboration.ts`

### Approval Workflows
- Multi-stage review system — approvals gate project progression
- Logic in `src/lib/approval*/` and types in `src/types/approvals.ts`

### Verification
- Research outputs can be publicly verified via hash
- Public verification pages at `/verify/`

---

## What Not to Do

- Do not mock Supabase in tests — there are none, and mocking would diverge from prod behavior
- Do not create new Supabase auth subscriptions; use `useAuth()` hook
- Do not hardcode colors — use Tailwind tokens or CSS variables
- Do not add features, refactors, or improvements beyond what was asked
- Do not add error handling for impossible scenarios — trust Supabase and Next.js guarantees
- Do not use `find`, `grep`, `cat` in bash when dedicated tools exist
- The `_phase7/` directory is legacy/experimental — do not modify it unless explicitly asked
- Do not run `supabase gen types typescript` against `src/types/database.ts` — it's hand-curated and the generator's shape is incompatible

---

## Path Alias

`@/*` maps to `./src/*`. Use this for all imports.

```ts
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"
```
