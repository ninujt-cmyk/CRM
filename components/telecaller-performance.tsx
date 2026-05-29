"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus, CheckCircle, Clock, Timer, Phone } from "lucide-react"

interface PerformanceData {
  id: string
  name: string
  totalLeads: number
  totalCalls: number
  connectedCalls: number
  connectRate: number
  newLeads: number
  convertedLeads: number
  conversionRate: number
  isCheckedIn: boolean
  totalCallDuration: number
  avgCallDuration: number
  callStatusBreakdown: {
    connected: number
    notConnected: number
    noAnswer: number
    busy: number
  }
  lastCallTime: string | null
  avgTimeBetweenCalls: number
}

interface TelecallerPerformanceProps {
  startDate: string
  endDate: string
  telecallerId?: string
}

export function TelecallerPerformance({ startDate, endDate, telecallerId }: TelecallerPerformanceProps) {
  const [data, setData] = useState<PerformanceData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // Format helper for duration
  const formatDuration = (seconds: number) => {
    if (seconds === Infinity || isNaN(seconds)) return "00:00:00"
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return "-"
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // 1. Base User Query
        let userQuery = supabase
          .from("users")
          .select("id, full_name")
          .eq("is_active", true)
        
        if (telecallerId) {
             const ids = telecallerId.split(',')
             userQuery = userQuery.in('id', ids)
        } else {
             userQuery = userQuery.eq("role", "telecaller")
        }

        // 2. Attendance (Today)
        const today = new Date().toISOString().split('T')[0]
        const attendanceQuery = supabase.from("attendance").select("user_id, check_in").eq("date", today)

        // 3. Leads (Period)
        const leadsQuery = supabase
          .from("leads")
          .select("assigned_to, status")
          .gte("created_at", startDate)
          .lte("created_at", `${endDate}T23:59:59`)

        // 4. Calls (Period)
        const callsQuery = supabase
          .from("call_logs")
          .select("user_id, call_status, duration_seconds, created_at")
          .gte("created_at", startDate)
          .lte("created_at", `${endDate}T23:59:59`)
          .order("created_at", { ascending: false })

        // 5. Parallel Execution
        const [
          { data: telecallers },
          { data: attendance },
          { data: leads },
          { data: calls }
        ] = await Promise.all([userQuery, attendanceQuery, leadsQuery, callsQuery])

        if (!telecallers) return

        // 6. Processing
        const attendanceMap = new Map(attendance?.map((a: any) => [a.user_id, !!a.check_in]))
        
        // Group Leads
        const leadsByUser: Record<string, any[]> = {}
        leads?.forEach((l: any) => {
            if(!leadsByUser[l.assigned_to]) leadsByUser[l.assigned_to] = []
            leadsByUser[l.assigned_to].push(l)
        })

        // Group Calls
        const callsByUser: Record<string, any[]> = {}
        calls?.forEach((c: any) => {
            if(!callsByUser[c.user_id]) callsByUser[c.user_id] = []
            callsByUser[c.user_id].push(c)
        })

        const performanceData: PerformanceData[] = telecallers.map((telecaller: any) => {
          const userLeads = leadsByUser[telecaller.id] || []
          const userCalls = callsByUser[telecaller.id] || []

          const totalCalls = userCalls.length
          const totalCallDuration = userCalls.reduce((sum, call) => sum + (call.duration_seconds || 0), 0)
          const avgCallDuration = totalCalls > 0 ? totalCallDuration / totalCalls : 0

          // Calculate Gap
          let avgTimeBetweenCalls = 0
          if (userCalls.length > 1) {
             // Sort ascending for calculation
             const sortedTimes = [...userCalls].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
             const totalGap = new Date(sortedTimes[sortedTimes.length-1].created_at).getTime() - new Date(sortedTimes[0].created_at).getTime()
             avgTimeBetweenCalls = (totalGap / 1000) / (userCalls.length - 1)
          }

          const statusBreakdown = {
            connected: userCalls.filter(c => (c.duration_seconds || 0) > 0).length,
            notConnected: userCalls.filter(c => (c.duration_seconds || 0) === 0).length,
            noAnswer: userCalls.filter(c => c.call_status === "nr").length,
            busy: userCalls.filter(c => c.call_status === "busy").length
          }

          return {
            id: telecaller.id,
            name: telecaller.full_name,
            totalLeads: userLeads.length,
            totalCalls,
            connectedCalls: statusBreakdown.connected,
            connectRate: totalCalls > 0 ? (statusBreakdown.connected / totalCalls) * 100 : 0,
            newLeads: userLeads.filter(l => l.status === "new" || l.status === "contacted").length,
            convertedLeads: userLeads.filter(l => l.status === "closed_won" || l.status === "Interested").length, // Customize status here
            conversionRate: userLeads.length > 0 ? (userLeads.filter(l => l.status === "closed_won" || l.status === "Interested").length / userLeads.length) * 100 : 0,
            isCheckedIn: attendanceMap.get(telecaller.id) || false,
            totalCallDuration,
            avgCallDuration,
            callStatusBreakdown: statusBreakdown,
            lastCallTime: userCalls.length > 0 ? userCalls[0].created_at : null,
            avgTimeBetweenCalls
          }
        })

        // Sort by Total Calls Descending
        performanceData.sort((a, b) => b.totalCalls - a.totalCalls)
        setData(performanceData)

      } catch (error) {
        console.error("Error fetching performance:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [startDate, endDate, telecallerId, supabase])

  const getPerformanceBadge = (rate: number, type: "connect" | "conversion") => {
    const thresholds = type === "connect" ? [60, 40] : [15, 8]
    if (rate >= thresholds[0]) return <Badge className="bg-green-100 text-green-800 flex items-center gap-1 hover:bg-green-100"><TrendingUp className="h-3 w-3" />Excellent</Badge>
    else if (rate >= thresholds[1]) return <Badge className="bg-yellow-100 text-yellow-800 flex items-center gap-1 hover:bg-yellow-100"><Minus className="h-3 w-3" />Good</Badge>
    else return <Badge className="bg-red-100 text-red-800 flex items-center gap-1 hover:bg-red-100"><TrendingDown className="h-3 w-3" />Improve</Badge>
  }

  if (isLoading) return <div className="text-center py-8 text-gray-500">Loading performance data...</div>

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b bg-gray-50 text-xs text-gray-700 uppercase">
            <th className="p-4 font-semibold text-left">Telecaller</th>
            <th className="p-4 font-semibold text-left">Status</th>
            <th className="p-4 font-semibold text-center">Leads</th>
            <th className="p-4 font-semibold text-center">Calls</th>
            <th className="p-4 font-semibold text-left">Duration</th>
            <th className="p-4 font-semibold text-center">Last Call</th>
            <th className="p-4 font-semibold text-center">Gap</th>
            <th className="p-4 font-semibold text-center">Connected</th>
            <th className="p-4 font-semibold text-center">Rate</th>
            <th className="p-4 font-semibold text-center">Conv.</th>
            <th className="p-4 font-semibold text-left">Breakdown</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {data.map((telecaller) => (
            <tr key={telecaller.id} className="border-b hover:bg-gray-50 transition-colors">
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-xs">
                    {telecaller.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-gray-900">{telecaller.name}</span>
                </div>
              </td>
              <td className="p-4">
                 <Badge variant={telecaller.isCheckedIn ? "default" : "secondary"} className={telecaller.isCheckedIn ? "bg-green-500 hover:bg-green-600" : ""}>
                    {telecaller.isCheckedIn ? "Online" : "Offline"}
                 </Badge>
              </td>
              <td className="p-4 text-center font-medium">{telecaller.totalLeads}</td>
              <td className="p-4 text-center font-medium">{telecaller.totalCalls}</td>
              <td className="p-4">
                <div className="flex flex-col gap-0.5">
                   <span className="font-medium">{formatDuration(telecaller.totalCallDuration)}</span>
                   <span className="text-xs text-gray-500">Avg: {formatDuration(telecaller.avgCallDuration)}</span>
                </div>
              </td>
              <td className="p-4 text-center font-mono text-xs">{formatTime(telecaller.lastCallTime)}</td>
              <td className="p-4 text-center font-mono text-xs text-gray-500">{formatDuration(telecaller.avgTimeBetweenCalls)}</td>
              <td className="p-4 text-center font-bold text-green-600">{telecaller.connectedCalls}</td>
              <td className="p-4 text-center">
                 <div className="flex flex-col items-center gap-1">
                    <span className="font-bold">{telecaller.connectRate.toFixed(0)}%</span>
                    {getPerformanceBadge(telecaller.connectRate, "connect")}
                 </div>
              </td>
              <td className="p-4 text-center">
                 <div className="flex flex-col items-center gap-1">
                    <span className="font-bold">{telecaller.conversionRate.toFixed(1)}%</span>
                    {getPerformanceBadge(telecaller.conversionRate, "conversion")}
                 </div>
              </td>
              <td className="p-4">
                <div className="flex gap-2 text-xs">
                   <div className="flex items-center gap-1 text-green-600" title="Connected"><CheckCircle className="w-3 h-3"/> {telecaller.callStatusBreakdown.connected}</div>
                   <div className="flex items-center gap-1 text-red-500" title="Not Connected"><Minus className="w-3 h-3"/> {telecaller.callStatusBreakdown.notConnected}</div>
                   <div className="flex items-center gap-1 text-orange-500" title="Busy"><Clock className="w-3 h-3"/> {telecaller.callStatusBreakdown.busy}</div>
                </div>
              </td>
            </tr>
          ))}
          {data.length === 0 && (
             <tr><td colSpan={11} className="p-8 text-center text-gray-500">No activity data found for this period.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
