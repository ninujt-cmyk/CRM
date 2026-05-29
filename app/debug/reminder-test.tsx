// app/debug/reminder-test.tsx
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { reminderService } from "@/lib/reminder-service"
import { toast } from "sonner"

export default function ReminderTest() {
  const [isServiceRunning, setIsServiceRunning] = useState(false)

  useEffect(() => {
    // Check if reminder service is running
    setIsServiceRunning(!!reminderService['checkInterval'])
  }, [])

  const startService = async () => {
    try {
      await reminderService.start()
      setIsServiceRunning(true)
      toast.success("Reminder service started")
    } catch (error) {
      toast.error("Failed to start reminder service")
      console.error(error)
    }
  }

  const stopService = () => {
    reminderService.stop()
    setIsServiceRunning(false)
    toast.success("Reminder service stopped")
  }

  const triggerCheck = async () => {
    try {
      // @ts-ignore - accessing private method for testing
      await reminderService.checkDueFollowUps()
      toast.success("Reminder check completed")
    } catch (error) {
      toast.error("Failed to check reminders")
      console.error(error)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Reminder Service Test</h1>
      
      <div className="space-y-2">
        <p>Status: {isServiceRunning ? "Running" : "Stopped"}</p>
        
        <div className="flex gap-2">
          {!isServiceRunning ? (
            <Button onClick={startService}>
              Start Reminder Service
            </Button>
          ) : (
            <Button onClick={stopService} variant="destructive">
              Stop Reminder Service
            </Button>
          )}
          <Button onClick={triggerCheck} variant="outline">
            Trigger Manual Check
          </Button>
        </div>
      </div>
    </div>
  )
}