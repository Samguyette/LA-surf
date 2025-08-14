import type { Metadata } from 'next'
import { Analytics } from "@vercel/analytics/next"
import './globals.css'

export const metadata: Metadata = {
  title: 'LA Surf Conditions',
  description: 'Real-time surf conditions for Los Angeles County coastline',
  keywords: ['surf', 'waves', 'Los Angeles', 'NOAA', 'conditions'],
  authors: [{ name: 'LA Surf App' }],
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'LA Surf Conditions',
    description: 'Real-time surf conditions for Los Angeles County coastline. Get live NOAA wave data, interactive maps, and smart ratings.',
    url: 'https://la-surf-conditions.vercel.app',
    siteName: 'LA Surf Conditions',
    images: [
      {
        url: '/screenshot.png',
        width: 1200,
        height: 630,
        alt: 'LA Surf Conditions - Interactive surf map for Los Angeles County coastline',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LA Surf Conditions',
    description: 'Real-time surf conditions for Los Angeles County coastline',
    images: ['/screenshot.png'],
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0ea5e9',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
