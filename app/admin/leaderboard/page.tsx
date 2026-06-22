import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { Trophy, Medal, Target, TrendingUp, IndianRupee, Flame } from "lucide-react"
import { redirect } from "next/navigation"
import { Podium } from "@/components/podium"
import { LeaderboardList } from "@/components/leaderboard-list"

export const dynamic = "force-dynamic"

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  const tenantId = profile?.tenant_id
  if (!tenantId) return <div>Error: No tenant found</div>

  const { data: leaderboard } = await supabase
    .from('agent_leaderboard_view')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('total_revenue', { ascending: false })
    .order('deals_closed', { ascending: false })

  return (
    <div className="p-4 md:p-8 space-y-8 min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-3 text-slate-900 dark:text-white tracking-tight">
             <Trophy className="h-10 w-10 text-yellow-500 drop-shadow-md" /> 
             Sales Arena Leaderboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium text-lg">
            Compete, close deals, and climb the ranks. The top spot awaits!
          </p>
        </div>
        
        {/* Arena Stats Summary */}
        <div className="flex gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <div className="text-center px-4 border-r border-slate-200 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Revenue</p>
                <p className="text-2xl font-black text-emerald-600">
                    ₹{(leaderboard?.reduce((acc: number, curr: any) => acc + curr.total_revenue, 0) || 0).toLocaleString('en-IN')}
                </p>
            </div>
            <div className="text-center px-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Deals</p>
                <p className="text-2xl font-black text-blue-600">
                    {leaderboard?.reduce((acc: number, curr: any) => acc + curr.deals_closed, 0) || 0}
                </p>
            </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-12">
          
        {/* The Podium */}
        <section>
            <div className="text-center mb-2">
                <Badge variant="outline" className="px-3 py-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 mb-4 inline-flex items-center gap-1.5 uppercase font-bold tracking-widest text-xs">
                    <Flame className="h-3.5 w-3.5" /> Elite Performers
                </Badge>
            </div>
            <Podium topAgents={leaderboard?.slice(0, 3) || []} />
        </section>

        {/* The Ranks */}
        <section>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-6">Current Standings</h2>
            {leaderboard && leaderboard.length > 0 ? (
                <LeaderboardList agents={leaderboard} />
            ) : (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                    <p className="text-slate-500 font-medium">No agents have scored points yet.</p>
                    <p className="text-sm text-slate-400">Get on the phones and close some deals to populate the arena!</p>
                </div>
            )}
        </section>

      </div>
    </div>
  )
}

function Badge(props: any) {
    return <span className={`rounded-full ${props.className}`}>{props.children}</span>
}
