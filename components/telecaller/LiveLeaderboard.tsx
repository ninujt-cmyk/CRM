"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, Medal, IndianRupee } from "lucide-react"

export function LiveLeaderboard() {
    const [leaders, setLeaders] = useState<{name: string, revenue: number, deals: number}[]>([])
    const supabase = createClient()

    useEffect(() => {
        const fetchLeaders = async () => {
            const { data, error } = await supabase
                .from('agent_leaderboard_view')
                .select('*')
                .order('total_revenue', { ascending: false })
                .order('deals_closed', { ascending: false })
                .limit(5);

            if (error) {
                console.error("Leaderboard fetch error:", error);
                return;
            }

            if (data) {
                setLeaders(data.map((d: any) => ({
                    name: d.agent_name,
                    revenue: d.total_revenue,
                    deals: d.deals_closed
                })));
            }
        }
        
        fetchLeaders();
        
        // Listen for realtime inserts/updates on the 'deals' table to trigger a refresh
        const channel = supabase.channel('leaderboard_deals')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, fetchLeaders)
            .subscribe();
            
        return () => { supabase.removeChannel(channel) }
    }, [supabase])

    return (
        <Card className="border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                <Trophy className="h-24 w-24 text-yellow-500" />
            </div>
            <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 text-white pb-3 rounded-t-2xl">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Trophy className="h-4.5 w-4.5 text-yellow-500" /> Top Deal Makers
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 p-2 space-y-2 relative z-10">
                {leaders.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4">No closed deals yet. Be the first!</p>
                ) : null}
                
                {leaders.map((leader, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center gap-2.5">
                            {index === 0 && <Medal className="h-4.5 w-4.5 text-yellow-500" />}
                            {index === 1 && <Medal className="h-4.5 w-4.5 text-slate-400" />}
                            {index === 2 && <Medal className="h-4.5 w-4.5 text-amber-600" />}
                            {index > 2 && <span className="w-4.5 text-center font-bold text-slate-400 text-xs">{index + 1}</span>}
                            
                            <div>
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm leading-tight block">{leader.name}</span>
                                <span className="text-[10px] text-slate-500 font-semibold">{leader.deals} Deals</span>
                            </div>
                        </div>
                        <div className="flex items-center text-emerald-600 dark:text-emerald-400 font-black text-sm">
                            <IndianRupee className="h-3 w-3 mr-0.5" />
                            {leader.revenue.toLocaleString('en-IN')}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
