import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { FileText, Users, Phone, Clock, Activity, PieChart } from "lucide-react"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic" 

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

async function DashboardContent() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  const tenantId = profile?.tenant_id
  if (!tenantId) return <div className="p-6 text-red-500">Error: Workspace not found.</div>

  const todayStr = new Date().toISOString().split('T')[0];

  // 🔴 THE FIX: Fetch minimal data and count it safely in memory. No SQL RPC needed.
  const [
    { data: allLeads },
    { count: activeTelecallers },
    { count: todaysCalls },
    { data: recentLeads }
  ] = await Promise.all([
    // Fetch ONLY the status column. This is incredibly fast even for 100k+ rows.
    supabase.from("leads").select("status").eq('tenant_id', tenantId),
    supabase.from("users").select("*", { count: "exact", head: true }).eq('tenant_id', tenantId).eq("role", "telecaller").eq("is_active", true),
    supabase.from("call_logs").select("*", { count: "exact", head: true }).eq('tenant_id', tenantId).gte("created_at", todayStr),
    supabase.from("leads").select("id, name, created_at, status").eq('tenant_id', tenantId).order("created_at", { ascending: false }).limit(5),
  ])

  // Safely calculate all stats
  const totalLeads = allLeads?.length || 0;
  const pendingFollowUps = allLeads?.filter(l => l.status === 'follow_up').length || 0;

  // Aggregate statuses for the pie chart
  const statusCounts: Record<string, number> = {}
  allLeads?.forEach((lead) => {
    const status = lead.status || "new"
    statusCounts[status] = (statusCounts[status] || 0) + 1
  })

  const chartData = Object.entries(statusCounts)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Leads" value={totalLeads} icon={<FileText className="h-5 w-5 text-white" />} description="In your workspace" bgClass="bg-slate-900 text-white" />
        <StatsCard title="Active Telecallers" value={activeTelecallers || 0} icon={<Users className="h-5 w-5 text-white" />} description="In your workspace" bgClass="bg-indigo-600 text-white" />
        <StatsCard title="Today's Calls" value={todaysCalls || 0} icon={<Phone className="h-5 w-5 text-white" />} description="Made by your team" bgClass="bg-emerald-700 text-white" />
        <StatsCard title="Pending Follow-ups" value={pendingFollowUps} icon={<Clock className="h-5 w-5 text-white" />} description="Requiring attention" bgClass="bg-orange-500 text-white" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 shadow-sm border-slate-200">
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Recent Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLeads?.map((lead: any) => (
                  <div key={lead.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm text-gray-900">{lead.name || "Unnamed Lead"}</span>
                      <span className="text-xs text-gray-500">{new Date(lead.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 rounded-full capitalize">{lead.status?.replace('_', ' ') || "New"}</div>
                  </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 shadow-sm border-slate-200">
          <CardHeader><CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5" /> Lead Status Overview</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4 pt-2">
              {chartData.map((item) => {
                  const percentage = totalLeads > 0 ? Math.round((item.count / totalLeads) * 100) : 0;
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
                })}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function StatsCard({ title, value, icon, description, bgClass }: any) {
  return (
    <Card className={`shadow-sm border-0 ${bgClass}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="p-2 rounded-full bg-white/10">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs mt-1 opacity-80">{description}</p>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return <div className="p-10 text-center text-slate-500">Loading Dashboard...</div>
}
