import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TopHeader } from "@/components/top-header"
import { InboxSidebar } from "@/components/inbox-sidebar"
import { InboxChat } from "@/components/inbox-chat"
import { InboxDetails } from "@/components/inbox-details"

export const dynamic = "force-dynamic"

export default async function InboxPage({ searchParams }: { searchParams: { thread?: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  const tenantId = profile?.tenant_id
  if (!tenantId) return <div>Error: No tenant found</div>

  const threadId = searchParams.thread || null

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white dark:bg-slate-950">
      <TopHeader />
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Threads */}
        <div className="w-80 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden">
            <InboxSidebar activeThreadId={threadId} />
        </div>

        {/* Middle: Chat Interface */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-950">
          {threadId ? (
            <InboxChat threadId={threadId} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              Select a conversation to start messaging
            </div>
          )}
        </div>

        {/* Right Sidebar: Lead Details */}
        {threadId && (
          <div className="w-80 flex-shrink-0 border-l border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 overflow-y-auto hidden lg:block">
            <InboxDetails threadId={threadId} />
          </div>
        )}
      </main>
    </div>
  )
}
