import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from '@vercel/analytics/next'
import "./globals.css"

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
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={GeistSans.className}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
