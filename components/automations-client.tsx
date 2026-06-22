"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Zap, Clock, MessageSquare, AlertCircle, ArrowRight, Trash2, Power, PowerOff } from "lucide-react"
import { createTemplateAutomation, toggleAutomation, deleteAutomation } from "@/app/actions/automations"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export function AutomationsClient({ initialAutomations, tenantId }: { initialAutomations: any[], tenantId: string }) {
  const [automations, setAutomations] = useState(initialAutomations)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleActivateTemplate = async (templateType: 'STALE_LEAD' | 'HOT_PROSPECT') => {
    setLoading(true)
    const toastId = toast.loading("Activating automation template...")
    try {
        const res = await createTemplateAutomation(tenantId, templateType)
        if (res.success && res.data) {
            setAutomations(prev => [res.data, ...prev])
            toast.success("Automation activated successfully!", { id: toastId })
        } else {
            toast.error(res.error || "Failed to activate automation", { id: toastId })
        }
    } catch (e: any) {
        toast.error(e.message, { id: toastId })
    } finally {
        setLoading(false)
    }
  }

  const handleToggle = async (id: string, currentStatus: boolean) => {
    const toastId = toast.loading(currentStatus ? "Disabling automation..." : "Enabling automation...")
    try {
        // Optimistic update
        setAutomations(prev => prev.map(a => a.id === id ? { ...a, is_active: !currentStatus } : a))
        
        const res = await toggleAutomation(id, currentStatus)
        if (res.success) {
            toast.success(`Automation ${currentStatus ? 'disabled' : 'enabled'}`, { id: toastId })
            router.refresh()
        } else {
            // Revert on failure
            setAutomations(prev => prev.map(a => a.id === id ? { ...a, is_active: currentStatus } : a))
            toast.error(res.error || "Failed to toggle", { id: toastId })
        }
    } catch (e: any) {
        setAutomations(prev => prev.map(a => a.id === id ? { ...a, is_active: currentStatus } : a))
        toast.error(e.message, { id: toastId })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this automation?")) return;
    
    const toastId = toast.loading("Deleting automation...")
    try {
        const res = await deleteAutomation(id)
        if (res.success) {
            setAutomations(prev => prev.filter(a => a.id !== id))
            toast.success("Automation deleted", { id: toastId })
            router.refresh()
        } else {
            toast.error(res.error || "Failed to delete", { id: toastId })
        }
    } catch (e: any) {
        toast.error(e.message, { id: toastId })
    }
  }

  // Check if templates are already activated to disable buttons
  const isStaleLeadActive = automations.some(a => a.name === 'Stale Lead Nudge')
  const isHotProspectActive = automations.some(a => a.name === 'Hot Prospect Alert')

  return (
    <>
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
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        disabled={loading || isStaleLeadActive}
                        onClick={() => handleActivateTemplate('STALE_LEAD')}
                        className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100/50 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
                    >
                        {isStaleLeadActive ? "Activated" : "Activate"} <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
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
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        disabled={loading || isHotProspectActive}
                        onClick={() => handleActivateTemplate('HOT_PROSPECT')}
                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-100/50 dark:text-orange-400 dark:hover:bg-orange-900/30"
                    >
                        {isHotProspectActive ? "Activated" : "Activate"} <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-4">Active Automations</h2>
        {automations && automations.length > 0 ? (
            <div className="space-y-4">
                {automations.map((automation) => (
                    <Card key={automation.id} className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <CardContent className="p-4 flex items-center justify-between sm:flex-row flex-col gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">{automation.name}</h3>
                                    <Badge variant="secondary" className={automation.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}>
                                        {automation.is_active ? "Active" : "Inactive"}
                                    </Badge>
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {automation.name === 'Stale Lead Nudge' 
                                        ? 'Automatically send a WhatsApp message if a lead is stuck in "New" for 48 hours.'
                                        : 'Assign a high-priority task to the agent when a lead score crosses 50.'}
                                </p>
                                <div className="flex gap-2 mt-2">
                                    <Badge variant="outline" className="text-xs bg-slate-50 dark:bg-slate-800">
                                        Trigger: {automation.trigger_type}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs bg-slate-50 dark:bg-slate-800">
                                        Action: {automation.action_type}
                                    </Badge>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <Button 
                                    variant={automation.is_active ? "outline" : "default"} 
                                    size="sm" 
                                    className="flex-1 sm:flex-none"
                                    onClick={() => handleToggle(automation.id, automation.is_active)}
                                >
                                    {automation.is_active ? <><PowerOff className="h-4 w-4 mr-2" /> Disable</> : <><Power className="h-4 w-4 mr-2" /> Enable</>}
                                </Button>
                                <Button 
                                    variant="destructive" 
                                    size="sm"
                                    onClick={() => handleDelete(automation.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
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
    </>
  )
}
