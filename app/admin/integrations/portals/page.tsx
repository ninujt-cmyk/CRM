import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Globe, Key, Webhook as WebhookIcon, ShieldCheck } from "lucide-react"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function PortalIntegrationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  const tenantId = profile?.tenant_id
  if (!tenantId) return <div>Error: No tenant found</div>

  const { data: credentials } = await supabase
    .from('portal_credentials')
    .select('*')
    .eq('tenant_id', tenantId)

  // Demo portals available
  const availablePortals = [
      { id: '99acres', name: '99acres', color: 'bg-blue-500' },
      { id: 'magicbricks', name: 'MagicBricks', color: 'bg-red-500' },
      { id: 'housing', name: 'Housing.com', color: 'bg-emerald-500' },
      { id: 'zillow', name: 'Zillow', color: 'bg-blue-600' }
  ]

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">External Portals</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">Connect MLS and real estate portals to ingest leads automatically.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
        {availablePortals.map(portal => {
            const activeCred = credentials?.find(c => c.portal_name === portal.id);

            return (
                <Card key={portal.id} className="border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden group">
                    <CardHeader className="pb-4">
                        <div className="flex justify-between items-start">
                            <div className={`p-3 rounded-xl ${portal.color} bg-opacity-10 text-slate-800 dark:text-slate-200`}>
                                <Globe className="h-6 w-6" />
                            </div>
                            {activeCred ? (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none shadow-none"><ShieldCheck className="h-3 w-3 mr-1"/> Connected</Badge>
                            ) : (
                                <Badge variant="outline" className="text-slate-500 border-slate-200">Not Connected</Badge>
                            )}
                        </div>
                        <CardTitle className="text-xl mt-4 text-slate-800 dark:text-slate-100">{portal.name}</CardTitle>
                        <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                            Ingest leads directly from {portal.name} into your CRM pipeline.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {activeCred ? (
                            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 flex items-center gap-1"><WebhookIcon className="h-3 w-3"/> Webhook URL</label>
                                    <code className="text-[10px] block truncate text-slate-700 dark:text-slate-300 bg-slate-200/50 dark:bg-slate-900 p-1.5 rounded">https://yourdomain.com/api/webhooks/portals</code>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 flex items-center gap-1"><Key className="h-3 w-3"/> Secret Token</label>
                                    <code className="text-[10px] block truncate text-slate-700 dark:text-slate-300 bg-slate-200/50 dark:bg-slate-900 p-1.5 rounded">{activeCred.webhook_secret}</code>
                                </div>
                                <Button variant="destructive" size="sm" className="w-full mt-2 h-8 text-xs font-semibold shadow-none">Disconnect</Button>
                            </div>
                        ) : (
                            <Button className="w-full font-semibold shadow-sm" variant="outline">
                                Connect {portal.name}
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )
        })}
      </div>
    </div>
  )
}
