import { Flame, Star, Trophy, Zap, Clock } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AgentBadgesProps {
  dealsClosed: number
  callsMade: number
  consistencyStreak: number
}

export function AgentBadges({ dealsClosed, callsMade, consistencyStreak }: AgentBadgesProps) {
  const badges = []

  // Add Badges based on mocked or real data logic
  if (dealsClosed >= 3) {
    badges.push({
      id: 'closer',
      name: "The Closer",
      description: "Closed 3+ deals this month",
      icon: <Trophy className="h-4 w-4 text-yellow-500" />,
      bgClass: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800"
    })
  }

  if (callsMade >= 500) {
    badges.push({
      id: 'fire',
      name: "Fire Starter",
      description: "Made 500+ calls this month",
      icon: <Flame className="h-4 w-4 text-orange-500" />,
      bgClass: "bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800"
    })
  }

  if (consistencyStreak >= 5) {
    badges.push({
      id: 'streak',
      name: "Consistency King",
      description: "Hit target 5 days in a row",
      icon: <Zap className="h-4 w-4 text-indigo-500" />,
      bgClass: "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800"
    })
  }

  if (badges.length === 0) {
      badges.push({
        id: 'rising',
        name: "Rising Star",
        description: "Working hard to get on the board",
        icon: <Star className="h-4 w-4 text-slate-400" />,
        bgClass: "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
      })
  }

  return (
    <div className="flex flex-wrap gap-2">
        <TooltipProvider>
            {badges.map(badge => (
                <Tooltip key={badge.id}>
                    <TooltipTrigger className="cursor-default">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${badge.bgClass}`}>
                            {badge.icon}
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                {badge.name}
                            </span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 text-white font-semibold border-slate-800">
                        <p>{badge.description}</p>
                    </TooltipContent>
                </Tooltip>
            ))}
        </TooltipProvider>
    </div>
  )
}
