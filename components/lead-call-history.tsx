"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Phone, PhoneCall, Clock } from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"

interface CallLog {
  id: string
  call_type: string
  call_status: string
  duration_seconds: number
  notes: string
  created_at: string
  users: {
    full_name: string
  }
}

export function LeadCallHistory({ leadId, userId }: { leadId: string; userId?: string }) {
  const [callHistory, setCallHistory] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCallHistory = async () => {
      try {
        setLoading(true)
        setError(null)
        const supabase = createClient()
        const { data, error } = await supabase
          .from("call_logs")
          .select(`
            id,
            call_type,
            call_status,
            duration_seconds,
            notes,
            created_at,
            users (
              full_name
            )
          `)
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false })

        if (error) {
          throw error
        }

        setCallHistory(data || [])
      } catch (err) {
        console.error("Error fetching call history:", err)
        setError("Failed to load call history")
      } finally {
        setLoading(false)
      }
    }
    fetchCallHistory()
  }, [leadId])

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

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00"
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5" />
            Call History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5" />
            Call History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-500">
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (callHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5" />
            Call History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <PhoneCall className="h-12 w-12 mx-auto text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No call history yet</h3>
            <p className="mt-1 text-gray-500">
              No calls have been made to this lead yet.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PhoneCall className="h-5 w-5" />
          Call History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {callHistory.map((call) => (
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
      </CardContent>
    </Card>
  )
}