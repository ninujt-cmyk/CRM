import type React from "react"
import { createClient } from "@/lib/supabase/server"
import { AuthGuard } from "@/components/auth-guard"
import { TelecallerSidebar } from "@/components/telecaller-sidebar"
import { CallTrackingProvider } from "@/context/call-tracking-context"
import { PushSubscriber } from "@/components/push-subscriber" 
import { TelecallerTicker } from "@/components/telecaller-ticker"
import { DailyWelcomeModal } from "@/components/telecaller/daily-welcome-modal"
import { Watermark } from "@/components/watermark" 
import { AgentStatusBar } from "@/components/telecaller/AgentStatusBar"

export default async function TelecallerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <AuthGuard requiredRole="telecaller">
      <PushSubscriber />
      <Watermark /> 
      <CallTrackingProvider>
        
        <DailyWelcomeModal />
        
        <div className="flex h-screen bg-gray-50">
          <TelecallerSidebar />
          
          <div className="flex-1 flex flex-col overflow-hidden relative"> 
            
            {/* 🔴 FIXED STATUS BAR */}
            {/* Added sticky positioning, high z-index, and prevented flex shrinking */}
            <div className="sticky top-0 z-[60] flex-shrink-0 w-full bg-white shadow-sm">
              {user && <AgentStatusBar />}
            </div>

            {/* Note: Kept z-50 here so it sits nicely below the z-[60] status bar */}
            <div className="absolute top-20 w-full flex justify-center z-50 bg-transparent pointer-events-none">
               {/* 🟢 THE FIX: Changed w-full max-w-4xl to w-fit so it doesn't block clicks on the dialer underneath */}
               <div className="w-fit pointer-events-auto opacity-90 hover:opacity-100 transition-opacity">
                  <TelecallerTicker />
               </div>
            </div>

            <main className="flex-1 overflow-y-auto pt-4 relative">
              {children}
            </main>
          </div>
        </div>
      </CallTrackingProvider>
    </AuthGuard>
  )
}
