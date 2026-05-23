import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Manrope, Inter, Instrument_Serif, Lora } from "next/font/google"
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { KeepaliveProvider } from '@/components/layout/KeepaliveProvider'
import { ConnectionGuard } from '@/components/layout/ConnectionGuard'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { LocaleProvider } from '@/i18n/LocaleProvider'
import { SupabaseLockSuppressor } from '@/components/SupabaseLockSuppressor'
import { OfflineStatusBar } from '@/components/layout/OfflineStatusBar'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { SyncProvider } from '@/components/layout/SyncProvider'
import { SyncStatusIndicator } from '@/components/layout/SyncStatusIndicator'
import { PendingJobsIndicator } from '@/components/analysis/PendingJobsIndicator'
import "./globals.css"

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
  display: "swap",
})

const lora = Lora({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-document",
  display: "swap",
})

export const metadata: Metadata = {
  title: "PLEXUS Research Lab",
  description: "Institution-grade research management platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PLEXUS",
  },
}

export const viewport: Viewport = {
  themeColor: "#003d9b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${manrope.variable} ${inter.variable} ${instrumentSerif.variable} ${lora.variable}`}>
      <head>
        {/* Preconnect to reduce DNS + TLS handshake time for critical third-party origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="preconnect" href="https://dsswjchsnayhngjkbbed.supabase.co" />
        {/* Load Material Symbols without blocking initial paint */}
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
        <link
          id="material-symbols-css"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
          media="print"
          suppressHydrationWarning
        />
        <Script id="material-symbols-load" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: `(function(){var l=document.getElementById('material-symbols-css');if(l)l.addEventListener('load',function(){l.media='all'})})()` }} />
        <noscript>
          <link
            href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
            rel="stylesheet"
          />
        </noscript>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        {/* Unregister any stale service workers so cached JS chunks never block updates */}
        <Script id="sw-cleanup" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(regs) {
              regs.forEach(function(reg) { reg.unregister(); });
            });
            caches.keys().then(function(names) {
              names.forEach(function(name) { caches.delete(name); });
            });
          }
        ` }} />
      </head>
      <body className={GeistSans.className}>
        <OfflineStatusBar />
        <SyncStatusIndicator />
        <PendingJobsIndicator />
        <LocaleProvider>
          <AuthProvider>
            <SyncProvider>
              <KeepaliveProvider>
                <ConnectionGuard>
                  {children}
                </ConnectionGuard>
              </KeepaliveProvider>
            </SyncProvider>
          </AuthProvider>
        </LocaleProvider>
        <SupabaseLockSuppressor />
        <Analytics />
        <SpeedInsights />
        <InstallPrompt />
      </body>
    </html>
  )
}
