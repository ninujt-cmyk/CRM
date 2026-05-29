"use client"

import { NotificationPermission } from "@/components/notification-permission"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { PWAUpdatePrompt } from "@/components/pwa-update-prompt"
import { AppStatusBar } from "@/components/pwa/app-status-bar"
import { NativeInteractions } from "@/components/pwa/native-interactions"
import { AppShortcuts } from "@/components/pwa/app-shortcuts"
import { OfflineIndicator } from "@/components/offline-indicator"

import { useEffect } from "react"
import { toast } from "sonner"

export default function PWAComponents() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("SW registered: ", registration)
          })
          .catch((registrationError) => {
            console.log("SW registration failed: ", registrationError)
          })
      })
    }
  }, [])



  return (
    <>
      <AppStatusBar />
      <NativeInteractions />
      <AppShortcuts />
      <NotificationPermission />

      <PWAInstallPrompt />
      <PWAUpdatePrompt />
      <OfflineIndicator />
    </>
  )
}
