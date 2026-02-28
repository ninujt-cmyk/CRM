"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

// UI Components
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Icons
import { 
  Phone, Users, Clock, TrendingUp, 
  Rocket, RefreshCw, Plus, FileText, 
  AlertTriangle, Wallet
} from "lucide-react"

// Custom Components
import { TodaysTasks } from "@/components/todays-tasks"
import { AttendanceWidget } from "@/components/attendance-widget"
import { NotificationProvider } from "@/components/notification-provider"
import { NotificationBell } from "@/components/notifications/notification-bell" 
import { PerformanceMetrics } from "@/components/performance-metrics"
import { DailyTargetProgress } from "@/components/daily-target-progress"
import { ErrorBoundary } from "@/components/error-boundary"
import { EmptyState } from "@/components/empty-state"

interface DashboardStats {
  title: string
  value: number | string
  icon: React.ComponentType<any>
  color: string
  bgColor: string
  borderColor?: string
  description?: string
  trend?: "up" | "down" | "neutral"
}

interface DashboardData {
  user: any
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
  stats: {
    myLeads: number
    todaysCalls: number
    pendingFollowUps: number
    completedToday: number
    conversionRate: number
    successRate: number
  }
  targets: {
    monthly: number
    achieved: number
    dailyCalls: number
  }
}

const INCENTIVE_RATE = 0.005 

