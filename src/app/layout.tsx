import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Manrope, Inter, Instrument_Serif } from "next/font/google"
import { Analytics } from '@vercel/analytics/next'
import { KeepaliveProvider } from '@/components/layout/KeepaliveProvider'
import { ConnectionGuard } from '@/components/layout/ConnectionGuard'
import { AuthProvider } from '@/components/auth/AuthProvider'
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
  themeColor: "#1B3A5C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} ${manrope.variable} ${inter.variable} ${instrumentSerif.variable}`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className={GeistSans.className}>
        <AuthProvider>
          <KeepaliveProvider>
            <ConnectionGuard>
              {children}
            </ConnectionGuard>
          </KeepaliveProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
