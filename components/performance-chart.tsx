"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface PerformanceChartProps {
  startDate: string
  endDate: string
  telecallerId?: string
}

export function PerformanceChart({ startDate, endDate, telecallerId }: PerformanceChartProps) {
  const [data, setData] = useState<Array<{ date: string; leads: number; calls: number }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // 🔴 1. Securely fetch the logged-in user's Tenant ID
        const { data: { user } } = await supabase.auth.getUser()
        let tenantId = null
        let role = null
        
        if (user) {
          const { data: profile } = await supabase
            .from('users')
            .select('tenant_id, role')
            .eq('id', user.id)
            .single()
            
          tenantId = profile?.tenant_id
          role = profile?.role
        }

        // 2. Fetch data for ENTIRE range (Select ONLY timestamp to save bandwidth)
        let leadsQuery = supabase
          .from("leads")
          .select("created_at")
          .gte("created_at", startDate)
          .lte("created_at", `${endDate}T23:59:59`)

        let callsQuery = supabase
          .from("call_logs")
          .select("created_at")
          .gte("created_at", startDate)
          .lte("created_at", `${endDate}T23:59:59`)

        // 🔴 3. APPLY STRICT TENANT ISOLATION (Defense in Depth)
        if (tenantId && role !== 'super_admin') {
          leadsQuery = leadsQuery.eq('tenant_id', tenantId)
          callsQuery = callsQuery.eq('tenant_id', tenantId)
        }

        if (telecallerId) {
          const ids = telecallerId.split(',')
          leadsQuery = leadsQuery.in("assigned_to", ids)
          callsQuery = callsQuery.in("user_id", ids)
        }

        // Execute queries in parallel
        const [{ data: leadsRaw }, { data: callsRaw }] = await Promise.all([leadsQuery, callsQuery])

        // 4. Initialize Date Map (to ensure days with 0 data still show up on chart)
        const dateMap = new Map<string, { leads: number; calls: number }>()
        const start = new Date(startDate)
        const end = new Date(endDate)
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dateMap.set(d.toISOString().split("T")[0], { leads: 0, calls: 0 })
        }

        // 5. Aggregate Data
        leadsRaw?.forEach((item) => {
          const dateKey = item.created_at.split("T")[0]
          if (dateMap.has(dateKey)) dateMap.get(dateKey)!.leads += 1
        })

        callsRaw?.forEach((item) => {
          const dateKey = item.created_at.split("T")[0]
          if (dateMap.has(dateKey)) dateMap.get(dateKey)!.calls += 1
        })

        // 6. Format for Recharts
        const chartData = Array.from(dateMap.entries()).map(([date, counts]) => ({
          date: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          ...counts,
        }))

        setData(chartData)
      } catch (error) {
        console.error("Error fetching performance data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [startDate, endDate, telecallerId, supabase])

  if (isLoading) {
    return <div className="h-64 flex items-center justify-center text-sm text-gray-500">Loading chart data...</div>
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb" }}
          />
          <Legend />
          <Line type="monotone" dataKey="leads" stroke="#3B82F6" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="New Leads" />
          <Line type="monotone" dataKey="calls" stroke="#10B981" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Calls Made" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
