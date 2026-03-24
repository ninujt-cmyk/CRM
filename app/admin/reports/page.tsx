import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, Calendar, TrendingUp, Users, TrendingDown, ArrowUpRight, ArrowDownRight, Trophy, AlertCircle, CheckCircle2 } from "lucide-react"
import { ReportsFilters } from "@/components/reports-filters"
import { PerformanceChart } from "@/components/performance-chart"
import { LeadConversionChart } from "@/components/lead-conversion-chart"
import { TelecallerPerformance } from "@/components/telecaller-performance"
import { ExportButtons } from "@/components/export-buttons"
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
  const winnerMap = current.winnersData.reduce((acc: Record<string, number>, curr) => {
    acc[curr.user_id] = (acc[curr.user_id] || 0) + 1
    return acc
  }, {})
  
  const topPerformerId = Object.keys(winnerMap).reduce((a, b) => winnerMap[a] > winnerMap[b] ? a : b, "")
  const topPerformerCount = winnerMap[topPerformerId] || 0
  const topPerformerName = telecallers?.find(t => t.id === topPerformerId)?.full_name || "N/A"

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

  // Stats Array
  const stats = [
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
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
      
      {/* 1. Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}</span>
          </p>
        </div>
        <ExportButtons startDate={startDate} endDate={endDate} telecallerId={filterId} />
      </div>

      {/* 2. Filters (Admin Only) */}
      {userProfile?.role !== 'telecaller' && (
        <Card className="border-none shadow-sm">
          <CardContent className="p-4">
            <ReportsFilters telecallers={telecallers || []} defaultStartDate={startDate} defaultEndDate={endDate} />
          </CardContent>
        </Card>
      )}

      {/* 3. Smart Insight Banner */}
      <div className={`p-4 rounded-lg border flex items-center gap-3 shadow-sm ${summaryColor}`}>
        <SummaryIcon className="h-5 w-5" />
        <span className="font-medium">{summaryText}</span>
      </div>

      {/* 4. KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          if (stat.isSpecial) {
            // Special Render for Top Performer
            return (
              <Card key={index} className="hover:shadow-md transition-shadow border-amber-200 bg-gradient-to-br from-amber-50 to-white">
                <CardContent className="p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-10"><Trophy className="h-24 w-24 text-amber-500" /></div>
                  <div className="relative z-10">
                    <p className="text-sm font-medium text-amber-700 flex items-center gap-1">
                      <Trophy className="h-4 w-4" /> Top Performer
                    </p>
                    <p className="text-2xl font-bold text-gray-900 mt-2 truncate">{stat.value}</p>
                    <Badge className="mt-2 bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200">
                      {stat.subtitle}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )
          }

          const isPositive = stat.trend >= 0
          return (
            <Card key={index} className="hover:shadow-md transition-shadow border-none shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                    <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      <span>{isPositive ? '+' : ''}{stat.trend}{stat.isPercentage ? '%' : '%'}</span>
                      <span className="text-gray-400 font-normal ml-1">vs prev</span>
                    </div>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 5. Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              Daily Activity Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-md flex items-center justify-center text-gray-400 text-sm">Loading Chart...</div>}>
              <PerformanceChart startDate={startDate} endDate={endDate} telecallerId={filterId} />
            </Suspense>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              Lead Conversion Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-md" />}>
              <LeadConversionChart startDate={startDate} endDate={endDate} telecallerId={filterId} />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      {/* 6. Detailed Performance Table */}
      <Card className="shadow-sm border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-indigo-500" />
            Agent Performance Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-32 bg-gray-100 animate-pulse rounded-md" />}>
            <TelecallerPerformance startDate={startDate} endDate={endDate} telecallerId={filterId} />
          </Suspense>
        </CardContent>
      </Card>

      {/* 7. Footer Link */}
      <div className="flex justify-center pb-8">
        <Link href="/admin/reports/attendance" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium transition-colors">
          View Detailed Attendance Report <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
