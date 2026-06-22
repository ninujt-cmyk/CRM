"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export function RevenueForecastChart({ startDate, endDate }: { startDate: string, endDate: string }) {
  const [data, setData] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    // Generate some deterministic placeholder data for demonstration
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const baseData = []
    let currentRevenue = 1500000

    for (let i = 0; i < 6; i++) {
        const d = new Date()
        d.setMonth(d.getMonth() + i)
        baseData.push({
            name: months[d.getMonth()],
            expected: currentRevenue + (Math.random() * 500000),
            worstCase: currentRevenue - (Math.random() * 200000),
            bestCase: currentRevenue + 800000 + (Math.random() * 500000)
        })
        currentRevenue += 200000
    }
    
    setData(baseData)
  }, [startDate, endDate])

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorBest" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="name" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#64748b' }}
            dy={10}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#64748b' }}
            tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`}
          />
          <Tooltip 
            formatter={(value: number) => `₹${(value / 100000).toFixed(2)} Lakhs`}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Area type="monotone" dataKey="bestCase" stroke="#10b981" fillOpacity={1} fill="url(#colorBest)" strokeDasharray="5 5" />
          <Area type="monotone" dataKey="expected" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorExpected)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
