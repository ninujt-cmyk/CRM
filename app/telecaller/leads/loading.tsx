import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Filter, Users, Clock, TrendingUp, LogIn, CheckCircle2 } from "lucide-react"

export default function TelecallerLeadsLoading() {
  return (
    <div className="p-3 sm:p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950 min-h-screen pb-24 sm:pb-6 animate-pulse">
      
      {/* 🚀 MOTIVATIONAL PRODUCTIVITY HEADER SKELETON */}
      <div className="relative overflow-hidden bg-slate-200 dark:bg-slate-900 border border-slate-300/10 h-32 sm:h-28 rounded-2xl shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-300/10 rounded-full blur-3xl -mr-16 -mt-16" />
      </div>

      {/* 📊 KPI CARDS SKELETON */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {[
          { icon: Users, color: "text-slate-300" },
          { icon: Clock, color: "text-slate-300" },
          { icon: TrendingUp, color: "text-slate-300" },
          { icon: LogIn, color: "text-slate-300" },
          { icon: CheckCircle2, color: "text-slate-300" }
        ].map((item, idx) => (
          <Card key={idx} className="relative overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
              <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-950 text-slate-300">
                <item.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-1 space-y-2">
              <div className="h-7 w-12 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-2 w-24 bg-slate-100 dark:bg-slate-800 rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 🔍 FILTER & LEADS TABLE SKELETON */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden rounded-xl">
        <CardHeader className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-300" /> 
              <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded-md" />
            </div>
            <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-5 space-y-6">
          {/* Filters Bar Skeleton */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 h-10 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-10 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>
          
          {/* Table / Cards Skeleton */}
          <div className="space-y-3.5">
            {[1, 2, 3, 4, 5].map((cardIdx) => (
              <div key={cardIdx} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1.5">
                    <div className="h-4.5 w-32 bg-slate-200 dark:bg-slate-800 rounded-md" />
                    <div className="h-3.5 w-24 bg-slate-100 dark:bg-slate-800 rounded-md" />
                  </div>
                  <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
                </div>
                <div className="h-12 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800" />
                <div className="flex justify-between items-center pt-2">
                  <div className="flex gap-2">
                    <div className="h-9 w-9 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                    <div className="h-9 w-9 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                  </div>
                  <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
