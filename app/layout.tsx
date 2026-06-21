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

// Providers
import { TenantProvider } from "@/context/tenant-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { getGlobalTenantData } from "@/lib/supabase/server-tenant"

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const { org = null, masterStatuses = [], announcements = [] } = await getGlobalTenantData() || {};

  return (
    <html 
      lang="en" 
      suppressHydrationWarning 
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
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
          
          {/* ✅ WRAPPED IN THEME PROVIDER FIRST, THEN TENANT PROVIDER */}
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TenantProvider initialOrg={org as any} initialMasterStatuses={masterStatuses}>
              
              {/* Main content */}
              {org?.is_suspended ? (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
                  <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center space-y-6">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Workspace Suspended</h1>
                      <p className="text-slate-500 mt-2 text-sm">
                        Access to <strong>{org.name}</strong> has been temporarily suspended by the system administrator. Please contact support to resolve this issue and restore access.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {announcements && announcements.length > 0 && (
                    <div className="flex flex-col w-full relative z-[100]">
                      {announcements.map((ann: any) => (
                        <div key={ann.id} className={`w-full p-2.5 text-center text-sm font-medium border-b flex items-center justify-center gap-3 shadow-sm ${
                            ann.type === 'warning' ? "bg-amber-500 text-amber-950 border-amber-600" :
                            ann.type === 'error' ? "bg-red-500 text-white border-red-600" :
                            ann.type === 'success' ? "bg-emerald-500 text-white border-emerald-600" :
                            "bg-indigo-600 text-white border-indigo-700"
                        }`}>
                          <strong className="px-2 py-0.5 rounded bg-black/10 text-xs tracking-wider uppercase">{ann.title}</strong>
                          <span>{ann.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {children}
                </>
              )}

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
