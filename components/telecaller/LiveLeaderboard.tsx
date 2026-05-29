"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, Medal } from "lucide-react"

export function LiveLeaderboard() {
    const [leaders, setLeaders] = useState<{name: string, logins: number}[]>([])
    const supabase = createClient()

    useEffect(() => {
        const fetchLeaders = async () => {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            // Fetch actual login records created today to match the Admin Logins page
            const { data, error } = await supabase
                .from('logins')
                .select('assigned_to, users:assigned_to(full_name)')
                .gte('created_at', startOfDay.toISOString());

            if (error) {
                console.error("Leaderboard fetch error:", error);
                return;
            }

            if (data) {
                const counts: Record<string, {name: string, count: number}> = {};
                data.forEach((login: any) => {
                    const agentId = login.assigned_to;
                    const agentName = login.users?.full_name || "Unknown Agent";
                    
                    if (agentId) {
                        if (!counts[agentId]) counts[agentId] = { name: agentName, count: 0 };
                        counts[agentId].count++;
                    }
                });

                const sorted = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
                setLeaders(sorted.map(s => ({ name: s.name, logins: s.count })));
            }
        }
        
        fetchLeaders();
        
        // Listen for realtime inserts/updates on the 'logins' table instead of 'leads'
        const channel = supabase.channel('leaderboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'logins' }, fetchLeaders)
            .subscribe();
            
        return () => { supabase.removeChannel(channel) }
    }, [supabase])

    return (
        <Card className="border-2 border-yellow-400 bg-gradient-to-b from-yellow-50 to-white shadow-lg">
            <CardHeader className="border-b border-yellow-100 pb-3">
                <CardTitle className="text-yellow-800 flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" /> Today's Top Performers
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
                {leaders.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center">No logins yet today. Go get the first one!</p>
                ) : null}
                
                {leaders.map((leader, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-white border shadow-sm">
                        <div className="flex items-center gap-3">
                            {index === 0 && <Medal className="h-5 w-5 text-yellow-500" />}
                            {index === 1 && <Medal className="h-5 w-5 text-slate-400" />}
                            {index === 2 && <Medal className="h-5 w-5 text-amber-600" />}
                            {index > 2 && <span className="w-5 text-center font-bold text-slate-400">{index + 1}</span>}
                            <span className="font-bold text-slate-700">{leader.name}</span>
                        </div>
                        <div className="bg-yellow-100 text-yellow-800 font-bold px-3 py-1 rounded-full text-sm">
                            {leader.logins} Logins
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
