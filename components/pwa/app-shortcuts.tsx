"use client"

import { useEffect } from "react"

interface AppShortcut {
  name: string
  shortName: string
  description: string
  url: string
  icons: Array<{
    src: string
    sizes: string
  }>
}

export function AppShortcuts() {
  useEffect(() => {
    // Register app shortcuts when component mounts
    if ("navigator" in window && "setAppBadge" in navigator) {
      // App badge API is available
      console.log("App badge API is supported")
    }

    // Listen for shortcut activations
    const handleShortcut = (event: Event) => {
      const customEvent = event as CustomEvent
      console.log("Shortcut activated:", customEvent.detail)
    }

    window.addEventListener("shortcut", handleShortcut)

    return () => {
      window.removeEventListener("shortcut", handleShortcut)
    }
  }, [])

  return null // This component doesn't render anything
}

// Hook to manage app shortcuts
export function useAppShortcuts() {
  const updateBadge = (count: number) => {
    if ("navigator" in window && "setAppBadge" in navigator) {
      if (count > 0) {
        ;(navigator as any).setAppBadge(count)
      } else {
        ;(navigator as any).clearAppBadge()
      }
    }
  }

  const clearBadge = () => {
    if ("navigator" in window && "clearAppBadge" in navigator) {
      ;(navigator as any).clearAppBadge()
    }
  }

  return {
    updateBadge,
    clearBadge,
  }
}
