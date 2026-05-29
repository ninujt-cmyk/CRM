"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus, Info, Target, Trophy } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts"

interface PerformanceMetricsProps {
  userId: string
  conversionRate: number
  successRate: number
  avgCallDuration: number
  isLoading?: boolean
}

// Goals configuration
const GOALS = {
  conversion: 20, // Target 20%
  success: 90,    // Target 90%
  duration: 5     // Target 5 mins
}

export function PerformanceMetrics({ 
  conversionRate, 
  successRate, 
  avgCallDuration,
  isLoading = false
}: PerformanceMetricsProps) {

  // --- SKELETON LOADER ---
  if (isLoading) {
    return (
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-4 border-b bg-slate-50/50">
          <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 items-center">
                <div className="h-16 w-16 rounded-full bg-slate-100 animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
                  <div className="h-6 w-16 bg-slate-200 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // --- METRIC LOGIC ---
  const getScoreColor = (current: number, target: number) => {
    const ratio = current / target
    if (ratio >= 1) return "#16a34a" // Green-600
    if (ratio >= 0.7) return "#ca8a04" // Yellow-600
    return "#dc2626" // Red-600
  }

  const metrics = [
    {
      id: "conversion",
      label: "Conversion Rate",
      value: `${conversionRate}%`,
      score: Math.min((conversionRate / GOALS.conversion) * 100, 100),
      target: `${GOALS.conversion}%`,
      fill: getScoreColor(conversionRate, GOALS.conversion),
      gap: conversionRate - GOALS.conversion,
      icon: Trophy,
      description: "Leads converted to sales vs total leads."
    },
    {
      id: "success",
      label: "Task Completion", 
      value: `${successRate}%`,
      score: successRate, // Already 0-100
      target: `${GOALS.success}%`,
      fill: getScoreColor(successRate, GOALS.success),
      gap: successRate - GOALS.success,
      icon: Target,
      description: "Scheduled tasks marked as completed on time."
    },
    {
      id: "duration",
      label: "Avg Call Duration",
      value: `${avgCallDuration}m`,
      score: Math.min((avgCallDuration / GOALS.duration) * 100, 100),
      target: `${GOALS.duration}m`,
      fill: getScoreColor(avgCallDuration, GOALS.duration),
      gap: avgCallDuration - GOALS.duration,
      icon: PhoneIcon,
      description: "Average talk time per connected call."
    }
  ]

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-4 border-b bg-slate-50/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-500" />
            Performance Overview
          </CardTitle>
          <span className="text-xs font-medium text-slate-500 bg-white px-2.5 py-1 rounded border shadow-sm">
            Last 30 Days
          </span>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {metrics.map((metric) => (
            <div key={metric.id} className="flex items-center gap-4 pt-4 md:pt-0 md:pl-4 first:pl-0 first:pt-0">
              
              {/* Radial Chart (The Visual Hero) */}
              <div className="relative h-16 w-16 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart 
                    cx="50%" cy="50%" 
                    innerRadius="80%" outerRadius="100%" 
                    barSize={10} 
                    data={[{ value: metric.score, fill: metric.fill }]} 
                    startAngle={90} endAngle={-270}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar background dataKey="value" cornerRadius={10} />
                  </RadialBarChart>
                </ResponsiveContainer>
                {/* Center Icon */}
                <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                    <metric.icon className="h-5 w-5" />
                </div>
              </div>

              {/* Text Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm font-medium text-slate-500 truncate">{metric.label}</span>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <Info className="h-3.5 w-3.5 text-slate-300 hover:text-slate-500" />
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                <p className="max-w-[180px] text-xs">{metric.description}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900">{metric.value}</span>
                    <span className="text-xs text-slate-400 font-medium">/ {metric.target}</span>
                </div>

                {/* Gap Analysis */}
                <div className={cn("text-[10px] font-semibold mt-1 flex items-center gap-1", metric.gap >= 0 ? "text-green-600" : "text-red-600")}>
                    {metric.gap >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    <span>{metric.gap > 0 ? "+" : ""}{metric.gap.toFixed(1)}{metric.id === 'duration' ? 'm' : '%'} vs Goal</span>
                </div>
              </div>

            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function PhoneIcon(props: any) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    )
}
