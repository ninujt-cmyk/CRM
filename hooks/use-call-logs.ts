// hooks/use-call-logs.ts
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { callLogsManager, type CallLog } from "@/lib/device/call-logs"
import { toast } from "sonner"

export interface DatabaseCallLog {
  id: string
  lead_id: string
  user_id: string
  call_type: string
  call_status: string
  call_result?: string
  duration_seconds: number
  notes: string
  created_at: string
  updated_at: string
  follow_up_required: boolean
  next_call_scheduled?: string
}

export function useCallLogs(leadId: string) {
  const [callLogs, setCallLogs] = useState<DatabaseCallLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchCallLogs = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from("call_logs")
        .select(`
          id,
          lead_id,
          user_id,
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

      if (error) throw error

      setCallLogs(data || [])
    } catch (err) {
      console.error("Error fetching call logs:", err)
      setError("Failed to fetch call logs")
      toast.error("Failed to fetch call logs")
    } finally {
      setIsLoading(false)
    }
  }

  const createCallLog = async (logData: Partial<DatabaseCallLog>) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error("You must be logged in to create call logs")
        return false
      }

      const { error } = await supabase.from("call_logs").insert({
        ...logData,
        lead_id: leadId,
        user_id: user.id,
      })

      if (error) throw error

      await fetchCallLogs()
      toast.success("Call log created successfully")
      return true
    } catch (err) {
      console.error("Error creating call log:", err)
      toast.error("Failed to create call log")
      return false
    }
  }

  const updateCallLog = async (id: string, updates: Partial<DatabaseCallLog>) => {
    try {
      const { error } = await supabase
        .from("call_logs")
        .update(updates)
        .eq("id", id)

      if (error) throw error

      await fetchCallLogs()
      toast.success("Call log updated successfully")
      return true
    } catch (err) {
      console.error("Error updating call log:", err)
      toast.error("Failed to update call log")
      return false
    }
  }

  const deleteCallLog = async (id: string) => {
    try {
      const { error } = await supabase
        .from("call_logs")
        .delete()
        .eq("id", id)

      if (error) throw error

      await fetchCallLogs()
      toast.success("Call log deleted successfully")
      return true
    } catch (err) {
      console.error("Error deleting call log:", err)
      toast.error("Failed to delete call log")
      return false
    }
  }

  const importDeviceCallLogs = async (leadPhone: string) => {
    try {
      // Check if we have permission to access call logs
      // In a real implementation, we would check actual permission status
      
      // Fetch call logs from device
      const deviceCallLogs = await callLogsManager.getCallLogs()
      
      // Filter for calls related to this lead's phone number
      const relevantCalls = deviceCallLogs.filter(call => 
        call.phoneNumber === leadPhone || 
        callLogsManager.formatPhoneNumber(call.phoneNumber) === leadPhone
      )

      if (relevantCalls.length === 0) {
        toast.info("No relevant call logs found on device")
        return { success: true, count: 0 }
      }

      // Import each call log
      let importedCount = 0
      for (const call of relevantCalls) {
        const success = await createCallLog({
          call_type: call.callType === "incoming" ? "inbound" : "outbound",
          call_status: call.duration > 0 ? "connected" : "no_answer",
          duration_seconds: call.duration,
          notes: `Imported from device call log - ${call.callType} call`,
          created_at: call.startTime.toISOString(),
        })

        if (success) {
          importedCount++
        }
      }

      toast.success(`Successfully imported ${importedCount} call logs`)
      return { success: true, count: importedCount }
    } catch (err) {
      console.error("Error importing device call logs:", err)
      toast.error("Failed to import device call logs")
      return { success: false, count: 0 }
    }
  }

  useEffect(() => {
    if (leadId) {
      fetchCallLogs()
    }
  }, [leadId])

  return {
    callLogs,
    isLoading,
    error,
    fetchCallLogs,
    createCallLog,
    updateCallLog,
    deleteCallLog,
    importDeviceCallLogs,
  }
}