import type React from "react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { TopHeader } from "@/components/top-header"
import { CallTrackingProvider } from "@/context/call-tracking-context"
import { PushSubscriber } from "@/components/push-subscriber" 
import { Watermark } from "@/components/watermark"
import { GlobalModuleGuard } from "@/components/global-module-guard"
import { AIGuideAssistant } from "@/components/ai-guide-assistant"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function AdminLayout({
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
    <>
        <PushSubscriber />
        <Watermark />
        <CallTrackingProvider>
          <div className="flex h-screen bg-gray-50 dark:bg-slate-950">
            <AdminSidebar />
            <div className="flex-1 flex flex-col">
              <TopHeader />
              {/* The watermark is fixed, so it will float above everything here */}
              <main className="flex-1 overflow-y-auto relative">
                <GlobalModuleGuard>
                  {children}
                </GlobalModuleGuard>
              </main>
            </div>
            
            {/* AI Assistant Floating Widget */}
            <AIGuideAssistant />
            
          </div>
        </CallTrackingProvider>
    </>
  )
}
