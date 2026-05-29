// context/call-tracking-context.tsx
"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { callLogsManager } from "@/lib/device/call-logs"

interface ActiveCall {
  leadId: string | null
  callLogId: string | null
  startTime: Date | null
  timer: number
}

interface CallTrackingContextType {
  activeCall: ActiveCall | null
  callLogPermission: PermissionState
  startCall: (leadId: string, callLogId: string) => void
  endCall: (leadId: string) => void
  updateCallDuration: (leadId: string, callLogId: string) => Promise<number>
  requestCallLogPermission: () => Promise<void>
  formatDuration: (seconds: number) => string
}

const CallTrackingContext = createContext<CallTrackingContextType | undefined>(undefined)

export function CallTrackingProvider({ children }: { children: React.ReactNode }) {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const [timer, setTimer] = useState(0)
  const [callLogPermission, setCallLogPermission] = useState<PermissionState>("prompt")

  // Load active call from localStorage on component mount
  useEffect(() => {
    const savedCall = localStorage.getItem('activeCall')
    if (savedCall) {
      const parsedCall = JSON.parse(savedCall)
      const startTime = new Date(parsedCall.startTime)
      const elapsedSeconds = Math.floor((new Date().getTime() - startTime.getTime()) / 1000)
      
      setActiveCall({
        ...parsedCall,
        startTime: startTime,
        timer: elapsedSeconds
      })
      setTimer(elapsedSeconds)
    }
    
    // Check initial permission status
    checkCallLogPermission()
  }, [])

  // Save active call to localStorage whenever it changes
  useEffect(() => {
    if (activeCall) {
      localStorage.setItem('activeCall', JSON.stringify({
        leadId: activeCall.leadId,
        callLogId: activeCall.callLogId,
        startTime: activeCall.startTime?.toISOString(),
        timer: activeCall.timer
      }))
    } else {
      localStorage.removeItem('activeCall')
    }
  }, [activeCall])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (activeCall) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1)
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [activeCall])

  const checkCallLogPermission = async () => {
    try {
      // In a real implementation, we would check the actual permission status
      // For now, we'll set it to prompt as a placeholder
      setCallLogPermission("prompt")
    } catch (error) {
      console.error("Error checking call log permission:", error)
      setCallLogPermission("denied")
    }
  }

  const requestCallLogPermission = async () => {
    try {
      const result = await callLogsManager.requestPermission()
      setCallLogPermission(result)
    } catch (error) {
      console.error("Error requesting call log permission:", error)
      setCallLogPermission("denied")
    }
  }

  const startCall = (leadId: string, callLogId: string) => {
    const startTime = new Date()
    setActiveCall({
      leadId,
      callLogId,
      startTime,
      timer: 0
    })
    setTimer(0)
  }

  const endCall = (leadId: string) => {
    if (activeCall && activeCall.leadId === leadId) {
      setActiveCall(null)
      setTimer(0)
    }
  }

  const updateCallDuration = async (leadId: string, callLogId: string): Promise<number> => {
    if (activeCall && activeCall.leadId === leadId && activeCall.callLogId === callLogId) {
      const duration = timer
      endCall(leadId)
      return duration
    }
    return 0
  }

  // New function to format seconds to MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <CallTrackingContext.Provider value={{
      activeCall: activeCall ? { ...activeCall, timer } : null,
      callLogPermission,
      startCall,
      endCall,
      updateCallDuration,
      requestCallLogPermission,
      formatDuration
    }}>
      {children}
    </CallTrackingContext.Provider>
  )
}

export function useCallTracking() {
  const context = useContext(CallTrackingContext)
  if (context === undefined) {
    throw new Error('useCallTracking must be used within a CallTrackingProvider')
  }
  return context
}