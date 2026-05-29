"use client"

import type React from "react"
import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useLeadAssignmentNotifications } from "@/hooks/use-lead-assignment-notifications"
import { notificationService } from "@/lib/notification-service"
import { toast } from "sonner"
import { Bell, BellOff } from "lucide-react"

interface NotificationProviderProps {
  children: React.ReactNode
  userId?: string
}

// Helper to convert VAPID key for browser compatibility
const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function NotificationProvider({ children, userId }: NotificationProviderProps) {
  const supabase = createClient()
  const mounted = useRef(false)

  // 1. Setup Supabase Realtime Listeners (In-App Notifications)
  useLeadAssignmentNotifications(userId)

  useEffect(() => {
    if (!userId || mounted.current) return
    mounted.current = true

    const setupNotifications = async () => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) {
        console.warn("Notifications/SW not supported in this browser.")
        return
      }

      // 2. Register Service Worker
      try {
        const registration = await navigator.serviceWorker.register("/sw.js")
        
        // 3. Handle Permission Logic (The "Polite" Way)
        if (Notification.permission === "default") {
          // Don't ask immediately. Show a toast UI allowing the user to opt-in.
          toast("Enable Notifications?", {
            description: "Get instant alerts when new leads are assigned to you.",
            action: {
              label: "Enable",
              onClick: () => requestPermissionAndSubscribe(registration),
            },
            cancel: {
              label: "Later",
              onClick: () => console.log("User dismissed notification prompt"),
            },
            duration: 8000,
            icon: <Bell className="h-4 w-4 text-blue-500" />
          })
        } else if (Notification.permission === "granted") {
          // Already granted? Ensure subscription is active/fresh
          await subscribeToPush(registration)
        }
      } catch (error) {
        console.error("Service Worker registration failed:", error)
      }
    }

    setupNotifications()
  }, [userId])

  // 4. Request Browser Permission
  const requestPermissionAndSubscribe = async (registration: ServiceWorkerRegistration) => {
    const permission = await notificationService.requestPermission()
    if (permission === "granted") {
      toast.success("Notifications Enabled", { description: "You will now receive lead alerts." })
      await subscribeToPush(registration)
    } else {
      toast.error("Notifications Blocked", { 
        description: "Please enable them in browser settings to receive alerts.",
        icon: <BellOff className="h-4 w-4" />
      })
    }
  }

  // 5. Subscribe to Push Manager & Sync with Supabase
  const subscribeToPush = async (registration: ServiceWorkerRegistration) => {
    try {
      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription()

      // If not, create new subscription
      if (!subscription) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidPublicKey) return

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })
      }

      // 6. Send Subscription to Backend (Upsert)
      if (subscription && userId) {
        const { error } = await supabase
          .from("push_subscriptions")
          .upsert({ 
            user_id: userId, 
            endpoint: subscription.endpoint,
            p256dh: subscription.toJSON().keys?.p256dh,
            auth: subscription.toJSON().keys?.auth,
            updated_at: new Date().toISOString()
          }, { onConflict: 'endpoint' })

        if (error) console.error("Failed to sync push subscription:", error)
      }
    } catch (error) {
      console.error("Push subscription error:", error)
    }
  }

  return <>{children}</>
}
