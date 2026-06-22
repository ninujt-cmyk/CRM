import { Trophy, Medal, Crown } from "lucide-react"
import { cn } from "@/lib/utils"

interface PodiumProps {
    topAgents: any[]
}

export function Podium({ topAgents }: PodiumProps) {
    if (!topAgents || topAgents.length === 0) return null

    // Ensure we have 3 slots even if there are fewer agents
    const podiumData = [
        topAgents[1] || null, // Rank 2 (Silver)
        topAgents[0] || null, // Rank 1 (Gold)
        topAgents[2] || null  // Rank 3 (Bronze)
    ]

    return (
        <div className="flex items-end justify-center gap-2 md:gap-6 py-12 mb-8 bg-gradient-to-b from-indigo-900/10 to-transparent rounded-3xl">
            {podiumData.map((agent, index) => {
                const rank = index === 0 ? 2 : index === 1 ? 1 : 3;
                
                let height = "h-32";
                let colorClass = "bg-slate-300";
                let textClass = "text-slate-600";
                let Icon = Medal;
                
                if (rank === 1) {
                    height = "h-48";
                    colorClass = "bg-gradient-to-t from-yellow-500 to-yellow-300 ring-4 ring-yellow-400/30";
                    textClass = "text-yellow-900";
                    Icon = Crown;
                } else if (rank === 2) {
                    height = "h-36";
                    colorClass = "bg-gradient-to-t from-slate-400 to-slate-200 ring-2 ring-slate-400/30";
                    textClass = "text-slate-800";
                } else if (rank === 3) {
                    height = "h-28";
                    colorClass = "bg-gradient-to-t from-orange-500 to-orange-300 ring-2 ring-orange-500/30";
                    textClass = "text-orange-950";
                }

                return (
                    <div key={rank} className="flex flex-col items-center group relative w-24 md:w-32">
                        {/* Agent Avatar / Name */}
                        {agent ? (
                            <div className="flex flex-col items-center mb-3 animate-in slide-in-from-bottom-4 duration-700 fade-in" style={{ animationDelay: `${rank * 150}ms`}}>
                                <div className={cn("flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full mb-2 bg-white shadow-xl z-10 border-4", rank === 1 ? "border-yellow-400" : rank === 2 ? "border-slate-300" : "border-orange-400")}>
                                    <span className="font-extrabold text-xl text-slate-800">{agent.agent_name.charAt(0)}</span>
                                </div>
                                <span className="font-bold text-sm md:text-base text-slate-900 dark:text-slate-100 truncate w-full text-center px-1">
                                    {agent.agent_name.split(' ')[0]}
                                </span>
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                    ₹{(agent.total_revenue/100000).toFixed(1)}L
                                </span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center mb-4 opacity-50">
                                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-slate-200 dark:bg-slate-800 mb-2 border-4 border-transparent" />
                                <span className="text-xs text-slate-400">Empty</span>
                            </div>
                        )}

                        {/* Podium Block */}
                        <div className={cn("w-full rounded-t-xl shadow-lg relative overflow-hidden flex flex-col items-center justify-start pt-4 transition-all duration-500", height, colorClass)}>
                            <div className="absolute inset-0 bg-white/20 mix-blend-overlay"></div>
                            <span className={cn("font-black text-4xl md:text-5xl opacity-80", textClass)}>{rank}</span>
                            <Icon className={cn("h-6 w-6 mt-2 opacity-70", textClass)} />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
