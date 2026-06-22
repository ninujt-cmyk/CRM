import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TopHeader } from "@/components/top-header"
import { DripSequenceBuilder } from "@/components/drip-sequence-builder"

export const dynamic = "force-dynamic"

export default async function SequencesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  const tenantId = profile?.tenant_id
  if (!tenantId) return <div>Error: No tenant found</div>

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <TopHeader />
      <main className="flex-1 overflow-auto p-6">
        <div className="mb-6 flex justify-between items-center">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Drip Sequence Builder</h1>
                <p className="text-slate-500 dark:text-slate-400">Design multi-step action plans to nurture leads automatically.</p>
            </div>
        </div>
        
        <DripSequenceBuilder />
      </main>
    </div>
  )
}
