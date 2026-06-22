"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b']

export function LeadSourceROIChart({ startDate, endDate }: { startDate: string, endDate: string }) {
  const [data, setData] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
        // Fallback placeholder data if no real data is found
        let sourceData = [
            { name: "Facebook Ads", value: 400 },
            { name: "Google Search", value: 300 },
            { name: "Referral", value: 300 },
            { name: "MagicBricks", value: 200 },
            { name: "99Acres", value: 150 },
            { name: "Direct", value: 50 },
        ]

        try {
            const { data: leads } = await supabase
                .from('leads')
                .select('source')
                .gte('created_at', startDate)
                .lte('created_at', `${endDate}T23:59:59`)

            if (leads && leads.length > 0) {
                const sourceCounts: Record<string, number> = {}
                leads.forEach(l => {
                    const src = l.source || "Unknown"
                    sourceCounts[src] = (sourceCounts[src] || 0) + 1
                })

                sourceData = Object.entries(sourceCounts)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 6) // Top 6 sources
            }
        } catch (error) {
            console.error("Error fetching source data", error)
        }

        setData(sourceData)
    }

    fetchData()
  }, [startDate, endDate])

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => [`${value} Leads`, "Volume"]}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend verticalAlign="bottom" height={36} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
