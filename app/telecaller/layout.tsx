import type React from "react"
import { createClient } from "@/lib/supabase/server" // <--- Added Supabase import
import { AuthGuard } from "@/components/auth-guard"
import { TelecallerSidebar } from "@/components/telecaller-sidebar"
import { CallTrackingProvider } from "@/context/call-tracking-context"
import { PushSubscriber } from "@/components/push-subscriber" 
import { TelecallerTicker } from "@/components/telecaller-ticker"
import { DailyWelcomeModal } from "@/components/telecaller/daily-welcome-modal"
import { Watermark } from "@/components/watermark" 
import { AgentStatusBar } from "@/components/telecaller/AgentStatusBar" // <--- Added Status Bar import

// Made this an async function to fetch the user securely
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
            
            {/* 🔴 INJECTED STATUS BAR HERE */}
            {user && <AgentStatusBar />}

            <div className="absolute top-20 w-full flex justify-center z-50 bg-transparent pointer-events-none">
               <div className="w-full max-w-4xl pointer-events-auto opacity-90 hover:opacity-100 transition-opacity">
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
