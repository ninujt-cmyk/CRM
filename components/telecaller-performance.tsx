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
    if (rate >= thresholds[0]) {
      return (
        <Badge className="bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-250 dark:border-emerald-900/30 font-bold text-[10px] py-0 px-2 rounded-full hover:bg-emerald-100/50 shadow-none">
          Excellent
        </Badge>
      )
    } else if (rate >= thresholds[1]) {
      return (
        <Badge className="bg-amber-50/80 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-250 dark:border-amber-900/30 font-bold text-[10px] py-0 px-2 rounded-full hover:bg-amber-100/50 shadow-none">
          Good
        </Badge>
      )
    } else {
      return (
        <Badge className="bg-rose-50/80 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-250 dark:border-rose-900/30 font-bold text-[10px] py-0 px-2 rounded-full hover:bg-rose-100/50 shadow-none">
          Needs Training
        </Badge>
      )
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent animate-spin rounded-full" />
        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 animate-pulse">Calculating workforce stats...</span>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto border border-slate-200/60 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 text-[11px] font-extrabold uppercase tracking-wider">
            <th className="py-3.5 px-4 font-bold text-left sticky left-0 bg-slate-50/70 dark:bg-slate-950/40 z-10">Telecaller</th>
            <th className="py-3.5 px-4 font-bold text-left">Status</th>
            <th className="py-3.5 px-4 font-bold text-center">Leads</th>
            <th className="py-3.5 px-4 font-bold text-center">Calls</th>
            <th className="py-3.5 px-4 font-bold text-left">Duration</th>
            <th className="py-3.5 px-4 font-bold text-center">Last Call</th>
            <th className="py-3.5 px-4 font-bold text-center">Gap</th>
            <th className="py-3.5 px-4 font-bold text-center">Connected</th>
            <th className="py-3.5 px-4 font-bold text-center">Connect Rate</th>
            <th className="py-3.5 px-4 font-bold text-center">Conv. Rate</th>
            <th className="py-3.5 px-4 font-bold text-left">Call Status Breakdown</th>
          </tr>
        </thead>
        <tbody className="text-xs divide-y divide-slate-100 dark:divide-slate-800/80">
          {data.map((telecaller) => (
            <tr key={telecaller.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors group">
              {/* Telecaller Avatar and Name */}
              <td className="py-3 px-4 font-medium sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50/50 dark:group-hover:bg-slate-900/40 z-10 transition-colors border-r border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] relative shadow-sm ring-2 ${
                    telecaller.isCheckedIn 
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20" 
                      : "bg-slate-500/10 text-slate-600 dark:text-slate-400 ring-slate-200 dark:ring-slate-800"
                  }`}>
                    {telecaller.name.charAt(0).toUpperCase()}
                    {telecaller.isCheckedIn && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                    )}
                  </div>
                  <span className="font-bold text-slate-800 dark:text-slate-100 tracking-tight text-[13px]">{telecaller.name}</span>
                </div>
              </td>
              
              {/* Status Badge */}
              <td className="py-3 px-4">
                 <Badge className={
                   telecaller.isCheckedIn 
                     ? "bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-extrabold text-[10px]" 
                     : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50 font-bold text-[10px]"
                 }>
                    {telecaller.isCheckedIn ? "Online" : "Offline"}
                 </Badge>
              </td>

              {/* Leads Roster */}
              <td className="py-3 px-4 text-center font-bold text-slate-700 dark:text-slate-300 text-[13px]">{telecaller.totalLeads}</td>
              
              {/* Calls Roster */}
              <td className="py-3 px-4 text-center font-bold text-slate-700 dark:text-slate-300 text-[13px]">{telecaller.totalCalls}</td>
              
              {/* Durations */}
              <td className="py-3 px-4">
                <div className="flex flex-col gap-0.5">
                   <span className="font-semibold text-slate-800 dark:text-slate-200 text-[12px]">{formatDuration(telecaller.totalCallDuration)}</span>
                   <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase">Avg: {formatDuration(telecaller.avgCallDuration)}</span>
                </div>
              </td>

              {/* Last Call */}
              <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-700 dark:text-slate-300 font-medium">{formatTime(telecaller.lastCallTime)}</td>
              
              {/* Gap between Calls */}
              <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-400 dark:text-slate-500 font-semibold">{formatDuration(telecaller.avgTimeBetweenCalls)}</td>
              
              {/* Connected Calls */}
              <td className="py-3 px-4 text-center font-extrabold text-emerald-600 dark:text-emerald-400 text-[13px]">{telecaller.connectedCalls}</td>
              
              {/* Connect Rate with Progress Indicator */}
              <td className="py-3 px-4">
                 <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
                    <span className="font-extrabold text-slate-900 dark:text-slate-100 text-[13px]">{telecaller.connectRate.toFixed(0)}%</span>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${telecaller.connectRate}%` }} />
                    </div>
                    {getPerformanceBadge(telecaller.connectRate, "connect")}
                 </div>
              </td>

              {/* Conversion Rate with Progress Indicator */}
              <td className="py-3 px-4">
                 <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
                    <span className="font-extrabold text-slate-900 dark:text-slate-100 text-[13px]">{telecaller.conversionRate.toFixed(1)}%</span>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(telecaller.conversionRate * 4, 100)}%` }} />
                    </div>
                    {getPerformanceBadge(telecaller.conversionRate, "conversion")}
                 </div>
              </td>

              {/* Status Breakdown Pills */}
              <td className="py-3 px-4">
                <div className="flex gap-2">
                   <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 font-bold" title="Connected">
                     <CheckCircle className="w-3.5 h-3.5" /> 
                     <span>{telecaller.callStatusBreakdown.connected}</span>
                   </div>
                   <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/10 font-bold" title="Not Connected">
                     <Minus className="w-3.5 h-3.5" /> 
                     <span>{telecaller.callStatusBreakdown.notConnected}</span>
                   </div>
                   <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/10 font-bold" title="Busy">
                     <Clock className="w-3.5 h-3.5" /> 
                     <span>{telecaller.callStatusBreakdown.busy}</span>
                   </div>
                </div>
              </td>
            </tr>
          ))}
          {data.length === 0 && (
             <tr>
               <td colSpan={11} className="py-12 text-center text-slate-500 dark:text-slate-400 font-semibold">
                 No activity data found for this reporting period.
               </td>
             </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
