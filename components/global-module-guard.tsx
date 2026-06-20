"use client"

import { useTenant } from "@/context/tenant-provider"
import { usePathname, useRouter } from "next/navigation"
import { Lock } from "lucide-react"
import { sidebarGroups } from "@/config/sidebar-nav"

export function GlobalModuleGuard({ children }: { children: React.ReactNode }) {
  const org = useTenant()
  const pathname = usePathname()
  const router = useRouter()
  
  // Find the required module based on current pathname
  let requiredModule = "core" // default to core
  
  if (pathname) {
    // Sort items by length descending so more specific paths match first
    const allItems = sidebarGroups.flatMap(group => group.items)
      .sort((a, b) => b.href.length - a.href.length)
      
    for (const item of allItems) {
      if (item.exact) {
        if (pathname === item.href) {
          requiredModule = item.module
          break
        }
      } else if (pathname.startsWith(item.href)) {
        requiredModule = item.module
        break
      }
    }
  }

  // If the user's org has enabled_modules, check access
  const hasAccess = !org || !org.enabled_modules || org.enabled_modules.includes(requiredModule) || requiredModule === "core"

  if (!hasAccess) {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center p-6 animate-in fade-in zoom-in duration-500 mt-10">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <Lock className="w-10 h-10 text-slate-400" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-3 tracking-tight">Module Locked</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8 leading-relaxed">
                Your workspace does not have access to the <strong className="text-slate-700 dark:text-slate-300 capitalize">{requiredModule.replace("-", " ")}</strong> module. 
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
