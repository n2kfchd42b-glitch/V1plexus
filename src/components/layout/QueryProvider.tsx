"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

/**
 * App-wide React Query provider.
 *
 * Defaults are tuned for the platform's audience (research users, frequently on
 * low-bandwidth / metered connections):
 *  - staleTime 60s     — avoid refetching the same data on every mount.
 *  - no refetchOnWindowFocus — don't burn bandwidth re-fetching when a user
 *    tabs back; research dashboards are not second-by-second live.
 *  - retry capped at 1 — fail fast on flaky links instead of hammering.
 *
 * The client is created in state so it is stable across re-renders but unique
 * per browser session (never shared between requests on the server).
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
