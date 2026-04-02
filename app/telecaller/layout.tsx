import type React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { TelecallerSidebar } from "@/components/telecaller-sidebar"
import { CallTrackingProvider } from "@/context/call-tracking-context"
import { PushSubscriber } from "@/components/push-subscriber" 
import { TelecallerTicker } from "@/components/telecaller-ticker"
import { DailyWelcomeModal } from "@/components/telecaller/daily-welcome-modal"
import { GlobalAutoDialer } from "@/components/telecaller/GlobalAutoDialer"
import { Watermark } from "@/components/watermark"

// ✅ 1. IMPORT YOUR AGENT STATUS BAR & SUPABASE SERVER
import { AgentStatusBar } from "@/components/telecaller/AgentStatusBar"
import { createClient } from "@/lib/supabase/server"

// ✅ IMPORT THE THEME PROVIDER
import { ThemeProvider } from "@/components/theme-provider"

// ✅ 2. MAKE THE LAYOUT ASYNC TO FETCH THE USER
export default async function TelecallerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    // ✅ WRAP EVERYTHING IN THE THEME PROVIDER
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <AuthGuard requiredRole="telecaller">
        <PushSubscriber />
        <Watermark />
        <CallTrackingProvider>
          
          <DailyWelcomeModal />
          <GlobalAutoDialer />
          
          {/* ✅ Added dark:bg-gray-900 so dark mode actually changes the background */}
          <div className="flex h-screen bg-gray-50 dark:bg-slate-950">
            <TelecallerSidebar />
            
            <div className="flex-1 flex flex-col overflow-hidden relative"> 
              
              {/* ✅ TOP NAVIGATION AREA */}
              <div className="flex flex-col border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                {/* Status Bar */}
                {user && (
                   <div className="w-full">
                     <AgentStatusBar userId={user.id} />
                   </div>
                )}

                {/* ✅ Ticker moved here - embedded naturally, NOT floating */}
                <div className="w-full px-4 overflow-hidden">
                  <TelecallerTicker />
                </div>
              </div>

              {/* ✅ Main Content Area - Clicks will work perfectly here now */}
              <main className="flex-1 overflow-y-auto relative p-6">
                {children}
              </main>
            </div>
          </div>
        </CallTrackingProvider>
      </AuthGuard>
    </ThemeProvider>
  )
}
