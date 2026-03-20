import type React from "react"
// app/layout.tsx
import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "sonner"
import "./globals.css"
import { ErrorBoundary } from "@/components/error-boundary"
import { Suspense } from "react"
import PWAWrapper from "@/components/pwa-client-wrapper"

// ✅ IMPORT THE TENANT PROVIDER
import { TenantProvider } from "@/context/tenant-provider"

// ✅ IMPORT THE THEME PROVIDER
import { ThemeProvider } from "@/components/theme-provider"

const geistSans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
})

const geistMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "Hanva CRM",
  description: "Professional telecaller CRM system for lead management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Hanva CRM",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      {
        url: "/favicon1.ico",
        sizes: "any",
      },
      {
        url: "/icons/icon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/icons/icon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/icon-180x180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    {/* ✅ ADDED suppressHydrationWarning TO PREVENT NEXT-THEMES MISMATCH */}
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <head>
        <meta name="application-name" content="Hanva CRM" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Hanva CRM" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-tap-highlight" content="no" />

        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png" />
        <link rel="icon" type="image/x-icon" href="/favicon1.ico" />
        <link rel="mask-icon" href="/icons/safari-pinned-tab.svg" color="#000000" />
        <link rel="shortcut icon" href="/favicon1.ico" />
      </head>
      <body className="font-sans">
        <ErrorBoundary>
          
          {/* ✅ WRAP WITH THEME PROVIDER */}
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {/* ✅ WRAP THE ENTIRE APP IN THE TENANT PROVIDER */}
            <TenantProvider>
              
              {/* Main content */}
              {children}

              <PWAWrapper />

              {/* Toast notifications */}
              <Toaster position="top-right" richColors closeButton duration={4000} />

              <Analytics />

            </TenantProvider>
          </ThemeProvider>

        </ErrorBoundary>
      </body>
    </html>
  )
}
