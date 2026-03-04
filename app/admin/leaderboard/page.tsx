"use client"

import { useState, useEffect } from "react"
import { getLeaderboardData } from "@/app/actions/targets"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Trophy, Target, TrendingUp, AlertCircle, IndianRupee, Medal, Flame } from "lucide-react"

export default function DisbursementLeaderboard() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLeaderboardData().then((res) => {
      setData(res)
      setLoading(false)
    })
  }, [])

  const formatCurrency = (amount: number) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
  }

  if (loading) return <div className="p-10 text-center animate-pulse text-slate-500">Loading Leaderboard...</div>

  if (data.length === 0) return (
    <div className="p-10 text-center text-slate-500 flex flex-col items-center">
        <Target className="w-12 h-12 mb-3 opacity-20" />
        <p>No active targets found. Set targets in the admin panel to view the leaderboard.</p>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
        
      {/* 📸 This header is designed to look great in a WhatsApp screenshot */}
      <div className="flex items-center justify-between bg-gradient-to-r from-blue-900 to-indigo-800 p-6 rounded-xl shadow-lg text-white">
        <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                <Trophy className="text-yellow-400 w-8 h-8" /> 
                DISBURSEMENT LEADERBOARD
            </h1>
            <p className="text-blue-200 text-sm mt-1 font-medium tracking-wide">
                Live Daily Run Rate & Target Tracking
            </p>
        </div>
        <div className="text-right">
            <div className="text-xs text-blue-200 uppercase font-bold tracking-widest">Team Total Achieved</div>
            <div className="text-3xl font-black text-emerald-400">
                {formatCurrency(data.reduce((sum, a) => sum + a.achieved, 0))}
            </div>
        </div>
      </div>

      <div className="grid gap-4">
        {data.map((agent, index) => {
          const isWinner = index === 0 && agent.progress > 0;
          const isDanger = agent.progress < 30 && agent.daysLeft <= 3;
          const isComplete = agent.progress >= 100;

          return (
            <Card key={agent.id} className={`overflow-hidden border-l-4 shadow-sm hover:shadow-md transition-all ${
                isComplete ? 'border-l-emerald-500 bg-emerald-50/30' : 
                isWinner ? 'border-l-yellow-400' : 
                isDanger ? 'border-l-red-500 bg-red-50/30' : 'border-l-blue-500'
            }`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {/* Rank Badge */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-slate-200 text-slate-700' :
                            index === 2 ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-500'
                        }`}>
                            {index + 1}
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            {agent.name}
                            {isComplete && <Flame className="w-5 h-5 text-orange-500 fill-orange-500 animate-pulse" />}
                        </h3>
                    </div>
                    <Badge variant={isComplete ? "default" : "secondary"} className={isComplete ? "bg-emerald-500" : ""}>
                        {agent.daysLeft} Days Left
                    </Badge>
                </div>

                {/* The Progress Bar Section */}
                <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm font-semibold">
                        <span className="text-slate-600">Progress</span>
                        <span className={isComplete ? "text-emerald-600 font-black" : "text-blue-600"}>{agent.progress}%</span>
                    </div>
                    <Progress value={agent.progress} className={`h-3 ${isComplete ? '[&>div]:bg-emerald-500' : ''}`} />
                </div>

                {/* Financial Stats Grid */}
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
                    <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Target</p>
                        <p className="font-semibold text-slate-700">{formatCurrency(agent.target)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Achieved</p>
                        <p className={`font-black ${isComplete ? 'text-emerald-600' : 'text-slate-800'}`}>
                            {formatCurrency(agent.achieved)}
                        </p>
                    </div>
                    <div className="bg-slate-50 rounded-md p-2 -my-2 border border-slate-100 text-center">
                        <p className="text-[10px] uppercase font-bold text-indigo-500 flex items-center justify-center gap-1">
                            <TrendingUp className="w-3 h-3" /> Daily Required
                        </p>
                        <p className="font-bold text-indigo-700">
                            {isComplete ? 'Done 🎉' : formatCurrency(agent.dailyRequired)}
                        </p>
                    </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
