import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Zap, Plus, Clock, MessageSquare, AlertCircle, ArrowRight } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Pre-built Templates */}
        <Card className="border border-slate-200/60 dark:border-slate-800 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-900/10 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Clock className="h-24 w-24 text-indigo-500" />
            </div>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-indigo-900 dark:text-indigo-100">
                    <Zap className="h-5 w-5 text-indigo-500" /> Stale Lead Nudge
                </CardTitle>
                <CardDescription className="text-indigo-700/80 dark:text-indigo-300/80">
                    Automatically send a WhatsApp message if a lead is stuck in "New" for 48 hours.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between mt-4">
                    <Badge variant="outline" className="bg-white/50 dark:bg-black/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400">Template</Badge>
                    <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100/50 dark:text-indigo-400 dark:hover:bg-indigo-900/30">Activate <ArrowRight className="h-4 w-4 ml-1" /></Button>
                </div>
            </CardContent>
        </Card>

        <Card className="border border-slate-200/60 dark:border-slate-800 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-900/10 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <MessageSquare className="h-24 w-24 text-orange-500" />
            </div>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-orange-900 dark:text-orange-100">
                    <Zap className="h-5 w-5 text-orange-500" /> Hot Prospect Alert
                </CardTitle>
                <CardDescription className="text-orange-700/80 dark:text-orange-300/80">
                    Assign a high-priority task to the agent when a lead score crosses 50.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between mt-4">
                    <Badge variant="outline" className="bg-white/50 dark:bg-black/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400">Template</Badge>
                    <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700 hover:bg-orange-100/50 dark:text-orange-400 dark:hover:bg-orange-900/30">Activate <ArrowRight className="h-4 w-4 ml-1" /></Button>
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-4">Active Automations</h2>
        {automations && automations.length > 0 ? (
            <div className="space-y-4">
                {/* List automations here */}
            </div>
        ) : (
            <Card className="border-dashed border-slate-300 dark:border-slate-800 bg-transparent shadow-none">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <AlertCircle className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">No active automations</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Activate a template above to get started.</p>
                </CardContent>
            </Card>
        )}
      </div>
    </div>
  )
}
