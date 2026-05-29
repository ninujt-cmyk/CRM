// app/debug/follow-ups-test.tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScheduleFollowUpModal } from "@/components/schedule-follow-up-modal"
import { NotificationBell } from "@/components/notification-bell"
import { reminderService } from "@/lib/reminder-service"
import { toast } from "sonner"
import { Calendar, Bell, CheckCircle, Clock } from "lucide-react"

export default function FollowUpsTest() {
  const [showModal, setShowModal] = useState(false)
  const [isServiceRunning, setIsServiceRunning] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})

  useEffect(() => {
    // Check if reminder service is running
    setIsServiceRunning(!!reminderService['checkInterval'])
    
    // Run initial tests
    runInitialTests()
  }, [])

  const runInitialTests = () => {
    // Test date formatting
    try {
      const testDate = new Date()
      testDate.setDate(testDate.getDate() + 1)
      const formatted = testDate.toLocaleDateString()
      setTestResults(prev => ({ ...prev, dateFormatting: !!formatted }))
    } catch (error) {
      setTestResults(prev => ({ ...prev, dateFormatting: false }))
    }

    // Test notification permission
    const hasNotificationAPI = "Notification" in window
    setTestResults(prev => ({ ...prev, notificationAPI: hasNotificationAPI }))
    
    if (hasNotificationAPI) {
      setTestResults(prev => ({ ...prev, notificationPermission: Notification.permission === "granted" }))
    }
  }

  const startService = async () => {
    try {
      await reminderService.start()
      setIsServiceRunning(true)
      toast.success("Reminder service started")
      setTestResults(prev => ({ ...prev, reminderService: true }))
    } catch (error) {
      toast.error("Failed to start reminder service")
      console.error(error)
      setTestResults(prev => ({ ...prev, reminderService: false }))
    }
  }

  const stopService = () => {
    reminderService.stop()
    setIsServiceRunning(false)
    toast.success("Reminder service stopped")
  }

  const testNotification = () => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Test Notification", {
        body: "Follow-ups system is working correctly!",
        icon: "/icons/icon-192x192.png"
      })
      toast.success("Browser notification sent")
      setTestResults(prev => ({ ...prev, browserNotification: true }))
    } else {
      toast.error("Notification permission not granted")
      setTestResults(prev => ({ ...prev, browserNotification: false }))
    }
  }

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      try {
        const permission = await Notification.requestPermission()
        setTestResults(prev => ({ ...prev, notificationPermission: permission === "granted" }))
        toast.info(`Notification permission: ${permission}`)
      } catch (error) {
        toast.error("Failed to request notification permission")
        console.error(error)
      }
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Follow-ups System Test</h1>
        <div className="flex items-center gap-2">
          <NotificationBell />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Test Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              System Tests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Date Formatting</span>
                <span className={testResults.dateFormatting ? "text-green-600" : "text-red-600"}>
                  {testResults.dateFormatting ? "PASS" : "FAIL"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Notification API</span>
                <span className={testResults.notificationAPI ? "text-green-600" : "text-red-600"}>
                  {testResults.notificationAPI ? "AVAILABLE" : "NOT AVAILABLE"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Notification Permission</span>
                <span className={testResults.notificationPermission ? "text-green-600" : "text-red-600"}>
                  {testResults.notificationPermission ? "GRANTED" : "NOT GRANTED"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Reminder Service</span>
                <span className={testResults.reminderService ? "text-green-600" : "text-red-600"}>
                  {testResults.reminderService ? "RUNNING" : "STOPPED"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Browser Notification</span>
                <span className={testResults.browserNotification ? "text-green-600" : "text-red-600"}>
                  {testResults.browserNotification ? "WORKING" : "NOT WORKING"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Test Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button 
                onClick={requestNotificationPermission} 
                className="w-full"
              >
                Request Notification Permission
              </Button>
              <Button 
                onClick={testNotification} 
                className="w-full"
                variant="outline"
              >
                Send Test Notification
              </Button>
              {!isServiceRunning ? (
                <Button 
                  onClick={startService} 
                  className="w-full"
                >
                  Start Reminder Service
                </Button>
              ) : (
                <Button 
                  onClick={stopService} 
                  className="w-full"
                  variant="destructive"
                >
                  Stop Reminder Service
                </Button>
              )}
              <Button 
                onClick={() => setShowModal(true)} 
                className="w-full"
              >
                Schedule Test Follow-up
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Follow-up Modal */}
      <ScheduleFollowUpModal 
        open={showModal}
        onOpenChange={setShowModal}
      />
    </div>
  )
}