export default function TelecallerDashboard() {
  const router = useRouter()
  const supabase = createClient()
  
  const [data, setData] = useState<DashboardData>({
    user: null,
    isLoading: true,
    error: null,
    lastUpdated: null,
    stats: { myLeads: 0, todaysCalls: 0, pendingFollowUps: 0, completedToday: 0, conversionRate: 0, successRate: 0 },
    targets: { monthly: 2000000, achieved: 0, dailyCalls: 350 }
  })

  // --- DATA FETCHING ---
  const loadDashboardData = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        router.push("/auth/login")
        return
      }

      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [
        myLeadsRes,
        todaysCallsRes,
        pendingFollowUpsRes,
        completedTodayRes,
        userProfileRes,
        disbursedRes
      ] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("assigned_to", user.id),
        supabase.from("call_logs").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", startOfDay),
        supabase.from("follow_ups").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "pending"),
        supabase.from("follow_ups").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "completed").gte("completed_at", startOfDay),
        supabase.from("users").select("monthly_target").eq("id", user.id).maybeSingle(),
        supabase.from("leads").select("disbursed_amount").eq("assigned_to", user.id).ilike("status", "disbursed").gte("disbursed_at", startOfMonth)
      ])

      const monthlyTarget = userProfileRes.data?.monthly_target || 2000000
      const achievedAmount = disbursedRes.data?.reduce((sum, lead) => sum + Number(lead.disbursed_amount || 0), 0) || 0
      const todaysCalls = todaysCallsRes.count || 0
      const completedToday = completedTodayRes.count || 0
      const pendingFollowUps = pendingFollowUpsRes.count || 0

      const conversionRate = todaysCalls > 0 ? Math.round((completedToday / todaysCalls) * 100) : 0
      const successRate = (completedToday + pendingFollowUps) > 0 
        ? Math.round((completedToday / (completedToday + pendingFollowUps)) * 100) 
        : 0

      setData({
        user,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
        stats: { 
            myLeads: myLeadsRes.count || 0, 
            todaysCalls, 
            pendingFollowUps, 
            completedToday, 
            conversionRate, 
            successRate 
        },
        targets: { monthly: monthlyTarget, achieved: achievedAmount, dailyCalls: 350 }
      })

    } catch (err: any) {
      console.error("Dashboard Load Error:", err)
      setData(prev => ({ ...prev, isLoading: false, error: err.message || "Failed to load dashboard." }))
    }
  // 🔴 BUG FIX: Removed `supabase` from this array to stop infinite loop!
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    loadDashboardData()
    const interval = setInterval(loadDashboardData, 5 * 60 * 1000) 
    return () => clearInterval(interval)
  }, [loadDashboardData])

  // --- CALCULATIONS ---
  const pacing = useMemo(() => {
      const now = new Date()
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const currentDay = now.getDate()
      
      const expectedProgressPct = (currentDay / daysInMonth) * 100
      const actualProgressPct = (data.targets.achieved / data.targets.monthly) * 100
      const variance = actualProgressPct - expectedProgressPct

      return {
          expected: expectedProgressPct,
          actual: actualProgressPct,
          isAhead: variance >= 0,
          label: variance >= 0 ? `+${variance.toFixed(1)}% Ahead` : `${variance.toFixed(1)}% Behind`,
          color: variance >= 0 ? "text-green-600 bg-green-100" : "text-red-600 bg-red-100"
      }
  }, [data.targets])

  const estimatedIncentive = useMemo(() => {
      return Math.floor(data.targets.achieved * INCENTIVE_RATE)
  }, [data.targets.achieved])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val)

  const callShortage = Math.max(0, data.targets.dailyCalls - data.stats.todaysCalls)
  const isTargetMet = callShortage === 0

  const statsConfig: DashboardStats[] = [
    {
      title: "Est. Incentive",
      value: formatCurrency(estimatedIncentive),
      icon: Wallet,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-100",
      description: "Based on 0.5% comm.(without Target completion no Incentive)",
      trend: "up"
    },
    {
      title: "Calls Today",
      value: data.stats.todaysCalls,
      icon: Phone,
      color: isTargetMet ? "text-green-600" : "text-blue-600",
      bgColor: isTargetMet ? "bg-green-50" : "bg-blue-50",
      borderColor: isTargetMet ? "border-green-100" : "border-blue-100",
      description: isTargetMet ? "Target Met! 🎉" : `${callShortage} calls to goal`
    },
    {
      title: "Pending Tasks",
      value: data.stats.pendingFollowUps,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-100",
      description: "Requires attention"
    },
    {
      title: "Total Leads",
      value: data.stats.myLeads,
      icon: Users,
      color: "text-slate-600",
      bgColor: "bg-slate-50",
      borderColor: "border-slate-200",
      description: "Assigned pool"
    }
  ]

  if (data.isLoading) return <DashboardSkeleton />

  if (data.error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
        <EmptyState 
          icon={AlertTriangle} 
          title="Connection Error" 
          description={data.error}
          action={{ label: "Retry Connection", onClick: loadDashboardData }}
        />
      </div>
    )
  }

  return (
    <NotificationProvider userId={data.user?.id}>
      <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto relative pb-24">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              {getGreeting()}, {data.user?.user_metadata?.full_name?.split(' ')[0]} 
              <span className="text-xl">👋</span>
            </h1>
            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                <span>Last updated: {data.lastUpdated?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                {data.stats.todaysCalls === 0 && <span className="text-orange-500 font-medium">• Start dialing to see stats!</span>}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <NotificationBell />
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="bg-white" onClick={loadDashboardData}>
                            <RefreshCw className="h-4 w-4 text-slate-600" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Refresh Data</TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <Button onClick={() => router.push("/leads/new")} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm hidden md:flex">
              <Plus className="h-4 w-4 mr-2" /> Add Lead
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsConfig.map((stat, i) => (
            <Card key={i} className={`shadow-sm border transition-all hover:shadow-md ${stat.borderColor}`}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.title}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-2xl font-bold text-slate-900">{stat.value}</span>
                    </div>
                    {stat.description && (
                        <div className="mt-1 flex items-center gap-1">
                            {stat.trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
                            <span className="text-[11px] font-medium text-slate-400">{stat.description}</span>
                        </div>
                    )}
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <Card className="border-none shadow-lg bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white overflow-hidden relative group">
              <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 -mr-10 transition-transform group-hover:-translate-x-2 duration-700" />
              <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                <div className="space-y-5 flex-1 w-full">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <h3 className="text-indigo-200 font-bold flex items-center gap-2 text-xs uppercase tracking-widest">
                        <Rocket className="h-4 w-4" /> Monthly Goal
                        </h3>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold tracking-tight">{formatCurrency(data.targets.achieved)}</span>
                            <span className="text-lg text-slate-400 font-light">/ {formatCurrency(data.targets.monthly)}</span>
                        </div>
                    </div>
                    <Badge className={`${pacing.color} border-0 px-3 py-1`}>
                        {pacing.label}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="relative h-3 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className="absolute top-0 bottom-0 w-0.5 bg-white/30 z-20" style={{ left: `${pacing.expected}%` }} />
                      <div 
                        className={`h-full transition-all duration-1000 ${pacing.isAhead ? "bg-gradient-to-r from-emerald-400 to-green-500" : "bg-gradient-to-r from-indigo-400 to-purple-400"}`}
                        style={{ width: `${Math.min(100, pacing.actual)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 font-medium">
                      <span>0%</span>
                      <span className="text-indigo-200">Current Pacing: {Math.round(pacing.actual)}%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 w-full md:w-auto">
                    <Button onClick={() => router.push("/telecaller/logins")} className="bg-white text-slate-900 hover:bg-indigo-50 font-semibold shadow-xl w-full">
                        <FileText className="h-4 w-4 mr-2" /> View Logins
                    </Button>
                    <p className="text-[10px] text-center text-slate-400">
                        {formatCurrency(Math.max(0, data.targets.monthly - data.targets.achieved))} to go
                    </p>
                </div>
              </CardContent>
            </Card>

            <DailyTargetProgress 
              userId={data.user?.id || ""} 
              targets={{ 
                daily_calls: data.targets.dailyCalls, 
                daily_completed: 20, 
                monthly_target: data.targets.monthly 
              }} 
              currentCalls={data.stats.todaysCalls}
              currentCompleted={data.stats.completedToday}
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-indigo-600" /> Today's Schedule
                </h3>
              </div>
              
              <ErrorBoundary fallback={<EmptyState icon={AlertTriangle} title="Error" description="Failed to load tasks." />}>
                <TodaysTasks userId={data.user?.id || ""} />
              </ErrorBoundary>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <ErrorBoundary fallback={null}>
              <AttendanceWidget />
            </ErrorBoundary>

            <ErrorBoundary fallback={null}>
              <PerformanceMetrics 
                userId={data.user?.id || ""}
                conversionRate={data.stats.conversionRate}
                successRate={data.stats.successRate}
                avgCallDuration={5} 
              />
            </ErrorBoundary>

            {!isTargetMet && (
              <Alert variant="destructive" className="bg-red-50 border-red-100 shadow-sm">
                <div className="flex gap-3">
                    <div className="p-2 bg-red-100 rounded-full h-fit">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                        <AlertTitle className="text-red-800 font-bold mb-1">Catch Up Needed</AlertTitle>
                        <AlertDescription className="text-red-600 text-xs">
                        You are behind by <strong>{callShortage} calls</strong> today.
                        </AlertDescription>
                    </div>
                </div>
              </Alert>
            )}
          </div>
        </div>

        <div className="md:hidden fixed bottom-6 right-6 z-50">
            <Button 
                className="rounded-full h-14 w-14 shadow-2xl bg-indigo-600 hover:bg-indigo-700"
                onClick={() => router.push("/leads/new")}
            >
                <Plus className="h-6 w-6" />
            </Button>
        </div>
      </div>
    </NotificationProvider>
  )
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="space-y-3"><Skeleton className="h-8 w-64 rounded-md" /><Skeleton className="h-4 w-40 rounded-md" /></div>
        <div className="flex gap-3"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-10 w-10 rounded-md" /><Skeleton className="h-10 w-32 rounded-md hidden md:block" /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 h-[120px] flex justify-between">
            <div className="space-y-3 w-2/3"><Skeleton className="h-3 w-20" /><Skeleton className="h-8 w-16" /><Skeleton className="h-3 w-24" /></div>
            <Skeleton className="h-10 w-10 rounded-xl" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="h-[220px] w-full rounded-xl bg-slate-200 animate-pulse relative overflow-hidden"><div className="absolute inset-0 bg-gradient-to-r from-slate-200 to-slate-300" /></div>
          <div className="h-[300px] bg-white rounded-xl border border-slate-200 p-6 space-y-6"><div className="flex justify-between"><Skeleton className="h-6 w-32" /><Skeleton className="h-6 w-24 rounded-full" /></div><div className="space-y-4"><Skeleton className="h-20 w-full rounded-lg" /><Skeleton className="h-20 w-full rounded-lg" /></div></div>
          <div className="space-y-4"><Skeleton className="h-7 w-40" /><div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg border border-slate-200" />)}</div></div>
        </div>
        <div className="lg:col-span-4 space-y-8">
          <Skeleton className="h-[250px] w-full rounded-xl" /> 
          <div className="h-[350px] bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between"><Skeleton className="h-6 w-40 mb-4" /><div className="grid grid-cols-2 gap-4"><Skeleton className="h-24 w-full rounded-full" /><Skeleton className="h-24 w-full rounded-full" /></div><Skeleton className="h-12 w-full rounded-md mt-4" /></div>
        </div>
      </div>
    </div>
  )
}
