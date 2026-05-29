"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Wifi, WifiOff, RefreshCw, Clock, AlertCircle } from "lucide-react"
import { offlineSync } from "@/lib/offline/sync"
import { toast } from "sonner"

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true) // Default to true for SSR
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    // Set initial online status
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      setError(null)
    }
    const handleOffline = () => {
      setIsOnline(false)
      setError(null)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Update pending count periodically
    const updatePendingCount = async () => {
      try {
        const count = await offlineSync.getPendingSyncCount()
        setPendingCount(count)
        setError(null) // Clear any previous errors
      } catch (error) {
        console.error("Failed to get pending sync count:", error)
        setError("Sync data unavailable")
        // Don't set pendingCount to 0 on error, keep previous value
      }
    }

    // Initial update
    updatePendingCount()
    
    // Set up interval for periodic updates
    const interval = setInterval(updatePendingCount, 5000) // Check every 5 seconds

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      clearInterval(interval)
    }
  }, [])

  const handleManualSync = async () => {
    if (!isOnline) {
      toast.error("Cannot sync while offline")
      return
    }

    setSyncing(true)
    setError(null)
    try {
      await offlineSync.syncAll()
      // Update the count after successful sync
      const newCount = await offlineSync.getPendingSyncCount()
      setPendingCount(newCount)
      if (newCount === 0) {
        toast.success("All data synced successfully!")
      }
    } catch (error) {
      console.error("Manual sync failed:", error)
      setError("Sync failed")
      toast.error("Sync failed. Please try again.")
    } finally {
      setSyncing(false)
    }
  }

  // Don't show indicator when online and nothing to sync, unless there's an error
  if (isOnline && pendingCount === 0 && !error) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <div className="flex items-center gap-2">
        {/* Online/Offline Status */}
        <Badge variant={isOnline ? "default" : "destructive"} className="flex items-center gap-1">
          {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {isOnline ? "Online" : "Offline"}
        </Badge>

        {/* Error Indicator */}
        {error && (
          <Badge variant="outline" className="flex items-center gap-1 text-amber-600 border-amber-300 bg-amber-50">
            <AlertCircle className="h-3 w-3" />
            {error}
          </Badge>
        )}

        {/* Pending Sync Count */}
        {pendingCount > 0 && !error && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {pendingCount} pending
          </Badge>
        )}

        {/* Manual Sync Button */}
        {isOnline && (pendingCount > 0 || error) && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualSync}
            disabled={syncing}
            className="h-6 px-2 bg-transparent"
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync"}
          </Button>
        )}
      </div>
    </div>
  )
}
