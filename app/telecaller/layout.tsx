import type React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { TelecallerSidebar } from "@/components/telecaller-sidebar"
import { CallTrackingProvider } from "@/context/call-tracking-context"
import { PushSubscriber } from "@/components/push-subscriber" 
import { TelecallerTicker } from "@/components/telecaller-ticker"
import { DailyWelcomeModal } from "@/components/telecaller/daily-welcome-modal"
import { Watermark } from "@/components/watermark" 
import { GlobalAutoDialer } from "@/components/telecaller/GlobalAutoDialer"

// ✅ 1. IMPORT YOUR AGENT STATUS BAR & SUPABASE SERVER
import { AgentStatusBar } from "@/components/AgentStatusBar" // Adjust path if yours is different
import { createClient } from "@/lib/supabase/server"

// ✅ 2. MAKE THE LAYOUT ASYNC TO FETCH THE USER
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
        <GlobalAutoDialer />
        
        <div className="flex h-screen bg-gray-50">
          <TelecallerSidebar />
          
          <div className="flex-1 flex flex-col overflow-hidden relative"> 
            
            {/* ✅ 3. INJECT THE STATUS BAR HERE */}
            {/* It sits right at the top of the content view, just below your main header */}
            {user && (
               <div className="z-40 w-full">
                 <AgentStatusBar userId={user.id} />
               </div>
            )}

            <div className="absolute top-20 w-full flex justify-center z-50 bg-transparent pointer-events-none">
               <div className="w-full max-w-4xl pointer-events-auto opacity-90 hover:opacity-100 transition-opacity">
                  <TelecallerTicker />
               </div>
            </div>

            <main className="flex-1 overflow-y-auto relative">
              {children}
            </main>
          </div>
        </div>
      </CallTrackingProvider>
    </AuthGuard>
  )
}
