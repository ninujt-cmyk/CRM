"use client" // Error components must be Client Components

import { useEffect, useState } from "react"
import { AlertTriangle, Mail, RefreshCw } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [currentUrl, setCurrentUrl] = useState<string>("")

  useEffect(() => {
    console.error("Critical Global Error caught:", error)
    if (typeof window !== "undefined") {
      setCurrentUrl(window.location.href)
    }
  }, [error])

  const emailAddress = "accounts@hanva.in"
  const emailSubject = encodeURIComponent("Critical System Error Report - CRM")
  const emailBody = encodeURIComponent(
    `Hello Support,\n\nI encountered a critical error on the CRM platform.\n\n` +
    `-- Error Details --\n` +
    `URL: ${currentUrl}\n` +
    `Message: ${error.message || "Unknown error"}\n` +
    `Digest: ${error.digest || "N/A"}\n` +
    `Time: ${new Date().toISOString()}\n\n` +
    `-- Additional Context --\n`
  )

  const mailtoLink = `mailto:${emailAddress}?subject=${emailSubject}&body=${emailBody}`

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
          <div className="bg-white border border-red-100 shadow-xl rounded-2xl max-w-lg w-full p-8 text-center">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="h-10 w-10 text-red-500" />
            </div>
            
            <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
              Critical System Failure
            </h1>
            
            <p className="text-slate-500 mb-6 text-sm leading-relaxed">
              We apologize, but a critical error prevented the application from loading. Please report this issue so our engineers can investigate immediately.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={mailtoLink}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-all shadow-sm"
              >
                <Mail className="h-4 w-4" />
                Report Issue
              </a>
              
              <button
                onClick={() => reset()}
                className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold py-2.5 px-6 rounded-xl transition-all"
              >
                <RefreshCw className="h-4 w-4" />
                Reload Application
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
