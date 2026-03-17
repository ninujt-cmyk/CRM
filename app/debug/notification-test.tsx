// app/debug/notification-test.tsx
"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export default function NotificationTest() {
  useEffect(() => {
    // Request notification permission when component mounts
    if ("Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
          console.log("Notification permission:", permission)
        })
      }
    }
  }, [])

  const testBrowserNotification = () => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Test Notification", {
        body: "This is a test notification from Hanva CRM",
        icon: "/icons/icon-192x192.png"
      })
    } else {
      toast.error("Notification permission not granted")
    }
  }

  const testToast = () => {
    toast.success("Test Toast", {
      description: "This is a test toast notification"
    })
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Notification Test</h1>
      
      <div className="space-y-2">
        <p>This page tests browser notifications and toast notifications.</p>
        
        <div className="flex gap-2">
          <Button onClick={testBrowserNotification}>
            Test Browser Notification
          </Button>
          <Button onClick={testToast}>
            Test Toast Notification
          </Button>
        </div>
      </div>
    </div>
  )
}
