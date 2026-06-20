"use client"

import { useTenant } from "@/context/tenant-provider"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Lock } from "lucide-react"

export function ModuleGuard({ children, requiredModule }: { children: React.ReactNode, requiredModule: string }) {
  const org = useTenant()
  const router = useRouter()

  useEffect(() => {
    if (org && org.enabled_modules && !org.enabled_modules.includes(requiredModule)) {
      router.replace("/admin")
    }
  }, [org, requiredModule, router])

  if (!org) {
    return (
        <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
    )
  }

  if (org.enabled_modules && !org.enabled_modules.includes(requiredModule)) {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center p-6 animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <Lock className="w-10 h-10 text-slate-400" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-3 tracking-tight">Module Locked</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8 leading-relaxed">
                Your workspace does not have access to the <strong className="text-slate-700 dark:text-slate-300 capitalize">{requiredModule}</strong> module. 
                Please contact the system administrator to upgrade your plan or enable this feature.
            </p>
            <button 
                onClick={() => router.push('/admin')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-lg shadow-sm transition-all hover:shadow hover:-translate-y-0.5 active:translate-y-0"
            >
                Return to Dashboard
            </button>
        </div>
    )
  }

  return <>{children}</>
}
