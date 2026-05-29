"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"]

export function MyLeadStatusChart({ userId }: { userId: string }) {
  const [data, setData] = useState<Array<{ name: string; value: number; color: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: leads } = await supabase.from("leads").select("status").eq("assigned_to", userId)

        if (leads) {
          const statusCounts = leads.reduce((acc: Record<string, number>, lead: any) => {
            acc[lead.status] = (acc[lead.status] || 0) + 1
            return acc
          }, {})

          const chartData = Object.entries(statusCounts).map(([status, count], index) => ({
            name: status.replace("_", " ").toUpperCase(),
            value: count as number,
            color: COLORS[index % COLORS.length],
          }))

          setData(chartData)
        }
      } catch (error) {
        console.error("Error fetching lead status data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [userId, supabase])

  if (isLoading) {
    return <div className="h-64 flex items-center justify-center">Loading chart...</div>
  }

  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-500">No leads assigned yet</div>
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
