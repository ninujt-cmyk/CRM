"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { callLogsPermissions, type CallLogPermissions } from "@/lib/call-logs-permissions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Phone, PhoneCall, AlertCircle, Shield, Clock } from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import { toast } from "sonner"
import { useCallTracking } from "@/context/call-tracking-context"
import { callLogsManager } from "@/lib/device/call-logs"

interface CallLog {
  id: string
  call_type: string
  call_status: string
  call_result?: string
  duration_seconds: number
  notes: string
  created_at: string
  updated_at: string
  follow_up_required: boolean
  next_call_scheduled?: string
  users: {
    full_name: string
  }
}

interface EnhancedCallHistoryProps {
  leadId: string
  leadPhone?: string
}

export function EnhancedCallHistory({ leadId, leadPhone }: EnhancedCallHistoryProps) {
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [permissions, setPermissions] = useState<CallLogPermissions>({
    canView: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canExport: false,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isLogging, setIsLogging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const { callLogPermission, requestCallLogPermission, formatDuration } = useCallTracking()

  useEffect(() => {
    initializeComponent()
  }, [leadId])

  const initializeComponent = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Check permissions first
      const userPermissions = await callLogsPermissions.checkPermissions()
      setPermissions(userPermissions)

      // Validate access to this lead
      const hasAccess = await callLogsPermissions.validateCallLogAccess(leadId)

      if (!hasAccess) {
        setError("You don't have permission to view call logs for this lead.")
        return
      }

      if (userPermissions.canView) {
        await fetchCallHistory()
      }
    } catch (error) {
      console.error("Error initializing call history:", error)
      setError("Failed to load call history. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCallHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("call_logs")
        .select(`
          id,
          call_type,
          call_status,
          call_result,
          duration_seconds,
          notes,
          created_at,
          updated_at,
          follow_up_required,
          next_call_scheduled,
          users (
            full_name
          )
        `)
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })

      if (error) {
        throw error
      }

      setCallLogs(data || [])
    } catch (error) {
      console.error("Error fetching call history:", error)
      setError("Failed to fetch call history.")
    }
  }

  const logCall = async (callType: string, callStatus = "in_progress", callResult = "attempted"): Promise<boolean> => {
    try {
      if (!permissions.canCreate) {
        toast.error("You don't have permission to create call logs.")
        return false
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        toast.error("You must be logged in to log calls.")
        return false
      }

      const { error } = await supabase.from("call_logs").insert({
        lead_id: leadId,
        user_id: user.id,
        call_type: callType,
        call_status: callStatus,
        call_result: callResult,
        duration_seconds: 0,
        notes: `${callType} call ${callResult}`,
        follow_up_required: false,
      })

      if (error) {
        console.error("Supabase error:", error)
        toast.error("Failed to log call. Please try again.")
        return false
      }

      toast.success("Call logged successfully!")
      return true
    } catch (error) {
      console.error("Error logging call:", error)
      toast.error("An error occurred while logging the call.")
      return false
    }
  }

  const makeCall = async () => {
    if (!leadPhone) {
      toast.error("No phone number available for this lead.")
      return
    }

    setIsLogging(true)

    try {
      const logged = await logCall("outbound", "in_progress", "attempted")

      if (logged) {
        console.log("[v0] Call logged successfully, initiating phone call")

        // Refresh call history
        await fetchCallHistory()

        // Initiate the phone call
        if (typeof window !== "undefined") {
          window.location.href = `tel:${leadPhone}`
        }
      }
    } catch (error) {
      console.error("[v0] Error in makeCall:", error)
      toast.error("Failed to initiate call.")
    } finally {
      setIsLogging(false)
    }
  }

  const importCallLogs = async () => {
    if (!leadPhone) {
      toast.error("No phone number available for this lead.")
      return
    }

    if (callLogPermission !== "granted") {
      toast.error("Call log permission not granted. Please enable call log access first.")
      return
    }

    try {
      setIsLoading(true)
      // In a real implementation, this would fetch actual call logs
      // For now, we'll use the mock data from callLogsManager
      const deviceCallLogs = await callLogsManager.getCallLogs()
      
      // Filter for calls related to this lead's phone number
      const relevantCalls = deviceCallLogs.filter(call => 
        call.phoneNumber === leadPhone || 
        callLogsManager.formatPhoneNumber(call.phoneNumber) === leadPhone
      )

      if (relevantCalls.length === 0) {
        toast.info("No relevant call logs found on device")
        return
      }

      // Import the call logs to our system
      const {
        data: { user },
      } = await supabase.auth.getUser()
      
      if (!user) {
        toast.error("You must be logged in to import call logs.")
        return
      }

      // Process each call log
      let importedCount = 0
      for (const call of relevantCalls) {
        const existingLog = callLogs.find(log => 
          new Date(log.created_at).getTime() === call.startTime.getTime()
        )

        if (!existingLog) {
          // Create new call log entry
          const { error } = await supabase.from("call_logs").insert({
            lead_id: leadId,
            user_id: user.id,
            call_type: call.callType === "incoming" ? "inbound" : "outbound",
            call_status: call.duration > 0 ? "connected" : "no_answer",
            duration_seconds: call.duration,
            notes: `Imported from device call log - ${call.callType} call`,
            created_at: call.startTime.toISOString(),
          })

          if (!error) {
            importedCount++
          }
        }
      }

      // Refresh call history
      await fetchCallHistory()
      toast.success(`Imported ${importedCount} call logs successfully!`)
    } catch (error) {
      console.error("Error importing call logs:", error)
      toast.error("Failed to import call logs. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const getCallStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "connected":
        return "bg-green-100 text-green-800"
      case "in_progress":
        return "bg-blue-100 text-blue-800"
      case "no_answer":
        return "bg-yellow-100 text-yellow-800"
      case "busy":
        return "bg-orange-100 text-orange-800"
      case "voicemail":
        return "bg-purple-100 text-purple-800"
      case "failed":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5" />
              Call History
            </CardTitle>
            <CardDescription>Track all calls made to this lead</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={makeCall} 
              disabled={isLogging || !leadPhone || !permissions.canCreate}
              size="sm"
            >
              {isLogging ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                  Logging...
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4 mr-2" />
                  Make Call
                </>
              )}
            </Button>
            
            {callLogPermission === "granted" && (
              <Button 
                onClick={importCallLogs} 
                variant="outline" 
                disabled={isLoading}
                size="sm"
              >
                <Shield className="h-4 w-4 mr-2" />
                Import Device Logs
              </Button>
            )}
            
            {callLogPermission !== "granted" && (
              <Button 
                onClick={requestCallLogPermission} 
                variant="outline" 
                size="sm"
              >
                <Shield className="h-4 w-4 mr-2" />
                Enable Call Tracking
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : callLogs.length === 0 ? (
          <div className="text-center py-8">
            <PhoneCall className="h-12 w-12 mx-auto text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No call history yet</h3>
            <p className="mt-1 text-gray-500">
              Make your first call to this lead to start tracking call history.
            </p>
            <div className="mt-6">
              <Button 
                onClick={makeCall} 
                disabled={!leadPhone || !permissions.canCreate}
              >
                <Phone className="h-4 w-4 mr-2" />
                Make First Call
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {callLogs.map((call) => (
              <div key={call.id} className="p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCallStatusColor(call.call_status)}`}>
                      {call.call_status?.replace("_", " ").toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {call.users?.full_name || "Unknown User"}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {call.duration_seconds > 0 ? (
                    <p className="text-sm">
                      <Clock className="h-4 w-4 inline mr-1" />
                      Duration: {formatDuration(call.duration_seconds)}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">No duration recorded</p>
                  )}
                  {call.notes && (
                    <p className="text-sm bg-gray-100 p-2 rounded">
                      {call.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}