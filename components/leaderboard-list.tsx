import { TrendingUp, IndianRupee, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { AgentBadges } from "@/components/agent-badges"

export function LeaderboardList({ agents }: { agents: any[] }) {
    if (!agents || agents.length === 0) return null

    return (
        <div className="space-y-4">
            {agents.map((agent: any, index: number) => {
                const rank = index + 1
                
                // MOCK GAMIFICATION LOGIC: 
                // We'll create a fake "Target Revenue" for the progress bar
                const targetRevenue = Math.max(5000000, agent.total_revenue + 1000000) // 50L base target, or 10L more than current
                const progressPercentage = Math.min(100, Math.max(0, (agent.total_revenue / targetRevenue) * 100))

                return (
                    <div key={agent.agent_id} className={cn(
                        "relative bg-white dark:bg-slate-900 border rounded-2xl p-4 md:p-6 transition-all hover:shadow-md",
                        rank === 1 ? "border-yellow-300 dark:border-yellow-900 shadow-[0_0_15px_rgba(250,204,21,0.1)]" : 
                        rank === 2 ? "border-slate-300 dark:border-slate-700" :
                        rank === 3 ? "border-orange-300 dark:border-orange-900" : 
                        "border-slate-200 dark:border-slate-800"
                    )}>
                        {/* Rank Badge for the List View (if we want to show it on the side) */}
                        <div className="absolute -left-3 -top-3 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-md ring-4 ring-white dark:ring-slate-950">
                            #{rank}
                        </div>

                        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                            
                            {/* Avatar & Basic Info */}
                            <div className="flex items-center gap-4 min-w-[250px]">
                                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                                    {agent.agent_name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">{agent.agent_name}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Level {Math.floor(agent.deals_closed / 2) + 1} Closer</p>
                                </div>
                            </div>

                            {/* Target Progress Bar */}
                            <div className="flex-1 w-full">
                                <div className="flex justify-between text-xs font-bold mb-1.5">
                                    <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1"><Target className="h-3 w-3" /> Target Progress</span>
                                    <span className="text-indigo-600 dark:text-indigo-400">{progressPercentage.toFixed(0)}%</span>
                                </div>
                                <Progress value={progressPercentage} className="h-2.5 bg-slate-100 dark:bg-slate-800" />
                                <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
                                    <span>₹{(agent.total_revenue / 100000).toFixed(1)}L Achieved</span>
                                    <span>₹{(targetRevenue / 100000).toFixed(1)}L Goal</span>
                                </div>
                            </div>

                            {/* Badges & Stats */}
                            <div className="flex flex-col gap-3 min-w-[200px] md:items-end">
                                <AgentBadges 
                                    dealsClosed={agent.deals_closed} 
                                    callsMade={agent.total_deals_handled * 4} // mock call volume
                                    consistencyStreak={agent.deals_closed} // mock streak
                                />
                                <div className="flex gap-4">
                                    <div className="text-right">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Deals</p>
                                        <p className="font-black text-lg text-slate-700 dark:text-slate-300">{agent.deals_closed}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Revenue</p>
                                        <p className="font-black text-lg text-emerald-600 flex items-center justify-end">
                                            <IndianRupee className="h-4 w-4" />
                                            {agent.total_revenue.toLocaleString('en-IN')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                )
            })}
        </div>
    )
}
