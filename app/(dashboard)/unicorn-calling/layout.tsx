import type React from "react"
import { UnicornSidebar } from "@/components/unicorn-sidebar"
import { TopHeader } from "@/components/top-header"
import { GlobalModuleGuard } from "@/components/global-module-guard"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function UnicornLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  const userRole = userData?.role || "telecaller"
  const adminAccessRoles = ["admin", "super_admin", "tenant_admin", "team_leader"]

  if (!adminAccessRoles.includes(userRole)) {
    redirect("/telecaller")
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950">
      <UnicornSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader />
        <main className="flex-1 overflow-y-auto relative p-6">
          <GlobalModuleGuard>
            {children}
          </GlobalModuleGuard>
        </main>
      </div>
    </div>
  )
}
