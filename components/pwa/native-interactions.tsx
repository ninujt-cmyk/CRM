"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

// Hook for native-like interactions
export function useNativeInteractions() {
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if running in standalone mode
    const checkStandalone = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone
      setIsStandalone(standalone)
    }

    checkStandalone()
    window.addEventListener("resize", checkStandalone)

    // Prevent default behaviors that break app-like experience
    const preventDefaults = (e: Event) => {
      // Prevent pull-to-refresh on iOS
      if ((e.target as Element)?.tagName === "BODY") {
        e.preventDefault()
      }
    }

    // Prevent zoom on double tap
    let lastTouchEnd = 0
    const preventZoom = (e: TouchEvent) => {
      const now = new Date().getTime()
      if (now - lastTouchEnd <= 300) {
        e.preventDefault()
      }
      lastTouchEnd = now
    }

    // Prevent context menu on long press
    const preventContextMenu = (e: Event) => {
      if (isStandalone) {
        e.preventDefault()
      }
    }

    // Add event listeners
    document.addEventListener("touchmove", preventDefaults, { passive: false })
    document.addEventListener("touchend", preventZoom, { passive: false })
    document.addEventListener("contextmenu", preventContextMenu)

    // Handle app state changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("App went to background")
      } else {
        console.log("App came to foreground")
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Handle app installation
    const handleAppInstalled = () => {
      toast.success("App installed successfully!")
    }

    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("resize", checkStandalone)
      document.removeEventListener("touchmove", preventDefaults)
      document.removeEventListener("touchend", preventZoom)
      document.removeEventListener("contextmenu", preventContextMenu)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [isStandalone])

  return { isStandalone }
}

// Component for native-like haptic feedback
export function useHapticFeedback() {
  const vibrate = (pattern: number | number[]) => {
    if ("vibrate" in navigator) {
      navigator.vibrate(pattern)
    }
  }

  const lightImpact = () => vibrate(10)
  const mediumImpact = () => vibrate(20)
  const heavyImpact = () => vibrate(30)
  const success = () => vibrate([10, 50, 10])
  const warning = () => vibrate([20, 100, 20])
  const error = () => vibrate([50, 100, 50, 100, 50])

  return {
    vibrate,
    lightImpact,
    mediumImpact,
    heavyImpact,
    success,
    warning,
    error,
  }
}

// Component for app-like animations
export function NativeInteractions() {
  useNativeInteractions()
  return null
}
