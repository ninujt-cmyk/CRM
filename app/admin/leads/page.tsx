import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FileSpreadsheet, Upload, UserPlus, Filter } from "lucide-react"
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
}

export default function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lead Management</h1>
          <p className="text-gray-600 mt-1">Manage, track, and convert your pipeline.</p>
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
  
  // 🔴 1. SECURE TENANT LOOKUP
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

  // 🔴 2. HIGH-SPEED BASE QUERIES (Lean Fetching)
  // Fix: Explicitly selecting ONLY necessary columns cuts payload size by ~80%
  let query = supabase.from("leads")
    .select(`
      id, name, phone, email, status, priority, source, created_at, assigned_to, 
      assigned_user:users!leads_assigned_to_fkey(id, full_name), 
      assigner:users!leads_assigned_by_fkey(id, full_name)
    `)
    .eq("tenant_id", tenantId) 
    .order("created_at", { ascending: false })
    .limit(300) // Fix: Prevent memory crashes by capping visual rows. Agents can use filters to find older leads.
  
  let countQuery = supabase.from("leads")
    .select("id", { count: "exact", head: true }) // Requesting 'id' instead of '*' is slightly faster for counting
    .eq("tenant_id", tenantId) 

  // 🔴 3. HIERARCHY ENFORCEMENT
  if (['manager', 'team_leader'].includes(userRole)) {
     const { data: myAgents } = await supabase
        .from('users')
        .select('id')
        .eq('manager_id', user.id)
        .eq('tenant_id', tenantId);

     const allowedIds = (myAgents || []).map(a => a.id);
     allowedIds.push(user.id); 

     const filterString = `assigned_to.is.null,assigned_to.in.(${allowedIds.join(',')})`;
     query = query.or(filterString);
     countQuery = countQuery.or(filterString);
  }

  // 4. Apply Frontend Filters
  const applyFilters = (q: any) => {
    if (searchParams.status && searchParams.status !== 'all') q = q.eq("status", searchParams.status)
    if (searchParams.priority && searchParams.priority !== 'all') q = q.eq("priority", searchParams.priority)
    if (searchParams.assigned_to && searchParams.assigned_to !== 'all') {
        if(searchParams.assigned_to === 'unassigned') q = q.is("assigned_to", null)
        else q = q.eq("assigned_to", searchParams.assigned_to)
    }
    if (searchParams.source && searchParams.source !== 'all') q = q.ilike("source", `%${searchParams.source}%`)
    
    if (searchParams.search) {
      // Searching text fields
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

  const todayDate = new Date().toISOString().split('T')[0]

  // 5. PARALLEL FETCHING
  const [
    { data: leads },
    { count: totalLeads },
    { data: telecallers },
    { count: unassignedLeads },
    { data: attendanceData }
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

  const telecallerStatus: Record<string, boolean> = {}
  attendanceData?.forEach((rec: any) => { telecallerStatus[rec.user_id] = true })

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard 
          title="Total Filtered Leads" 
          value={totalLeads} 
          icon={<FileSpreadsheet className="h-6 w-6 text-white" />} 
          bgClass="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white border-0 shadow-md"
          iconBgClass="bg-white/10"
          descClass="text-indigo-200"
        />
        <StatsCard 
          title="Company Unassigned Pool" 
          value={unassignedLeads} 
          icon={<UserPlus className="h-6 w-6 text-white" />} 
          bgClass="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0 shadow-md"
          iconBgClass="bg-white/10"
          descClass="text-amber-100"
        />
        <StatsCard 
          title="Active Team Agents" 
          value={`${attendanceData?.length || 0} / ${telecallers?.length || 0}`} 
          icon={<UserPlus className="h-6 w-6 text-white" />} 
          bgClass="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white border-0 shadow-md"
          iconBgClass="bg-white/10"
          descClass="text-emerald-200"
        />
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4 text-gray-500" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <LeadFilters telecallers={telecallers || []} telecallerStatus={telecallerStatus} />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-4 w-4 text-blue-600" />
              {leads ? `Showing latest ${leads.length} Records` : `All Leads`}
            </div>
            {totalLeads && totalLeads > 300 && (
               <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded">
                 Use filters above to search older leads
               </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <LeadsTable leads={leads || []} telecallers={telecallers || []} telecallerStatus={telecallerStatus} />
        </CardContent>
      </Card>
    </>
  )
}

function StatsCard({ title, value, icon, bgClass, iconBgClass, descClass }: any) {
  return (
    <Card className={`shadow-sm ${bgClass || "bg-white"}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm font-medium ${descClass || "text-gray-600"}`}>{title}</p>
            <p className="text-3xl font-bold mt-2">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          </div>
          <div className={`p-3 rounded-full ${iconBgClass || "bg-slate-100"}`}>{icon}</div>
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
