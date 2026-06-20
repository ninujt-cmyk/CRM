import type React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { AdminSidebar } from "@/components/admin-sidebar"
import { TopHeader } from "@/components/top-header"
import { CallTrackingProvider } from "@/context/call-tracking-context"
import { PushSubscriber } from "@/components/push-subscriber" 
import { Watermark } from "@/components/watermark"

// ✅ 1. IMPORT THE TENANT PROVIDER
import { TenantProvider } from "@/context/tenant-provider"
import { GlobalModuleGuard } from "@/components/global-module-guard"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard requiredRole="admin">
      {/* ✅ 2. WRAP YOUR APP WITH THE TENANT CONTEXT */}
      <TenantProvider>
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
          </div>
        </CallTrackingProvider>
      </TenantProvider>
    </AuthGuard>
  )
}
