import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { redirect } from "next/navigation"
import { AutomationsClient } from "@/components/automations-client"

export const dynamic = "force-dynamic"

export default async function AutomationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  const tenantId = profile?.tenant_id
  if (!tenantId) return <div>Error: No tenant found</div>

  const { data: automations } = await supabase.from('automations').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Automations & Drip Campaigns</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">Set up rules to put your sales funnel on autopilot.</p>
        </div>
        <div className="flex gap-3">
          <Button className="flex items-center gap-2 shadow-sm pointer-events-none opacity-50" disabled>
            <Plus className="h-4 w-4" /> Create Rule (Coming Soon)
          </Button>
        </div>
      </div>

      <AutomationsClient initialAutomations={automations || []} tenantId={tenantId} />
    </div>
  )
}
