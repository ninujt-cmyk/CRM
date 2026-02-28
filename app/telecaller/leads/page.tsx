import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Filter, TrendingUp, Clock, LogIn, CheckCircle2 } from "lucide-react"
import { TelecallerLeadsTable } from "@/components/telecaller-leads-table"
import { TelecallerLeadFilters } from "@/components/telecaller-lead-filters"
import { TelecallerCreateLeadDialog } from "@/components/telecaller-create-lead-dialog" 
import { redirect } from "next/navigation"
import { Progress } from "@/components/ui/progress"

interface SearchParams {
  status?: string
  priority?: string
  search?: string
  source?: string
  date_range?: string
  page?: string
  sort_by?: string
  sort_order?: string
}

export default async function TelecallerLeadsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const page = Number(searchParams.page) || 1
  const pageSize = 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const sortBy = searchParams.sort_by || 'created_at'
  const sortOrder = searchParams.sort_order === 'asc'

  // Parallel Stats Fetching
  const [
    totalRes,
    newRes,
    contactedRes,
    loginRes,
    disbursedRes
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: 'exact', head: true }).eq("assigned_to", user.id),
    supabase.from("leads").select("*", { count: 'exact', head: true }).eq("assigned_to", user.id).in('status', ['new', 'New Lead']),
    supabase.from("leads").select("*", { count: 'exact', head: true }).eq("assigned_to", user.id).in('status', ['contacted', 'Interested']),
    supabase.from("leads").select("*", { count: 'exact', head: true }).eq("assigned_to", user.id).in('status', ['Login', 'Login Done']),
    supabase.from("leads").select("*", { count: 'exact', head: true }).eq("assigned_to", user.id).in('status', ['Disbursed', 'converted'])
  ])

  const totalCount = totalRes.count || 0;
  const newCount = newRes.count || 0;
  const contactedCount = contactedRes.count || 0;
  const loginCount = loginRes.count || 0;
  const disbursedCount = disbursedRes.count || 0;

  const contactRate = totalCount ? Math.round((contactedCount / totalCount) * 100) : 0;

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .eq("assigned_to", user.id)
    .order(sortBy, { ascending: sortOrder })
    .range(from, to)

  if (searchParams.status && searchParams.status !== "all") query = query.eq("status", searchParams.status)
  if (searchParams.priority && searchParams.priority !== "all") query = query.eq("priority", searchParams.priority)
  if (searchParams.search) {
    query = query.or(`name.ilike.%${searchParams.search}%,email.ilike.%${searchParams.search}%,phone.ilike.%${searchParams.search}%,company.ilike.%${searchParams.search}%`)
  }

  const { data: leads, count } = await query

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">My Leads</h1>
          <p className="text-slate-500 mt-1">Manage assignments and track conversions</p>
        </div>
        
        <div className="flex items-center gap-2">
           <TelecallerCreateLeadDialog currentUserId={user.id} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Assigned</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{totalCount}</div>
            <Progress value={100} className="h-1 mt-2 bg-blue-100" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">New Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{newCount}</div>
            <p className="text-xs text-slate-400 mt-2">Requires Action</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Contacted</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{contactedCount}</div>
            <Progress value={contactRate} className="h-1 mt-2 bg-purple-100" />
            <p className="text-[10px] text-purple-600 mt-1">{contactRate}% coverage</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Logins</CardTitle>
            <LogIn className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{loginCount}</div>
            <p className="text-xs text-slate-400 mt-2">Files Processed</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Disbursed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{disbursedCount}</div>
            <p className="text-xs text-green-600 mt-2 font-medium">Revenue Generated</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3 border-b bg-slate-50/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Filter className="h-4 w-4 text-slate-500" /> Lead Filters
            </CardTitle>
            <div className="text-xs font-medium text-slate-500 bg-white px-2.5 py-1 rounded-md border shadow-sm">
              Showing {leads?.length || 0} of {count} results
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <TelecallerLeadFilters initialSearchParams={searchParams} />
          <TelecallerLeadsTable 
            leads={leads || []} 
            totalCount={count || 0}
            currentPage={page}
            pageSize={pageSize}
            sortBy={sortBy}
            sortOrder={searchParams.sort_order || 'desc'}
          />
        </CardContent>
      </Card>
    </div>
  )
}
