import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { FileText, Users, Phone, Clock, Activity, PieChart } from "lucide-react"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic" 

// --- MAIN PAGE COMPONENT ---
export default function AdminDashboard() {
  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Workspace Dashboard</h1>
        <p className="text-gray-500 mt-2">Real-time overview of your company's performance</p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}

// --- DATA FETCHING COMPONENT ---
async function DashboardContent() {
  const supabase = await createClient()

  // 1. MUST INITIALIZE USER SESSION FIRST IN SERVER COMPONENTS
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // 2. Fetch the user's specific Tenant ID
  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()

  const tenantId = profile?.tenant_id

  if (!tenantId) {
    return <div className="p-6 text-red-500">Error: Your account is not linked to a workspace.</div>
  }

  // 3. EXPLICITLY FILTER EVERY QUERY BY TENANT_ID (The Double-Lock)
  const [
    { count: totalLeads },
    { count: activeTelecallers },
    { count: todaysCalls },
    { count: pendingFollowUps },
    { data: recentLeads },
    { data: leadStatuses }
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq('tenant_id', tenantId), // 🔴 Locked
      
    supabase.from("users").select("*", { count: "exact", head: true })
      .eq('tenant_id', tenantId) // 🔴 Locked
      .eq("role", "telecaller")
      .eq("is_active", true),
      
    supabase.from("call_logs").select("*", { count: "exact", head: true })
      .eq('tenant_id', tenantId) // 🔴 Locked
      .gte("created_at", new Date().toISOString().split('T')[0]),
      
    supabase.from("leads").select("*", { count: "exact", head: true })
      .eq('tenant_id', tenantId) // 🔴 Locked
      .eq("status", "follow_up"),
      
    supabase.from("leads").select("id, name, created_at, status")
      .eq('tenant_id', tenantId) // 🔴 Locked
      .order("created_at", { ascending: false }).limit(5),
      
    supabase.from("leads").select("status")
      .eq('tenant_id', tenantId) // 🔴 Locked
  ])

  // Calculate Chart Data
  const statusCounts: Record<string, number> = {}
  leadStatuses?.forEach((lead) => {
    const status = lead.status || "Unknown"
    statusCounts[status] = (statusCounts[status] || 0) + 1
  })

  const chartData = Object.entries(statusCounts)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  return (
    <>
      {/* PREMIUM STATS GRID */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard 
          title="Total Leads" 
          value={totalLeads || 0} 
          icon={<FileText className="h-5 w-5 text-white" />} 
          description="In your workspace"
          bgClass="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0 shadow-md"
          iconBgClass="bg-white/10"
          descClass="text-slate-300"
        />
        <StatsCard 
          title="Active Telecallers" 
          value={activeTelecallers || 0} 
          icon={<Users className="h-5 w-5 text-white" />} 
          description="In your workspace"
          bgClass="bg-gradient-to-br from-indigo-600 to-indigo-600 text-white border-0 shadow-md"
          iconBgClass="bg-white/10"
          descClass="text-indigo-200"
        />
        <StatsCard 
          title="Today's Calls" 
          value={todaysCalls || 0} 
          icon={<Phone className="h-5 w-5 text-white" />} 
          description="Made by your team"
          bgClass="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white border-0 shadow-md"
          iconBgClass="bg-white/10"
          descClass="text-emerald-200"
        />
        <StatsCard 
          title="Pending Follow-ups" 
          value={pendingFollowUps || 0} 
          icon={<Clock className="h-5 w-5 text-white" />} 
          description="Requiring attention"
          bgClass="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0 shadow-md"
          iconBgClass="bg-white/10"
          descClass="text-amber-100"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* RECENT ACTIVITY LIST */}
        <Card className="col-span-4 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLeads && recentLeads.length > 0 ? (
                recentLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm text-gray-900">{lead.name || "Unnamed Lead"}</span>
                      <span className="text-xs text-gray-500">Added • {new Date(lead.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 rounded-full capitalize">
                      {lead.status?.replace('_', ' ') || "New"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No recent leads found.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* LEAD STATUS CHART */}
        <Card className="col-span-3 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" /> Lead Status Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 pt-2">
              {chartData.length > 0 ? (
                chartData.map((item) => {
                  const percentage = Math.round((item.count / (totalLeads || 1)) * 100)
                  return (
                    <div key={item.status} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium capitalize">{item.status.replace('_', ' ')}</span>
                        <span className="text-gray-500">{item.count} ({percentage}%)</span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">
                  No data available for chart
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function StatsCard({ title, value, icon, description, bgClass, iconBgClass, descClass }: any) {
  return (
    <Card className={`shadow-sm ${bgClass || "border-slate-200"}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-full ${iconBgClass || "bg-slate-50"}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className={`text-xs mt-1 ${descClass || "text-slate-500"}`}>{description}</p>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[60px] mb-2" />
              <Skeleton className="h-3 w-[120px]" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader><Skeleton className="h-6 w-[140px]" /></CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[150px]" />
                  <Skeleton className="h-3 w-[100px]" />
                </div>
                <Skeleton className="h-6 w-[80px] rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader><Skeleton className="h-6 w-[180px]" /></CardHeader>
          <CardContent className="space-y-6 pt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-[80px]" />
                  <Skeleton className="h-3 w-[40px]" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
