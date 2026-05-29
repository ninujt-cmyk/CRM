"use client"

import { useState, useCallback } from "react"
import { offlineSync } from "@/lib/offline/sync"
import { toast } from "sonner"

interface UseOfflineFormOptions {
  onlineSubmit: (data: any) => Promise<any>
  offlineSubmit?: (data: any) => Promise<string>
  onSuccess?: (result: any) => void
  onError?: (error: any) => void
}

export function useOfflineForm({ onlineSubmit, offlineSubmit, onSuccess, onError }: UseOfflineFormOptions) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = useCallback(
    async (data: any) => {
      setIsSubmitting(true)

      try {
        if (offlineSync.online) {
          // Try online submission first
          try {
            const result = await onlineSubmit(data)
            onSuccess?.(result)
            toast.success("Data saved successfully!")
            return result
          } catch (error) {
            console.error("Online submission failed:", error)

            // If online submission fails, fall back to offline
            if (offlineSubmit) {
              const offlineId = await offlineSubmit(data)
              onSuccess?.({ id: offlineId, offline: true })
              return { id: offlineId, offline: true }
            } else {
              throw error
            }
          }
        } else {
          // We're offline, use offline submission
          if (offlineSubmit) {
            const offlineId = await offlineSubmit(data)
            onSuccess?.({ id: offlineId, offline: true })
            return { id: offlineId, offline: true }
          } else {
            throw new Error("Cannot submit while offline")
          }
        }
      } catch (error) {
        console.error("Form submission failed:", error)
        onError?.(error)
        toast.error("Failed to save data. Please try again.")
        throw error
      } finally {
        setIsSubmitting(false)
      }
    },
    [onlineSubmit, offlineSubmit, onSuccess, onError],
  )

  return {
    submit,
    isSubmitting,
    isOnline: offlineSync.online,
  }
}
