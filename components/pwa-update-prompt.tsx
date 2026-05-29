"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshCw, X } from "lucide-react"
import { toast } from "sonner"

export function PWAUpdatePrompt() {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    navigator.serviceWorker.ready.then((reg) => {
      setRegistration(reg)

      // Listen for updates
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setShowUpdatePrompt(true)
            }
          })
        }
      })
    })

    // Listen for controller change (new SW took control)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (typeof window !== "undefined") {
        window.location.reload()
      }
    })
  }, [])

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" })
      setShowUpdatePrompt(false)
      toast.success("Update applied! The app will refresh shortly.")
    }
  }

  const handleDismiss = () => {
    setShowUpdatePrompt(false)
  }

  if (!showUpdatePrompt) {
    return null
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <Card className="shadow-lg border-2 border-blue-200 bg-blue-50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg text-blue-900">Update Available</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="text-blue-700">
            A new version of the app is available with improvements and bug fixes
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2">
            <Button onClick={handleUpdate} className="flex-1 bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="h-4 w-4 mr-2" />
              Update Now
            </Button>
            <Button
              variant="outline"
              onClick={handleDismiss}
              className="border-blue-300 text-blue-700 hover:bg-blue-100 bg-transparent"
            >
              Later
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
