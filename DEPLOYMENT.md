# Deployment

Plexus is **two deployables**. This is intentional — they have different runtimes
and scaling profiles — but it means each deploy config below targets exactly one of them.

| Component | Runtime | Host | Config |
|---|---|---|---|
| Web app (Next.js 16) | Node | **Vercel** | [`vercel.json`](./vercel.json) |
| Analytics service (FastAPI) | Python 3.11 | **Fly.io** | [`Dockerfile`](./Dockerfile), [`fly.toml`](./fly.toml) |

The web app calls the analytics service over HTTP via `ANALYTICS_API_URL`
(see [`src/lib/analyticsService.ts`](./src/lib/analyticsService.ts)). That variable is
**required in production** — the app fails loud if it is missing rather than silently
pointing at `localhost`.

## Web app → Vercel

- Framework preset: Next.js. Build/dev/install commands and cron schedules live in `vercel.json`.
- Required env vars: see [`.env.local.example`](./.env.local.example). At minimum:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `ANTHROPIC_API_KEY`, `ANALYTICS_API_URL`, `CRON_SECRET`, `RESEND_API_KEY`.
- Cron jobs (`/api/cron/deadline-sweep`) are defined in `vercel.json` and authenticated
  with `CRON_SECRET`.

## Analytics service → Fly.io

```bash
fly deploy            # builds Dockerfile, deploys to the "plexus-analytics" app
```

- App name: `plexus-analytics`, region `cdg`. See `fly.toml`.
- Health check: `GET /analytics/health`.
- After deploying, set the web app's `ANALYTICS_API_URL` to the Fly service URL.
- Required env vars on the analytics service:
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — DB/storage access.
  - `SUPABASE_JWT_SECRET` — enables local HS256 token verification (no network
    round-trip per request). Found in Supabase → Settings → API → JWT Secret.
    If omitted, the service falls back to validating every token over the network.
  - `ALLOWED_ORIGINS` — comma-separated web origins for CORS.

> **Note:** Railway was an earlier host for the analytics service and has been
> superseded by Fly.io (commit `cbd26bc`). The `railway.toml` config was removed to
> avoid two competing configs for the same service. To re-host on Railway, point it
> at the same `Dockerfile`.

## Turning the analytics service off (to stop Fly.io billing)

The analytics service is optional. To take it down without breaking the app:

1. **Destroy the Fly app** (a machine runs continuously per `min_machines_running = 1`):
   ```bash
   fly apps destroy plexus-analytics
   ```
2. **In Vercel**, set `NEXT_PUBLIC_ANALYTICS_ENABLED=false` and remove (or blank)
   `ANALYTICS_API_URL`, then redeploy.

With the flag off, every analytics-dependent API route returns a clean `503
{ unavailable: true }` and the dependent UI (causal inference, sensitivity,
research-output packaging, verification) is hidden — no 500s, no hangs. The
browser-based core statistical engine and the rest of the app keep working.

To bring it back: `fly deploy` the `Dockerfile`, set `ANALYTICS_API_URL` to the
Fly URL, and set `NEXT_PUBLIC_ANALYTICS_ENABLED=true`.

## CI

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) gates every push and PR to `main`:

- **web**: `npm ci` → `type-check` → `lint` → `build`
- **analytics**: `pip install` → `pytest apps/analytics/tests`
