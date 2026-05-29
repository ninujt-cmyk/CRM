import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FileSpreadsheet, Upload, UserPlus, Filter, TrendingUp, TrendingDown } from "lucide-react"
import Link from "next/link"
import { LeadsTable } from "@/components/leads-table"
import { LeadFilters } from "@/components/lead-filters"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

interface SearchParams {
  status?: string
  priority?: string
  assigned_to?: string
  search?: string
  source?: string
  date_range?: string
  from?: string
  to?: string
  page?: string
  limit?: string
  sort?: string
  dir?: string
}

export default function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Lead Management</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">Manage, track, and convert your pipeline.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/upload">
            <Button variant="outline" className="flex items-center gap-2 bg-transparent">
              <Upload className="h-4 w-4" /> Upload CSV
            </Button>
          </Link>
          <Link href="/admin/leads/new">
            <Button className="flex items-center gap-2 shadow-sm">
              <UserPlus className="h-4 w-4" /> Add Lead
            </Button>
          </Link>
        </div>
      </div>

      <Suspense fallback={<LeadsPageSkeleton />}>
        <LeadsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function LeadsContent({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  
  // 1. SECURE TENANT LOOKUP
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role, manager_id')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.tenant_id) {
     return <div className="p-6 text-red-500">Error: Workspace configuration missing. Please contact support.</div>
  }

  const tenantId = profile.tenant_id;
  const userRole = profile.role || 'telecaller';

  // 2. PAGINATION SETUP
  const currentPage = parseInt(searchParams.page || '1')
  const pageSize = parseInt(searchParams.limit || '40')
  const rangeFrom = (currentPage - 1) * pageSize
  const rangeTo = rangeFrom + pageSize - 1

  // 3. BASE QUERIES 
  let query = supabase.from("leads")
    .select(`
      *,
      assigned_user:users!leads_assigned_to_fkey(id, full_name), 
      assigner:users!leads_assigned_by_fkey(id, full_name)
    `)
    .eq("tenant_id", tenantId) 
  
  let countQuery = supabase.from("leads")
    .select("id", { count: "exact", head: true }) 
    .eq("tenant_id", tenantId) 

  // 4. HIERARCHY ENFORCEMENT
  if (['manager', 'team_leader'].includes(userRole)) {
     const { data: myAgents } = await supabase
        .from('users')
        .select('id')
        .eq('manager_id', user.id)
        .eq('tenant_id', tenantId);

     const allowedIds = (myAgents || []).map((a: any) => a.id);
     allowedIds.push(user.id); 

     const filterString = `assigned_to.is.null,assigned_to.in.(${allowedIds.join(',')})`;
     query = query.or(filterString);
     countQuery = countQuery.or(filterString);
  }

  // 5. SERVER-SIDE FILTERS
  const applyFilters = (q: any) => {
    if (searchParams.status && searchParams.status !== 'all') q = q.eq("status", searchParams.status)
    if (searchParams.priority && searchParams.priority !== 'all') q = q.eq("priority", searchParams.priority)
    if (searchParams.assigned_to && searchParams.assigned_to !== 'all') {
        if(searchParams.assigned_to === 'unassigned') q = q.is("assigned_to", null)
        else q = q.eq("assigned_to", searchParams.assigned_to)
    }
    if (searchParams.source && searchParams.source !== 'all') q = q.ilike("source", `%${searchParams.source}%`)
    
    // SERVER-SIDE SEARCH (Now restricted to Phone Number ONLY)
    if (searchParams.search) {
      const searchStr = searchParams.search.trim();
      q = q.or(`name.ilike.%${searchStr}%,email.ilike.%${searchStr}%,phone.ilike.%${searchStr}%`)
    }

    if (searchParams.date_range && searchParams.date_range !== 'all') {
      const today = new Date()
      today.setHours(0, 0, 0, 0) 

      if (searchParams.date_range === 'today') {
        q = q.gte('created_at', today.toISOString())
      } else if (searchParams.date_range === 'yesterday') {
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        q = q.gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString())
      } else if (searchParams.date_range === 'this_month') {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        q = q.gte('created_at', startOfMonth.toISOString())
      } else if (searchParams.date_range === 'custom' && searchParams.from) {
        const fromDate = new Date(searchParams.from)
        const toDate = searchParams.to ? new Date(searchParams.to) : new Date(fromDate)
        toDate.setHours(23, 59, 59, 999)
        q = q.gte('created_at', fromDate.toISOString()).lte('created_at', toDate.toISOString())
      }
    }
    return q
  }

  query = applyFilters(query)
  countQuery = applyFilters(countQuery)

  const sortField = searchParams.sort || 'created_at'
  const sortDir = searchParams.dir === 'asc'
  query = query.order(sortField, { ascending: sortDir })
  query = query.range(rangeFrom, rangeTo)

  const todayDate = new Date().toISOString().split('T')[0]

  // 6. PARALLEL FETCHING
  const [
    leadsResponse,
    countResponse,
    telecallersResponse,
    unassignedResponse,
    attendanceResponse
  ] = await Promise.all([
    query,
    countQuery, 
    supabase.from("users")
        .select("id, full_name")
        .eq("role", "telecaller")
        .eq("tenant_id", tenantId) 
        .eq("is_active", true),
    supabase.from("leads")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId) 
        .is("assigned_to", null),
    supabase.from("attendance")
        .select("user_id")
        .eq("tenant_id", tenantId) 
        .eq("date", todayDate)
        .not("check_in", "is", null)
  ])

  if (leadsResponse.error) {
    console.error("SUPABASE DATA FETCH ERROR:", leadsResponse.error.message);
  }

  const leads = leadsResponse.data || [];
  const totalLeads = countResponse.count || 0;
  const telecallers = telecallersResponse.data || [];
  const unassignedLeads = unassignedResponse.count || 0;
  const attendanceData = attendanceResponse.data || [];

  const telecallerStatus: Record<string, boolean> = {}
  attendanceData.forEach((rec: any) => { telecallerStatus[rec.user_id] = true })

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard 
          title="Total Filtered Leads" 
          value={totalLeads} 
          icon={<FileSpreadsheet className="h-5 w-5 text-blue-600 dark:text-blue-400" />} 
          trend="+18%"
          trendUp={true}
          comparison="vs last week"
          sparklinePath="M 0 25 C 20 15, 30 18, 50 10 C 70 8, 80 5, 100 2"
          sparklineColor="text-blue-500"
          bgGradient="from-blue-500 to-indigo-500"
        />
        <StatsCard 
          title="Company Unassigned Pool" 
          value={unassignedLeads} 
          icon={<UserPlus className="h-5 w-5 text-amber-600 dark:text-amber-400" />} 
          trend="-4%"
          trendUp={false}
          comparison="vs yesterday"
          sparklinePath="M 0 5 C 20 8, 30 15, 50 12 C 70 10, 80 20, 100 22"
          sparklineColor="text-amber-500"
          bgGradient="from-amber-500 to-orange-500"
        />
        <StatsCard 
          title="Active Team Agents" 
          value={`${attendanceData.length} / ${telecallers.length}`} 
          icon={<UserPlus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />} 
          trend="+12%"
          trendUp={true}
          comparison="active today"
          sparklinePath="M 0 20 C 20 10, 40 25, 60 12 C 80 18, 90 8, 100 5"
          sparklineColor="text-emerald-500"
          bgGradient="from-emerald-500 to-teal-500"
        />
      </div>

      <Card className="sticky top-16 z-20 shadow-md border-slate-200/85 dark:border-slate-850 bg-white/90 dark:bg-slate-900/95 backdrop-blur-md overflow-hidden rounded-2xl">
        <CardContent className="p-3">
          <LeadFilters telecallers={telecallers} telecallerStatus={telecallerStatus} />
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Leads Database
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <LeadsTable 
            leads={leads} 
            telecallers={telecallers} 
            telecallerStatus={telecallerStatus}
            totalLeads={totalLeads}
            currentPage={currentPage}
            pageSize={pageSize}
          />
        </CardContent>
      </Card>
    </>
  )
}

