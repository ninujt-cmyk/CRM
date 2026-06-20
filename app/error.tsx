"use client" // Error components must be Client Components

import { useEffect, useState } from "react"
import { AlertTriangle, Mail, RefreshCw, Home } from "lucide-react"
import Link from "next/link"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [currentUrl, setCurrentUrl] = useState<string>("")

  useEffect(() => {
    // Log the error to an error reporting service if you have one
    console.error("Global Error Boundary caught:", error)
    
    // Safely get the URL where the error occurred
    if (typeof window !== "undefined") {
      setCurrentUrl(window.location.href)
    }
  }, [error])

  // Construct the mailto link dynamically
  const emailAddress = "accounts@hanva.in"
  const emailSubject = encodeURIComponent("System Error Report - CRM")
  const emailBody = encodeURIComponent(
    `Hello Support,\n\nI encountered an error on the CRM platform.\n\n` +
    `-- Error Details --\n` +
    `URL: ${currentUrl}\n` +
    `Message: ${error.message || "Unknown error"}\n` +
    `Digest: ${error.digest || "N/A"}\n` +
    `Time: ${new Date().toISOString()}\n\n` +
    `-- Additional Context (Please type any details below) --\n`
  )

  const mailtoLink = `mailto:${emailAddress}?subject=${emailSubject}&body=${emailBody}`

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 shadow-xl rounded-2xl max-w-lg w-full p-8 text-center animate-in fade-in zoom-in duration-300">
        <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>
        
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">
          Oops! Something went wrong.
        </h1>
        
        <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm leading-relaxed">
          We apologize for the inconvenience. An unexpected error has occurred in the system. Our team has been notified automatically, but you can also send us a direct report.
        </p>

        <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-lg mb-8 text-left border border-slate-100 dark:border-slate-800">
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400 break-words line-clamp-3">
            <span className="font-bold text-slate-700 dark:text-slate-300">Error:</span> {error.message || "An unknown system error occurred"}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={mailtoLink}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <Mail className="h-4 w-4" />
            Report Issue
          </a>
          
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold py-2.5 px-6 rounded-xl transition-all active:scale-95"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
          <Link href="/admin" className="text-sm font-medium text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center gap-1.5 transition-colors">
            <Home className="h-3.5 w-3.5" /> Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
