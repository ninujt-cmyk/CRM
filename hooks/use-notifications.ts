"use client"

import { useState, useEffect } from "react"
import { subscribeUser } from "@/lib/notifications/push"

export function useNotifications() {
  const [isPermissionGranted, setIsPermissionGranted] = useState(false)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    // Check if notifications are supported
    setIsSupported("Notification" in window && "serviceWorker" in navigator)

    // Check current permission status
    if ("Notification" in window) {
      setIsPermissionGranted(Notification.permission === "granted")
    }
  }, [])

  const requestPermission = async () => {
    if (!isSupported) {
      throw new Error("Notifications not supported")
    }

    const permission = await Notification.requestPermission()
    setIsPermissionGranted(permission === "granted")

    if (permission === "granted") {
      await subscribeUser()
    }

    return permission
  }

  const sendNotification = (title: string, options?: NotificationOptions) => {
    if (!isPermissionGranted) {
      console.warn("Notification permission not granted")
      return
    }

    return new Notification(title, {
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      ...options,
    })
  }

  return {
    isPermissionGranted,
    isSupported,
    requestPermission,
    sendNotification,
  }
}