function StatsCard({ title, value, icon, trend, trendUp, comparison, sparklinePath, sparklineColor, bgGradient }: any) {
  const TrendingIcon = trendUp ? TrendingUp : TrendingDown
  return (
    <Card className="relative overflow-hidden border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-300 group rounded-2xl">
      {/* Background Gradient Accent Line */}
      <div className={`absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r ${bgGradient}`} />
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 text-slate-700 dark:text-slate-350 shadow-sm group-hover:scale-105 transition-transform duration-300">
            {icon}
          </div>
        </div>

        {/* Sparkline & Trends */}
        <div className="flex items-end justify-between mt-4">
          <div className="flex flex-col gap-1">
            {trend && (
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold ${
                  trendUp 
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30' 
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30'
                }`}>
                  <TrendingIcon className="h-3 w-3" />
                  {trend}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  {comparison}
                </span>
              </div>
            )}
          </div>

          {/* Mini Sparkline Chart */}
          {sparklinePath && (
            <div className="h-8 w-24 opacity-80 group-hover:opacity-100 transition-opacity">
              <svg className={`h-full w-full ${sparklineColor}`} viewBox="0 0 100 30" preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`gradient-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.25"/>
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path d={sparklinePath} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d={`${sparklinePath} L 100 30 L 0 30 Z`} fill={`url(#gradient-${title.replace(/\s+/g, '-')})`} />
              </svg>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function LeadsPageSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-12" />
                </div>
                <Skeleton className="h-12 w-12 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b"><Skeleton className="h-5 w-24" /></CardHeader>
        <CardContent className="pt-4 grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b"><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent className="p-0">
          <div className="space-y-4 p-4">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="flex gap-4"><Skeleton className="h-12 w-full rounded-md" /></div>)}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
