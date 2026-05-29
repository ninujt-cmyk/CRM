"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Target, Phone, CheckSquare, Trophy, Flame, AlertCircle, TrendingUp } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface DailyTargetProgressProps {
  userId: string
  targets: {
    daily_calls: number
    daily_completed: number
    monthly_target: number
  }
  currentCalls: number
  currentCompleted: number
}

export function DailyTargetProgress({ targets, currentCalls, currentCompleted }: DailyTargetProgressProps) {
  // Calculate Progress
  const callPercentage = targets.daily_calls > 0 ? (currentCalls / targets.daily_calls) * 100 : 0
  const taskPercentage = targets.daily_completed > 0 ? (currentCompleted / targets.daily_completed) * 100 : 0
  
  const callsLeft = Math.max(0, targets.daily_calls - currentCalls)
  const tasksLeft = Math.max(0, targets.daily_completed - currentCompleted)

  // Advanced Motivation Logic
  const getMotivation = () => {
    const avg = (callPercentage + taskPercentage) / 2
    if (avg >= 120) return { text: "UNSTOPPABLE! 🚀", color: "text-purple-600 bg-purple-50 border-purple-100", icon: Trophy }
    if (avg >= 100) return { text: "Goal Crushed! 🎉", color: "text-amber-600 bg-amber-50 border-amber-100", icon: Trophy }
    if (avg >= 80) return { text: "Final Push! 🔥", color: "text-blue-600 bg-blue-50 border-blue-100", icon: Flame }
    if (avg >= 50) return { text: "On Track", color: "text-green-600 bg-green-50 border-green-100", icon: TrendingUp }
    return { text: "Let's Start", color: "text-slate-500 bg-slate-50 border-slate-100", icon: AlertCircle }
  }

  const motivation = getMotivation()
  const MotivationIcon = motivation.icon

  // Helper for dynamic bar color
  const getProgressStyles = (percent: number) => {
    if (percent >= 100) return "bg-gradient-to-r from-amber-400 to-amber-600 shadow-md shadow-amber-200" 
    if (percent >= 75) return "bg-gradient-to-r from-green-500 to-green-600"
    if (percent >= 40) return "bg-blue-500"
    return "bg-slate-400"
  }

  return (
    <Card className="shadow-sm border-slate-200 overflow-hidden relative">
      {/* Background Decorator for High Performance */}
      {(callPercentage > 100 || taskPercentage > 100) && (
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-400/10 rounded-full blur-3xl -z-0 pointer-events-none" />
      )}

      <CardHeader className="pb-3 border-b bg-slate-50/50 relative z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <Target className="h-5 w-5 text-blue-600" />
            Daily Goals
          </CardTitle>
          <div className={cn("flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border shadow-sm transition-all", motivation.color)}>
            <MotivationIcon className="h-3.5 w-3.5" />
            {motivation.text}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-5 space-y-8 relative z-10">
        
        {/* METRIC 1: CALLS */}
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg transition-colors", callPercentage >= 100 ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-600")}>
                    <Phone className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">Calls Made</span>
                    <span className="text-xs font-medium text-slate-500">
                        {callsLeft > 0 ? `${callsLeft} needed` : "Target Met"}
                    </span>
                </div>
            </div>
            <div className="text-right">
                <div className="flex items-baseline justify-end gap-1">
                    <span className={cn("text-xl font-bold", callPercentage >= 100 ? "text-amber-600" : "text-slate-900")}>
                        {currentCalls}
                    </span>
                    <span className="text-sm text-slate-400 font-medium">/ {targets.daily_calls}</span>
                </div>
            </div>
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                        className={cn("h-full rounded-full transition-all duration-1000 ease-out", getProgressStyles(callPercentage))} 
                        style={{ width: `${Math.min(callPercentage, 100)}%` }} 
                    />
                    {/* Overachiever Indicator */}
                    {callPercentage > 100 && (
                        <div className="absolute top-0 right-0 h-full w-[2px] bg-white z-10" style={{ left: '100%' }} />
                    )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-bold">{Math.round(callPercentage)}% Completion</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* METRIC 2: TASKS */}
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg transition-colors", taskPercentage >= 100 ? "bg-amber-100 text-amber-700" : "bg-purple-50 text-purple-600")}>
                    <CheckSquare className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">Tasks Done</span>
                    <span className="text-xs font-medium text-slate-500">
                        {tasksLeft > 0 ? `${tasksLeft} needed` : "Target Met"}
                    </span>
                </div>
            </div>
            <div className="text-right">
                <div className="flex items-baseline justify-end gap-1">
                    <span className={cn("text-xl font-bold", taskPercentage >= 100 ? "text-amber-600" : "text-slate-900")}>
                        {currentCompleted}
                    </span>
                    <span className="text-sm text-slate-400 font-medium">/ {targets.daily_completed}</span>
                </div>
            </div>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                        className={cn("h-full rounded-full transition-all duration-1000 ease-out", getProgressStyles(taskPercentage))} 
                        style={{ width: `${Math.min(taskPercentage, 100)}%` }} 
                    />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-bold">{Math.round(taskPercentage)}% Completion</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

      </CardContent>
    </Card>
  )
}
