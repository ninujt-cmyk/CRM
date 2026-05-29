"use client"

import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { WifiOff, Wifi } from "lucide-react"
import { offlineSync } from "@/lib/offline/sync"

interface OfflineFormWrapperProps {
  children: ReactNode
  isOnline?: boolean
}

export function OfflineFormWrapper({ children, isOnline = offlineSync.online }: OfflineFormWrapperProps) {
  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <Badge variant={isOnline ? "default" : "secondary"} className="flex items-center gap-1">
          {isOnline ? (
            <>
              <Wifi className="h-3 w-3" />
              Online
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              Offline Mode
            </>
          )}
        </Badge>

        {!isOnline && (
          <p className="text-sm text-muted-foreground">Changes will be saved locally and synced when online</p>
        )}
      </div>

      {children}
    </div>
  )
}
