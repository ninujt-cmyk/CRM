import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, Calendar, TrendingUp, Users, TrendingDown, ArrowUpRight, ArrowDownRight, Trophy, AlertCircle, CheckCircle2, Sparkles } from "lucide-react"
import { ReportsFilters } from "@/components/reports-filters"
import { PerformanceChart } from "@/components/performance-chart"
import { LeadConversionChart } from "@/components/lead-conversion-chart"
import { TelecallerPerformance } from "@/components/telecaller-performance"
import { ExportButtons } from "@/components/export-buttons"
import { RevenueForecastChart } from "@/components/revenue-forecast-chart"
import { LeadSourceROIChart } from "@/components/lead-source-roi-chart"
import Link from "next/link"
import { Suspense } from "react"
import { Badge } from "@/components/ui/badge"

interface SearchParams {
  start_date?: string
  end_date?: string
  telecaller?: string 
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createClient()

  // 1. Date Logic (Current vs Previous Period)
  const defaultEnd = new Date()
  const defaultStart = new Date()
  defaultStart.setDate(defaultEnd.getDate() - 30)

  const startDate = searchParams.start_date || defaultStart.toISOString().split("T")[0]
  const endDate = searchParams.end_date || defaultEnd.toISOString().split("T")[0]

  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  
  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - diffDays + 1)

  const prevStartDate = prevStart.toISOString().split("T")[0]
  const prevEndDate = prevEnd.toISOString().split("T")[0]

  // 2. Auth & Telecallers
  const { data: { user } } = await supabase.auth.getUser()
  const { data: userProfile } = await supabase.from('users').select('role').eq('id', user?.id).single()
  
  let filterId = searchParams.telecaller
  if (userProfile?.role === 'telecaller') filterId = user!.id

  const { data: telecallers } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("role", "telecaller")
    .eq("is_active", true)

  // 3. Helper: Fetch Period Data
  const fetchPeriodData = async (s: string, e: string) => {
    // Basic Counts
    const buildQuery = (table: string, statusCol?: string, statusVal?: string) => {
      let q = supabase.from(table).select('*', { count: 'exact', head: true }).gte('created_at', s).lte('created_at', `${e}T23:59:59`)
      if (filterId) {
        const col = table === 'leads' ? 'assigned_to' : 'user_id'
        if (filterId.includes(',')) q = q.in(col, filterId.split(','))
        else q = q.eq(col, filterId)
      }
      if (statusCol && statusVal) q = q.eq(statusCol, statusVal)
      return q
    }

    // Top Performer Logic (Based on Total Calls from call_logs)
    let winnerQuery = supabase
      .from('call_logs')
      .select('user_id')
      .gte('created_at', s)
      .lte('created_at', `${e}T23:59:59`)
    
    if (filterId) winnerQuery = winnerQuery.in('user_id', filterId.split(','))

    const [
      { count: totalLeads },
      { count: newLeads },
      { count: converted },
      { count: totalCalls },
      { count: connectedCalls },
      { data: winnersData } // For Top Performer Calculation
    ] = await Promise.all([
      buildQuery('leads'),
      buildQuery('leads', 'status', 'new'),
      buildQuery('leads', 'status', 'closed_won'),
      buildQuery('call_logs'),
      buildQuery('call_logs', 'call_status', 'connected'),
      winnerQuery
    ])

    return {
      leads: totalLeads || 0,
      new: newLeads || 0,
      converted: converted || 0,
      calls: totalCalls || 0,
      connected: connectedCalls || 0,
      winnersData: winnersData || []
    }
  }

  // 4. Parallel Execution
  const [current, previous] = await Promise.all([
    fetchPeriodData(startDate, endDate),
    fetchPeriodData(prevStartDate, prevEndDate)
  ])

  // 5. Calculate Top Performer (Based on user_id from call_logs)
  const winnerMap = current.winnersData.reduce((acc: Record<string, number>, curr: any) => {
    acc[curr.user_id] = (acc[curr.user_id] || 0) + 1
    return acc
  }, {})
  
  const topPerformerId = Object.keys(winnerMap).reduce((a, b) => winnerMap[a] > winnerMap[b] ? a : b, "")
  const topPerformerCount = winnerMap[topPerformerId] || 0
  const topPerformerName = telecallers?.find((t: any) => t.id === topPerformerId)?.full_name || "N/A"

  // 6. Metrics & Summary Generation
  const calculateTrend = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 100)
  }

  const currentConvRate = current.leads > 0 ? (current.converted / current.leads) * 100 : 0
  const prevConvRate = previous.leads > 0 ? (previous.converted / previous.leads) * 100 : 0
  const leadTrend = calculateTrend(current.leads, previous.leads)
  
  // Smart Summary Text
  let summaryText = "Performance is stable."
  let summaryColor = "bg-blue-50 text-blue-700 border-blue-200"
  let SummaryIcon = CheckCircle2

  if (leadTrend >= 10 && currentConvRate >= prevConvRate) {
    summaryText = "🚀 Excellent Growth! Leads and conversions are both up."
    summaryColor = "bg-green-50 text-green-700 border-green-200"
    SummaryIcon = TrendingUp
  } else if (leadTrend >= 10 && currentConvRate < prevConvRate) {
    summaryText = "⚠️ Volume is up, but quality dropped. Check lead sources."
    summaryColor = "bg-yellow-50 text-yellow-700 border-yellow-200"
    SummaryIcon = AlertCircle
  } else if (leadTrend < -10) {
    summaryText = "📉 Lead volume is down significantly. Marketing check needed."
    summaryColor = "bg-red-50 text-red-700 border-red-200"
    SummaryIcon = TrendingDown
  }

  interface StatItem {
    title: string
    value: string | number
    trend?: number
    isPercentage?: boolean
    isSpecial?: boolean
    subtitle?: string
    icon: any
    color: string
    bgColor: string
  }

  // Stats Array
  const stats: StatItem[] = [
    {
      title: "Total Leads",
      value: current.leads,
      trend: leadTrend,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "New Leads",
      value: current.new,
      trend: calculateTrend(current.new, previous.new),
      icon: BarChart3,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Conversion Rate",
      value: `${currentConvRate.toFixed(1)}%`,
      trend: Math.round(currentConvRate - prevConvRate),
      isPercentage: true,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Top Performer",
      isSpecial: true, // Marker for custom card render
      value: topPerformerName,
      subtitle: `${topPerformerCount} Calls`, // Updated from Conversions to Calls
      icon: Trophy,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6 bg-slate-50/30 dark:bg-slate-950/10 min-h-screen animate-in fade-in duration-300">
      
      {/* 1. Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Executive Reports
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <span>Reporting period: <span className="font-semibold text-slate-700 dark:text-slate-300">{new Date(startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span> – <span className="font-semibold text-slate-700 dark:text-slate-300">{new Date(endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons startDate={startDate} endDate={endDate} telecallerId={filterId} />
        </div>
      </div>

      {/* 2. Filters (Admin Only) */}
      {userProfile?.role !== 'telecaller' && (
        <Card className="border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-4 bg-slate-50/50 dark:bg-slate-950/20">
            <ReportsFilters telecallers={telecallers || []} defaultStartDate={startDate} defaultEndDate={endDate} />
          </CardContent>
        </Card>
      )}

      {/* 3. Smart Insight Banner */}
      <div className={`p-4.5 rounded-2xl border flex items-center gap-3.5 shadow-sm transition-all duration-300 ${
        leadTrend >= 10 && currentConvRate >= prevConvRate
          ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20"
          : leadTrend >= 10 && currentConvRate < prevConvRate
          ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20"
          : leadTrend < -10
          ? "bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/20"
          : "bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/20"
      }`}>
        <div className="flex-shrink-0 p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm">
          <Sparkles className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400 animate-pulse" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1">AI Performance Summary</span>
          <span className="text-sm font-semibold tracking-tight">{summaryText}</span>
        </div>
      </div>

      {/* 4. KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          if (stat.isSpecial) {
            // Special Render for Top Performer
            return (
              <Card key={index} className="relative overflow-hidden border border-amber-200/80 dark:border-amber-950 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white dark:to-slate-900 shadow-sm hover:shadow-md transition-all duration-300 group rounded-2xl">
                <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-amber-500 to-yellow-500" />
                <CardContent className="p-6 relative overflow-hidden">
                  <div className="absolute -right-2 -bottom-2 opacity-5 dark:opacity-10 group-hover:scale-110 transition-transform duration-500">
                    <Trophy className="h-28 w-28 text-amber-500" />
                  </div>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Trophy className="h-3.5 w-3.5 text-amber-500" /> Top Performer
                      </p>
                      <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-2 truncate max-w-[170px]">{stat.value}</p>
                      <div className="pt-2">
                        <Badge className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30 hover:bg-amber-200/50 font-bold shadow-none text-xs rounded-lg py-1 px-2.5">
                          {stat.subtitle}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-sm">
                      <Trophy className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          }

          const isPositive = (stat.trend ?? 0) >= 0
          const trendValue = Math.abs(stat.trend ?? 0)
          
          let gradientColor = "from-blue-500 to-indigo-500"
          if (index === 1) gradientColor = "from-emerald-500 to-teal-500"
          if (index === 2) gradientColor = "from-purple-500 to-pink-500"

          return (
            <Card key={index} className="relative overflow-hidden border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-300 group rounded-2xl">
              <div className={`absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r ${gradientColor}`} />
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.title}</p>
                    <p className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 mt-2">{stat.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-xl ${
                    index === 0 ? "bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400" :
                    index === 1 ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                    "bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400"
                  } shadow-sm group-hover:scale-105 transition-transform duration-300`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-4">
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold ${
                    isPositive 
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100/60 dark:border-emerald-900/30' 
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-100/60 dark:border-rose-900/30'
                  }`}>
                    {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {isPositive ? '+' : '-'}{trendValue}%
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">vs previous period</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 5. Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-200">
              <BarChart3 className="h-4.5 w-4.5 text-blue-500" />
              Daily Activity Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Suspense fallback={<div className="h-64 bg-slate-50 dark:bg-slate-900/50 animate-pulse rounded-xl flex items-center justify-center text-slate-400 text-sm">Loading Chart...</div>}>
              <PerformanceChart startDate={startDate} endDate={endDate} telecallerId={filterId} />
            </Suspense>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-200">
              <TrendingUp className="h-4.5 w-4.5 text-purple-500" />
              Lead Conversion Funnel
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Suspense fallback={<div className="h-64 bg-slate-50 dark:bg-slate-900/50 animate-pulse rounded-xl flex items-center justify-center text-slate-400 text-sm">Loading Funnel...</div>}>
              <LeadConversionChart startDate={startDate} endDate={endDate} telecallerId={filterId} />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-200">
              <TrendingUp className="h-4.5 w-4.5 text-emerald-500" />
              6-Month Revenue Forecast
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Suspense fallback={<div className="h-64 bg-slate-50 dark:bg-slate-900/50 animate-pulse rounded-xl flex items-center justify-center text-slate-400 text-sm">Loading Chart...</div>}>
              <RevenueForecastChart startDate={startDate} endDate={endDate} />
            </Suspense>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-200">
              <Users className="h-4.5 w-4.5 text-orange-500" />
              Lead Source ROI
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <Suspense fallback={<div className="h-64 bg-slate-50 dark:bg-slate-900/50 animate-pulse rounded-xl flex items-center justify-center text-slate-400 text-sm">Loading Chart...</div>}>
              <LeadSourceROIChart startDate={startDate} endDate={endDate} />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      {/* 6. Detailed Performance Table */}
      <Card className="border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden mt-6">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-200">
            <Users className="h-4.5 w-4.5 text-indigo-500" />
            Agent Performance Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 px-0 md:px-6">
          <Suspense fallback={<div className="h-32 bg-slate-50 dark:bg-slate-900/50 animate-pulse rounded-xl" />}>
            <TelecallerPerformance startDate={startDate} endDate={endDate} telecallerId={filterId} />
          </Suspense>
        </CardContent>
      </Card>

      {/* 7. Footer Link */}
      <div className="flex justify-center pb-8 pt-4">
        <Link href="/admin/reports/attendance" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 font-bold tracking-tight bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-full py-2 px-5 hover:shadow-md transition-all duration-300">
          View Detailed Attendance Report <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
